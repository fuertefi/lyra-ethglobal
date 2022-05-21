import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import { task } from "hardhat/config";
import { DEPLOYED_CONTRACTS } from "../constants";
import { HackMoneyStrategy__factory } from "../typechain-types/factories/HackMoneyStrategy__factory";

task("collateral", "Get strategy collateral").setAction(async (_, hre) => {
  const chainId = hre.network.config.chainId;
  if (!chainId) return;
  const strategyAddress = DEPLOYED_CONTRACTS.HackMoneyStrategy[chainId];
  const [deployer] = await hre.ethers.getSigners();

  const hackMoneyVault = HackMoneyStrategy__factory.connect(
    strategyAddress,
    deployer
  );

  console.log(await hackMoneyVault.collateralAsset());
});

module.exports = {};
