import { lyraConstants } from "@lyrafinance/protocol";
import {
  MAX_UINT,
  OptionType,
  toBN,
  ZERO_ADDRESS,
} from "@lyrafinance/protocol/dist/scripts/util/web3utils";
import {
  BasicFeeCounter__factory,
  ERC20__factory,
} from "@lyrafinance/protocol/dist/typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { HackMoneyVault__factory } from "../../../typechain-types";
import {
  HackMoneyStrategyLibraryAddresses,
  HackMoneyStrategy__factory,
} from "../../../typechain-types/factories/HackMoneyStrategy__factory";
import { HackMoneyStrategyDetailStruct } from "../../../typechain-types/HackMoneyStrategy";
import { targets as lyraGlobal } from "./lyra-mainnet.json";

const lyraMarket = lyraGlobal.markets.sETH;

const strategyDetail: HackMoneyStrategyDetailStruct = {
  minTimeToExpiry: lyraConstants.DAY_SEC,
  maxTimeToExpiry: lyraConstants.WEEK_SEC * 2,
  mintargetDelta: toBN("0.15"),
  maxtargetDelta: toBN("0.85"),
  maxDeltaGap: toBN("0.05"), // accept delta from 0.10~0.20 or 0.80~0.90
  minVol: toBN("0.8"), // min vol to sell. (also used to calculate min premium for call selling vault)
  size: toBN("100"),
};

describe("Hack Money Vault integration test", async () => {
  let deployer: SignerWithAddress;
  // let manager: SignerWithAddress;
  // let randomUser: SignerWithAddress;
  // let randomUser2: SignerWithAddress;

  before("assign roles", async () => {
    const addresses = await ethers.getSigners();
    deployer = addresses[0];
    // manager = addresses[1];
    // randomUser = addresses[8];
    // randomUser2 = addresses[9];
  });

  it("deploy on kovan fork, deposit and try to trade", async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            // TODO: Remove into env
            jsonRpcUrl:
              "https://opt-mainnet.g.alchemy.com/v2/dW3_J05iOi-kuyk1Zgy7bwXip_gXMeSX",
            blockNumber: 13578217,
          },
        },
      ],
    });

    const whaleAddress = "0xa5f7a39e55d7878bc5bd754ee5d6bd7a7662355b";

    // const balance = await ethers.provider.getBalance(
    // "0xD34F2e9916473C5eFA8A255f5b8738eCd4205317"
    // );

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whaleAddress],
    });

    const whale = await ethers.getSigner(whaleAddress);
    const sETH = ERC20__factory.connect(
      "0xE405de8F52ba7559f9df3C368500B6E6ae6Cee49",
      deployer
    );
    // const sETH = new Contract(
    // lyraMarket.BaseAsset.address,
    // lyraMarket.BaseAsset.abi,
    // whale
    // ) as ERC20;
    const sUSD = ERC20__factory.connect(
      "0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9",
      deployer
    );
    // const sUSD = new Contract(
    // lyraGlobal.QuoteAsset.address,
    // lyraGlobal.QuoteAsset.abi,
    // deployer
    // );

    console.log("succesfully transferring");
    await sETH
      .connect(whale)
      .transfer(deployer.address, ethers.utils.parseEther("100"));

    const HackMoneyVaultFactory = new HackMoneyVault__factory(deployer);
    const decimals = 18;
    const cap = ethers.utils.parseEther("100000"); // 100k USD as cap
    const lyraVault = await HackMoneyVaultFactory.connect(deployer).deploy(
      sUSD.address,
      ZERO_ADDRESS,
      lyraConstants.DAY_SEC * 7,
      "Lyra Covered Strangle Share",
      "CSS",
      {
        decimals,
        cap,
        asset: sETH.address, // collateral asset
      }
    );

    const linkAddresses: HackMoneyStrategyLibraryAddresses = {
      "@lyrafinance/protocol/contracts/libraries/BlackScholes.sol:BlackScholes":
        "0x409f9A1Ee61E94B91b11e3696DF2108EFc7C3EF5",
    };
    const LyraStrategyFactory = new HackMoneyStrategy__factory(
      linkAddresses,
      deployer
    );
    console.log("pre strategy deploy");
    const lyraStrategy = await LyraStrategyFactory.connect(deployer).deploy(
      lyraVault.address,
      OptionType.SHORT_CALL_BASE
    );

    const BasicFeeCounterFactory = new BasicFeeCounter__factory(deployer);
    const feeCounter = await BasicFeeCounterFactory.connect(deployer).deploy();

    console.log("before adapter init");
    await lyraStrategy
      .connect(deployer)
      .initAdapter(
        lyraGlobal.LyraRegistry.address,
        lyraMarket.OptionMarket.address,
        "0x0100fBf414071977B19fC38e6fc7c32FE444F5C9",
        feeCounter.address
      );

    await lyraVault.connect(deployer).setStrategy(lyraStrategy.address);
    await lyraStrategy.connect(deployer).setStrategyDetail(strategyDetail);

    let vaultBalance = await lyraVault.totalBalance();
    expect(vaultBalance).to.equal("0");

    console.log("pre deposit");
    await sETH.connect(deployer).approve(lyraVault.address, MAX_UINT);
    await lyraVault.deposit(ethers.utils.parseEther("20"));

    vaultBalance = await lyraVault.totalBalance();
    expect(vaultBalance).to.equal(ethers.utils.parseEther("20"));

    console.log("pre start next round");
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    console.log(block.timestamp);
    console.log(block.number);
    await lyraVault.startNextRound("3");
    console.log("able to start next round");

    vaultBalance = await lyraVault.totalBalance();
    expect(vaultBalance).to.equal(ethers.utils.parseEther("20"));

    console.log("pre deposit 2");
    await lyraVault.deposit(ethers.utils.parseEther("1"));

    vaultBalance = await lyraVault.totalBalance();
    expect(vaultBalance).to.equal(ethers.utils.parseEther("21"));
    console.log("pre trade");
    await lyraVault.trade(ethers.utils.parseEther("5"), {
      gasLimit: 30000000,
    });
    await lyraVault.trade(ethers.utils.parseEther("5"), {
      gasLimit: 30000000,
    });
    console.log("Traded");

    // await expect(lyraVault.trade(ethers.utils.parseEther("5")))
    //   .to.emit(lyraVault, "Trade")
    //   .withArgs(deployer.address, 182, 183, 1817, 10);

    vaultBalance = await lyraVault.totalBalance();
    expect(vaultBalance).to.equal(ethers.utils.parseEther("21"));
  });
});
