import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Round, Strategy, Vault } from "../generated/schema";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function getOrCreateStrategy(_address: Address): Strategy {
  let strategy = Strategy.load(_address.toHexString());
  if (!strategy) {
    strategy = new Strategy(_address.toHexString());
    strategy.createdAt = BigInt.fromI32(0);
    strategy.transactionHash = Bytes.fromI32(0);
    strategy.save();
  }
  return strategy as Strategy;
}

export function getOrCreateVault(): Vault {
  let vault = Vault.load("0");
  if (!vault) {
    vault = new Vault("0");
    vault.address = Bytes.fromHexString(ZERO_ADDRESS);
    vault.save();
  }
  return vault as Vault;
}

export function getOrCreateRound(_id: BigInt): Round {
  let round = Round.load(_id.toString());
  if (!round) {
    round = new Round(_id.toString());
    round.save();
  }
  return round as Round;
}
