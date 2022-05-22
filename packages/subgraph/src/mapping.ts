import { Address, BigInt } from "@graphprotocol/graph-ts";
import { HackMoneyStrategy } from "../generated/HackMoneyVault/HackMoneyStrategy";
import {
  HackMoneyVault,
  RoundStarted,
  StrategyUpdated,
  Trade,
} from "../generated/HackMoneyVault/HackMoneyVault";
import {
  getOrCreateRound,
  getOrCreateStrategy,
  getOrCreateVault,
} from "./utils";

export function handleStrategyUpdated(event: StrategyUpdated): void {
  let strategy = getOrCreateStrategy(event.params.strategy);
  strategy.createdAt = event.block.timestamp;
  strategy.transactionHash = event.transaction.hash;

  let vault = getOrCreateVault();
  vault.strategy = strategy.id;
  strategy.vault = vault.id;

  let hackMoneyVault = HackMoneyVault.bind(event.address);
  let vaultState = hackMoneyVault.vaultState();
  let currentRound = BigInt.fromI32(vaultState.value0);
  let round = getOrCreateRound(currentRound);

  vault.round = round.id;
  strategy.save();
  vault.save();
}

export function handleRoundStarted(event: RoundStarted): void {
  let round = getOrCreateRound(BigInt.fromI32(event.params.roundId));
  round.lockedAmount = event.params.lockAmount;
  round.roundInProgress = true;
  round.createdAt = event.block.timestamp;

  let vault = getOrCreateVault();
  let strategyAddress = vault.strategy;
  let strategyContract = HackMoneyStrategy.bind(
    Address.fromString(strategyAddress!)
  );
  round.expiry = strategyContract.activeExpiry();

  round.save();
  vault.round = round.id;
  vault.save();
}

export function handleTrade(event: Trade): void {
  let hackMoneyVault = HackMoneyVault.bind(event.address);
  let vaultState = hackMoneyVault.vaultState();
  let currentRound = BigInt.fromI32(vaultState.value0);
  let round = getOrCreateRound(currentRound);

  let positions = round.positions;
  let i = positions.indexOf(event.params.positionId_1)
  if (i == -1) {
    positions.push(event.params.positionId_1)
  }
  i = positions.indexOf(event.params.positionId_2)
  if (i == -1) {
    positions.push(event.params.positionId_2)
  }
  round.positions = positions;

  round.size = round.size.plus(event.params.capitalUsed);
  round.premiumReceived = round.premiumReceived.plus(event.params.premium);
  round.save();
}
