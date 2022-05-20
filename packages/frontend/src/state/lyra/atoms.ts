import { Market } from "@lyrafinance/lyra-js";
import { atom } from "jotai";

export const lyraMarketAtom = atom<Market | undefined>(undefined);
