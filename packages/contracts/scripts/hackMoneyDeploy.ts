import {
  getGlobalDeploys,
  getMarketDeploys,
  lyraConstants,
} from "@lyrafinance/protocol";
import {
  OptionType,
  toBN,
  ZERO_ADDRESS,
} from "@lyrafinance/protocol/dist/scripts/util/web3utils";
import { Contract, ethers } from "ethers";
import { DEPLOYED_CONTRACTS } from "../constants";
import {
  BasicFeeCounter__factory,
  HackMoneyStrategy__factory,
  LyraVault__factory,
} from "../typechain-types";
import { HackMoneyStrategyLibraryAddresses } from "../typechain-types/factories/HackMoneyStrategy__factory";
import { HackMoneyStrategyDetailStruct } from "../typechain-types/HackMoneyStrategy";

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
  size: toBN("15"),
};

// TODO: get network config from name
async function main() {
  /////////////////////////////////////
  // Deploy Lyra market on localhost //
  /////////////////////////////////////

  // 1. get local deployer and network
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.RPC_PROVIDER
  );

  const privateKey = process.env.PRIVATE_KEY; // enter address with ETH
  const deployer = new ethers.Wallet(privateKey!, provider);

  const lyraGlobal = await getGlobalDeploys(process.env.NETWORK_ID);
  console.log("contract name:", lyraGlobal.SynthetixAdapter.contractName);
  console.log("address:", lyraGlobal.SynthetixAdapter.address);

  let lyraMarket = await getMarketDeploys(process.env.NETWORK_ID, "sETH");
  const sETH = new Contract(
    lyraMarket.BaseAsset.address,
    lyraMarket.BaseAsset.abi,
    deployer
  );
  const sUSD = new Contract(
    lyraGlobal.QuoteAsset.address,
    lyraGlobal.QuoteAsset.abi,
    deployer
  );

  const LyraVaultFactory = new LyraVault__factory(deployer);
  const decimals = 18;
  const cap = ethers.utils.parseEther("100"); // 100 ETH
  const lyraVault = await LyraVaultFactory.connect(deployer).deploy(
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

  // const lyraVault = LyraVault__factory.connect(
  // "0xf8c3b27c5175c04839e7073a805f195bcf812840",
  // deployer
  // );
  // const lyraStrategy = HackMoneyStrategy__factory.connect(
  // "0x7d855253CEE122b554A5f4eC4aD5F7c1a0D57131",
  // deployer
  // );

  const BasicFeeCounterFactory = new BasicFeeCounter__factory(deployer);
  const feeCounter = await BasicFeeCounterFactory.connect(deployer).deploy();

  await lyraStrategy
    .connect(deployer)
    .initAdapter(
      DEPLOYED_CONTRACTS.CurveAddress[provider.network.chainId],
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
