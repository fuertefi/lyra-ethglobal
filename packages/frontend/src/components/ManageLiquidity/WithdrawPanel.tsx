import { Tooltip } from "antd";
import { BigNumber, ethers } from "ethers";
import { useAtom } from "jotai";
import styled from "styled-components";
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
  value: BigNumber;
  token: Token | undefined;
  tooltip: string;
}

const WithdrawItem = ({ label, value: itemValue, token, tooltip }: WithdrawItemProps) => {
  const [ _, setValue ] = useAtom(inputAtom);
  // only display 7 decimal points
  const itemValueDisplay = (+ethers.utils.formatUnits(itemValue, token?.decimals)).toFixed(7);
  const handleItemValueClick = () => {
    setValue(ethers.utils.formatUnits(itemValue, token?.decimals));
  }
  return (
    <>
      <WithdrawItemContainer>
        <span>
          <span style={{ cursor: "pointer" }} onClick={handleItemValueClick}>
            {label}
          </span>
          <Tooltip placement="right" title={tooltip} color="#404349">
            <InfoIcon src="/info_icon.svg" alt="" />
          </Tooltip>
        </span>
        <span>{itemValueDisplay} {token?.symbol}</span>
      </WithdrawItemContainer>
      <hr style={{ border: "1px solid #414447", width: "100%" }} />
    </>
  );
};

interface Props {
  balance: BalanceDestructured;
}

export const WithdrawPanel = ({ balance }: Props) => {
  console.log(balance)
  const position = balance.availableNowValue
    .add(balance.lockedInStrategyValue)
    .add(balance.pendingUnlockValue);
  return (
    <>
      <CurrencyInput currency={balance.token?.symbol} maxAmount={ethers.utils.formatUnits(position, balance.token?.decimals)} />
      <div>
        <WithdrawItem
          label="available now"
          value={balance.availableNowValue}
          token={balance.token}
          tooltip="This is equal to the value of your funds that are currently not invested in the vault's weekly strategy. These funds can be withdrawn from the vault immediately."
        />
        <WithdrawItem
          label="locked in strategy"
          value={balance.lockedInStrategyValue}
          token={balance.token}
          tooltip="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        />
        <WithdrawItem
          label="pending unlock"
          value={balance.pendingUnlockValue}
          token={balance.token}
          tooltip="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        />
      </div>
      <ActionButton>Withdraw</ActionButton>
    </>
  );
};
