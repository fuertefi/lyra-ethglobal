import { Tooltip } from "antd";
import styled from "styled-components";
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
  value: string;
  tooltip: string;
}

const WithdrawItem = ({ label, value, tooltip }: WithdrawItemProps) => {
  return (
    <>
      <WithdrawItemContainer>
        <span>
          {label}
          <Tooltip placement="right" title={tooltip} color="#404349">
            <InfoIcon src="/info_icon.svg" alt="" />
          </Tooltip>
        </span>
        <span>{value}</span>
      </WithdrawItemContainer>
      <hr style={{ border: "1px solid #414447", width: "100%" }} />
    </>
  );
};

export const WithdrawPanel = () => {
  return (
    <>
      <CurrencyInput />
      <div>
        <WithdrawItem
          label="available now"
          value="0.5 ETH"
          tooltip="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        />
        <WithdrawItem
          label="locked in strategy"
          value="1 ETH"
          tooltip="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        />
        <WithdrawItem
          label="pending unlock"
          value="0 ETH"
          tooltip="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        />
      </div>
      <ActionButton>Withdraw</ActionButton>
    </>
  );
};
