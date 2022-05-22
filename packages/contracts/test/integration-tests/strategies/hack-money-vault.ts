import {
  getGlobalDeploys,
  getMarketDeploys,
  lyraConstants,
} from "@lyrafinance/protocol";
import {
  MAX_UINT,
  OptionType,
  toBN,
  ZERO_ADDRESS,
} from "@lyrafinance/protocol/dist/scripts/util/web3utils";
import {
  BasicFeeCounter__factory,
  ERC20,
} from "@lyrafinance/protocol/dist/typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers, network } from "hardhat";
import { DEPLOYED_CONTRACTS } from "../../../constants";
import { HackMoneyVault__factory } from "../../../typechain-types";
import {
  HackMoneyStrategyLibraryAddresses,
  HackMoneyStrategy__factory,
} from "../../../typechain-types/factories/HackMoneyStrategy__factory";
import { HackMoneyStrategyDetailStruct } from "../../../typechain-types/HackMoneyStrategy";

const strategyDetail: HackMoneyStrategyDetailStruct = {
  maxVolVariance: toBN("0.1"),
  gwavPeriod: 600,
  minTimeToExpiry: lyraConstants.DAY_SEC,
  maxTimeToExpiry: lyraConstants.WEEK_SEC * 2,
  mintargetDelta: toBN("0.15"),
  maxtargetDelta: toBN("0.85"),
  maxDeltaGap: toBN("0.05"), // accept delta from 0.10~0.20 or 0.80~0.90
  minVol: toBN("0.8"), // min vol to sell. (also used to calculate min premium for call selling vault)
  maxVol: toBN("1.3"), // max vol to sell.
  size: toBN("100"),
};

describe("Hack Money Vault integration test", async () => {
  let deployer: SignerWithAddress;
  let manager: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let randomUser2: SignerWithAddress;

  before("assign roles", async () => {
    const addresses = await ethers.getSigners();
    deployer = addresses[0];
    manager = addresses[1];
    randomUser = addresses[8];
    randomUser2 = addresses[9];
  });

  it("deploy on kovan fork, deposit and try to trade", async () => {
    const chainId = 69;
    const networkId = "kovan-ovm";
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            // TODO: Remove into env
            jsonRpcUrl:
              "https://opt-kovan.g.alchemy.com/v2/pfOaw3tye3hUXAWJcP115s1h1RsoYp8A",
            blockNumber: 3236641,
          },
        },
      ],
    });

    const whaleAddress = "0x15aDBea538f541271dA5E4436E41285e386E3336";

    const balance = await ethers.provider.getBalance(
      "0xD34F2e9916473C5eFA8A255f5b8738eCd4205317"
    );

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whaleAddress],
    });

    const lyraGlobal = await getGlobalDeploys(networkId);
    console.log("contract name:", lyraGlobal.SynthetixAdapter.contractName);
    console.log("address:", lyraGlobal.SynthetixAdapter.address);

    let lyraMarket = await getMarketDeploys(networkId, "sETH");
    const whale = await ethers.getSigner(whaleAddress);
    const sETH = new Contract(
      lyraMarket.BaseAsset.address,
      lyraMarket.BaseAsset.abi,
      whale
    ) as ERC20;
    const sUSD = new Contract(
      lyraGlobal.QuoteAsset.address,
      lyraGlobal.QuoteAsset.abi,
      deployer
    );

    await sETH.transfer(deployer.address, ethers.utils.parseEther("100"));

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
      "@lyrafinance/protocol/contracts/lib/BlackScholes.sol:BlackScholes":
        lyraGlobal.BlackScholes.address,
    };
    const LyraStrategyFactory = new HackMoneyStrategy__factory(
      linkAddresses,
      deployer
    );
    const lyraStrategy = await LyraStrategyFactory.connect(deployer).deploy(
      lyraVault.address,
      OptionType.SHORT_CALL_BASE,
      lyraGlobal.GWAV.address
    );

    const BasicFeeCounterFactory = new BasicFeeCounter__factory(deployer);
    const feeCounter = await BasicFeeCounterFactory.connect(deployer).deploy();

    await lyraStrategy
      .connect(deployer)
      .initAdapter(
        DEPLOYED_CONTRACTS.CurveAddress[chainId],
        lyraMarket.OptionToken.address,
        lyraMarket.OptionMarket.address,
        lyraMarket.LiquidityPool.address,
        lyraMarket.ShortCollateral.address,
        lyraGlobal.SynthetixAdapter.address,
        lyraMarket.OptionMarketPricer.address,
        lyraMarket.OptionGreekCache.address,
        sUSD.address,
        sETH.address,
        feeCounter.address
      );

    await lyraVault.connect(deployer).setStrategy(lyraStrategy.address);
    await lyraStrategy.connect(deployer).setStrategyDetail(strategyDetail);

    let vaultBalance = await lyraVault.totalBalance();
    expect(vaultBalance).to.equal("0");

    await sETH.connect(deployer).approve(lyraVault.address, MAX_UINT);
    await lyraVault.deposit(ethers.utils.parseEther("10"));

    vaultBalance = await lyraVault.totalBalance();
    expect(vaultBalance).to.equal(ethers.utils.parseEther("10"));

    await lyraVault.startNextRound("3");

    vaultBalance = await lyraVault.totalBalance();
    expect(vaultBalance).to.equal(ethers.utils.parseEther("10"));

    await lyraVault.deposit(ethers.utils.parseEther("1"));

    vaultBalance = await lyraVault.totalBalance();
    expect(vaultBalance).to.equal(ethers.utils.parseEther("11"));
    await expect(lyraVault.trade(5))
      .to.emit(lyraVault, "Trade")
      .withArgs(deployer.address, 182, 183, 1817, 10);

    vaultBalance = await lyraVault.totalBalance();
    expect(vaultBalance).to.equal(ethers.utils.parseEther("11"));
  });
});
