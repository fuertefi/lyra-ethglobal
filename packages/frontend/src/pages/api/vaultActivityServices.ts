export enum VaultActivityType {
  SOLD_CONTRACTS,
  MINTED_CONTRACTS,
}

export enum VaultActivitySorting {
  SORT_BY_LATEST,
}

export interface VaultActivityEntryData {
  type: VaultActivityType;
  datetime: Date;
  contractName: string;
  contractDescription: string;
  quantity: number;
  yieldValue: number;
  yieldCurrency: string;
  yieldDescription: string;
}

export class VaultActivityData {
  entries = Array<VaultActivityEntryData>();

  constructor() {
    this.entries.push({
      type: VaultActivityType.SOLD_CONTRACTS,
      datetime: new Date(),
      contractName: "0-WETH 4/29 CALL",
      contractDescription: "Strike 3300",
      quantity: 26335.69851,
      yieldValue: 110.609734,
      yieldCurrency: "ETH",
      yieldDescription: "Strike 3300",
    });
    this.entries.push({
      type: VaultActivityType.MINTED_CONTRACTS,
      datetime: new Date(),
      contractName: "0-WETH 4/29 CALL",
      contractDescription: "Strike 3300",
      quantity: 26335.69851,
      yieldValue: 110.609734,
      yieldCurrency: "ETH",
      yieldDescription: "Strike 3300",
    });
  }

  getEntries(
    sorting: VaultActivitySorting = VaultActivitySorting.SORT_BY_LATEST
  ) {
    return this.entries;
  }
}

export const getVaultActivityData = (): VaultActivityData => {
  return new VaultActivityData();
};
