import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import { ethers } from "ethers";
import { task } from "hardhat/config";
import { DEPLOYED_CONTRACTS } from "../constants";
import { CSVault__factory } from "../typechain-types";

task("trade", "Trade in new round").setAction(async (_, hre) => {
  const chainId = hre.network.config.chainId;
  if (!chainId) return;
  const vaultAddress = DEPLOYED_CONTRACTS.LyraVault[chainId];
  const [deployer] = await hre.ethers.getSigners();

  const hackMoneyVault = CSVault__factory.connect(vaultAddress, deployer);

  await hackMoneyVault.trade(ethers.utils.parseEther("0.05"));
});

module.exports = {};
