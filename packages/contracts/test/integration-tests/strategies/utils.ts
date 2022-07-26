import { OptionMarket } from "@lyrafinance/protocol/dist/typechain-types";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

export async function strikeIdToDetail(
  optionMarket: OptionMarket,
  strikeId: BigNumber,
) {
  const [strike, board] = await optionMarket.getStrikeAndBoard(strikeId);
  return {
    id: strike.id,
    expiry: board.expiry,
    strikePrice: strike.strikePrice,
    skew: strike.skew,
    boardIv: board.iv,
  };
}

export async function queryAdmin(contractAddress: string): Promise<string> {
  const admin = await ethers.provider.getStorageAt(
    contractAddress,
    "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
  );
  console.log(admin);
  const abiCoder = new ethers.utils.AbiCoder();
  const [adminAddress] = abiCoder.decode(["address"], admin);
  return adminAddress;
}
