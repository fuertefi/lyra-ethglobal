import { Market } from "@lyrafinance/lyra-js";
import { message } from "antd";
import HackMoneyVaultABI from "contracts/abi/HackMoneyVault.json";
import { BigNumber, utils } from "ethers";
import { useAtomValue } from "jotai";
import styled from "styled-components";
import {
  erc20ABI,
  useBalance,
  useContractRead,
  useContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { inputAtom } from "../../state/position/atoms";
import { ActionButton } from "./ActionButton";
import CurrencyInput from "./CurrencyInput";

const DepositDisclaimer = styled.div`
  font-size: 12px;
  letter-spacing: 0.05em;
`;

interface Props {
  market: Market | undefined;
  account: any;
  lyraVaultAddress: string;
}

export const DepositPanel = ({ market, account, lyraVaultAddress }: Props) => {
  const { data: balanceData } = useBalance({
    addressOrName: account.data?.address,
    token: market?.baseToken.address,
    formatUnits: market?.baseToken.decimals,
  });

  const { data: allowance } = useContractRead(
    {
      addressOrName: market?.baseToken.address || "",
      contractInterface: erc20ABI,
    },
    "allowance",
    {
      args: [account?.data?.address, lyraVaultAddress],
      watch: true,
    }
  );

  var depositValue = useAtomValue(inputAtom);
  if (isNaN(+(depositValue as string))) {
    depositValue = "0";
  }

  const { data: approvalData, write: approve } = useContractWrite(
    {
      addressOrName: market?.baseToken.address || "",
      contractInterface: erc20ABI,
    },
    "approve",
    {
      args: [
        lyraVaultAddress,
        utils.parseUnits(depositValue || "0", market?.baseToken.decimals),
      ],
    }
  );

  const { isLoading: approvalIsPending } = useWaitForTransaction({
    hash: approvalData?.hash,
    confirmations: 2,
  });

  const enoughAllowance = allowance?.gte(
    BigNumber.from(
      utils.parseUnits(depositValue || "0", market?.baseToken.decimals)
    )
  );

  const { data: depositData, write: deposit } = useContractWrite(
    {
      addressOrName: lyraVaultAddress,
      contractInterface: HackMoneyVaultABI,
    },
    "deposit",
    {
      args: [utils.parseUnits(depositValue || "0", market?.baseToken.decimals)],
    }
  );

  const { isLoading: depositIsPending } = useWaitForTransaction({
    hash: depositData?.hash,
    confirmations: 2,
  });

  const handleDepositClick = () => {
    const key = "updatable";
    message.loading({
      content: "Request submitted to the blockchain, waiting...",
      key,
    });
    setTimeout(() => {
      message.success({
        icon: <></>,
        content: (
          <div style={{ display: "grid", gridTemplateColumns: "40px auto" }}>
            <div style={{ alignContent: "middle" }}>
              <img src="/check_icon.svg" width="40" />
            </div>
            <div style={{ marginLeft: "15px", textAlign: "left" }}>
              <span style={{ color: "#06C799" }}>DEPOSIT SUCCESS!</span>
              <br />5 ETH deposited into STRATEGY_NAME
            </div>
          </div>
        ),
        key,
        duration: 5,
      });
    }, 2000);
  };

  return (
    <>
      <CurrencyInput
        currency={market?.baseToken.symbol}
        maxAmount={balanceData?.formatted}
      />
      {enoughAllowance ? (
        <ActionButton
          disabled={depositIsPending}
          onClick={() => {
            deposit();
          }}
        >
          {depositIsPending ? "Depositing..." : "Deposit"}
        </ActionButton>
      ) : (
        <ActionButton
          disabled={approvalIsPending}
          onClick={() => {
            approve();
          }}
        >
          {approvalIsPending ? "Approving..." : "Approve"}
        </ActionButton>
      )}
      <DepositDisclaimer>
        Your deposit will be deployed in the vault's weekly strategy on Friday
        at 11am UTC
      </DepositDisclaimer>
    </>
  );
};