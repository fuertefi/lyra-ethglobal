import Lyra, { Deployment } from "@lyrafinance/lyra-js";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { lyraMarketAtom } from "../atoms";

export const useGetLyraMarket = () => {
  const lyra = new Lyra(Deployment.Kovan);
  const setMarket = useSetAtom(lyraMarketAtom);

  const getLyraMarket = useCallback(async () => {
    const market = await lyra.market("eth");
    setMarket(market);
  }, []);

  return getLyraMarket;
};

export const useLyraMarket = () => {
  const market = useAtomValue(lyraMarketAtom);
  return market;
};
