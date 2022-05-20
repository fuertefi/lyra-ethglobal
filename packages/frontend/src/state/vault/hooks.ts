import HackMoneyVaultABI from "contracts/abi/HackMoneyVault.json";
import { DEPLOYED_CONTRACTS } from "contracts/constants";
import { useContractRead, useNetwork } from "wagmi";

export const useVault = (method: string, args: any[]) => {
  const network = useNetwork();
  return useContractRead(
    {
      addressOrName:
        DEPLOYED_CONTRACTS.LyraVault[network.activeChain?.id || 69],
      contractInterface: HackMoneyVaultABI,
    },
    method,
    { watch: true, args }
  );
};
