import { StrategyUpdated } from "../generated/HackMoneyVault/HackMoneyVault";
import { getOrCreateStrategy, getOrCreateVault } from "./utils";

export function handleStrategyUpdated(event: StrategyUpdated): void {
  let strategy = getOrCreateStrategy(event.params.strategy);
  strategy.createdAt = event.block.timestamp;
  strategy.transactionHash = event.transaction.hash;

  let vault = getOrCreateVault();
  vault.strategy = strategy.id;
  strategy.vault = vault.id;

  strategy.save();
  vault.save();
}
