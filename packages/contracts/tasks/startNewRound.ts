import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import { task } from "hardhat/config";
import { DEPLOYED_CONTRACTS } from "../constants";
import { CSVault__factory } from "../typechain-types";

task("startNewRound", "Start new round")
  .addParam("boardid", "Board ID")
  .setAction(async ({ boardid }, hre) => {
    const chainId = hre.network.config.chainId;
    if (!chainId) return;
    const vaultAddress = DEPLOYED_CONTRACTS.LyraVault[chainId];
    const [deployer] = await hre.ethers.getSigners();

    const hackMoneyVault = CSVault__factory.connect(vaultAddress, deployer);

    await hackMoneyVault.startNextRound(boardid);
  });

module.exports = {};
