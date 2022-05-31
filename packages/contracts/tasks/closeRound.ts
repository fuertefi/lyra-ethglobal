import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import { task } from "hardhat/config";
import { DEPLOYED_CONTRACTS } from "../constants";
import { HackMoneyVault__factory } from "../typechain-types/factories/HackMoneyVault__factory";

task("closeRound", "Close round").setAction(async (_, hre) => {
  const chainId = hre.network.config.chainId;
  if (!chainId) return;
  const vaultAddress = DEPLOYED_CONTRACTS.LyraVault[chainId];
  const [deployer] = await hre.ethers.getSigners();

  const hackMoneyVault = HackMoneyVault__factory.connect(
    vaultAddress,
    deployer
  );

  await hackMoneyVault.closeRound();
});

module.exports = {};
