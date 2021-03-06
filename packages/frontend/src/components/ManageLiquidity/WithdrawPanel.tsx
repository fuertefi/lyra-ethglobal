import { Market } from "@lyrafinance/lyra-js";
import { Tooltip } from "antd";
import HackMoneyVaultABI from "contracts/abi/HackMoneyVault.json";
import { BigNumber, ethers, utils } from "ethers";
import { useAtom, useAtomValue } from "jotai";
import styled from "styled-components";
import { useContractWrite, useWaitForTransaction } from "wagmi";
import { BalanceDestructured, Token } from ".";
import { inputAtom } from "../../state/position/atoms";
import { ActionButton } from "./ActionButton";
import CurrencyInput from "./CurrencyInput";

const WithdrawItemContainer = styled.div`
  display: flex;
  justify-content: space-between;
  color: #99a0ab;
  font-family: "Satoshi";
  font-weight: 400;
  font-size: 12px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  height: 25px;
  line-height: 25px;
`;

const InfoIcon = styled.img`
  filter: invert(25%) sepia(15%) saturate(266%) hue-rotate(182deg)
    brightness(95%) contrast(92%);
  width: 20px;
  height: 20px;
  margin-left: 10px;
`;

interface WithdrawItemProps {
  label: string;
  itemValue: BigNumber;
  token: Token | undefined;
  tooltip: string;
  isClickable?: boolean;
}

const WithdrawItem = ({
  label,
  itemValue,
  token,
  tooltip,
  isClickable = true,
}: WithdrawItemProps) => {
  const [_, setValue] = useAtom(inputAtom);
  // only display 7 decimal points
  const itemValueDisplay = (+ethers.utils.formatUnits(
    itemValue,
    token?.decimals
  )).toFixed(7);
  const handleItemValueClick = () => {
    setValue(ethers.utils.formatUnits(itemValue, token?.decimals));
  };
  return (
    <>
      <WithdrawItemContainer>
        <span>
          {isClickable ? (
            <span style={{ cursor: "pointer" }} onClick={handleItemValueClick}>
              {label}
            </span>
          ) : (
            <span>{label}</span>
          )}
          <Tooltip placement="right" title={tooltip} color="#404349">
            <InfoIcon src="/info_icon.svg" alt="" />
          </Tooltip>
        </span>
        <span>
          {itemValueDisplay} {token?.symbol}
        </span>
      </WithdrawItemContainer>
      <hr style={{ border: "1px solid #414447", width: "100%" }} />
    </>
  );
};

interface Props {
  market: Market | undefined;
  account: any;
  lyraVaultAddress: string;
  balance: BalanceDestructured;
}

export const WithdrawPanel = ({
  market,
  account,
  lyraVaultAddress,
  balance,
}: Props) => {
  const position: BigNumber = balance.availableNowValue
    .add(balance.lockedInStrategyValue)
    .add(balance.pendingUnlockValue);
  const maxAmount: BigNumber = balance.availableNowValue.add(
    balance.lockedInStrategyValue
  );
  var withdrawValStr: string = useAtomValue(inputAtom) || "0";
  if (isNaN(+(withdrawValStr))) {
    withdrawValStr = "0";
  }
  const withdrawValBigNumber: BigNumber = utils.parseUnits(withdrawValStr, market?.baseToken.decimals!);
  const { data: withdrawData, write: withdraw } = useContractWrite(
    {
      addressOrName: lyraVaultAddress,
      contractInterface: HackMoneyVaultABI,
    },
    "initiateWithdraw",
    {
      args: [ withdrawValBigNumber ],
    }
  );

  const { isLoading: withdrawIsPending } = useWaitForTransaction({
    hash: withdrawData?.hash,
    confirmations: 2,
  });

  const handleWithdrawClick = () => {
    withdraw();
  };

  return (
    <>
      <CurrencyInput
        currency={balance.token?.symbol}
        maxAmount={ethers.utils.formatUnits(maxAmount, balance.token?.decimals)}
      />
      <div>
        <WithdrawItem
          label="available now"
          itemValue={balance.availableNowValue}
          token={balance.token}
          tooltip="This is equal to the value of your funds that are currently not invested in the vault's weekly strategy. These funds can be withdrawn from the vault immediately."
        />
        <WithdrawItem
          label="locked in strategy"
          itemValue={balance.lockedInStrategyValue}
          token={balance.token}
          tooltip="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        />
        <WithdrawItem
          label="pending unlock"
          itemValue={balance.pendingUnlockValue}
          token={balance.token}
          tooltip="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
          isClickable={false}
        />
      </div>
      <ActionButton
        disabled={withdrawIsPending || position.eq(0)}
        onClick={handleWithdrawClick}
      >
        {balance.availableNowValue.lt(withdrawValBigNumber)
          ? "Request and Withdraw"
          : "Withdraw"}
      </ActionButton>
    </>
  );
};
