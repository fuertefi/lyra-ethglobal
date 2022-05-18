import { subDays } from "date-fns";

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
  yieldValueEth: number;
  yieldValueUsdc: number;
}

export class VaultActivityData {
  entries = Array<VaultActivityEntryData>();

  constructor() {
    addTestData(this.entries);
  }

  getEntries(
    sorting: VaultActivitySorting = VaultActivitySorting.SORT_BY_LATEST
  ) {
    // TODO implement different sortings
    return this.entries;
  }
}

export const getVaultActivityData = (): VaultActivityData => {
  return new VaultActivityData();
};

const addTestData = (entries: Array<VaultActivityEntryData>) => {
  entries.push({
    type: VaultActivityType.SOLD_CONTRACTS,
    datetime: subDays(new Date(), 19),
    contractName: "0-WETH 4/29 CALL",
    contractDescription: "Strike 3300",
    quantity: 26335.69851,
    yieldValueEth: 110.609734,
    yieldValueUsdc: 193961.6,
  });
  entries.push({
    type: VaultActivityType.MINTED_CONTRACTS,
    datetime: subDays(new Date(), 16),
    contractName: "0-WETH 4/29 CALL",
    contractDescription: "Strike 3300",
    quantity: 26335.69851,
    yieldValueEth: 0,
    yieldValueUsdc: 0,
  });
  entries.push({
    type: VaultActivityType.SOLD_CONTRACTS,
    datetime: subDays(new Date(), 11),
    contractName: "0-WETH 4/29 CALL",
    contractDescription: "Strike 3300",
    quantity: 26335.69851,
    yieldValueEth: -110.609734,
    yieldValueUsdc: -193961.6,
  });
  entries.push({
    type: VaultActivityType.MINTED_CONTRACTS,
    datetime: subDays(new Date(), 7),
    contractName: "0-WETH 4/29 CALL",
    contractDescription: "Strike 3300",
    quantity: 26335.69851,
    yieldValueEth: 0,
    yieldValueUsdc: 0,
  });
};
