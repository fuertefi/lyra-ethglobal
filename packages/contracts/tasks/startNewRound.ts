import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import { task } from "hardhat/config";
import { DEPLOYED_CONTRACTS } from "../constants";
import { HackMoneyVault__factory } from "../typechain-types/factories/HackMoneyVault__factory";

task("startNewRound", "Start new round")
  .addParam("boardid", "Board ID")
  .setAction(async ({ boardid }, hre) => {
    const chainId = hre.network.config.chainId;
    if (!chainId) return;
    const vaultAddress = DEPLOYED_CONTRACTS.LyraVault[chainId];
    const [deployer] = await hre.ethers.getSigners();

    const HackMoneyVaultFactory = new HackMoneyVault__factory(deployer);
    const hackMoneyVault = HackMoneyVaultFactory.attach(vaultAddress);

    await hackMoneyVault.startNextRound(boardid);
  });

module.exports = {};
