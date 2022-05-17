import { differenceInDays } from "date-fns";
import styled from "styled-components";
import {
  VaultActivityEntryData,
  VaultActivityType,
} from "../../pages/api/vaultActivityServices";

const ContainerItem = styled.div`
  display: grid;
  width: 100%;
  grid-template-columns: 25px 1fr 1fr 1fr 1fr 25px;
  grid-gap: 14px;
  box-sizing: border-box;
  background: ${({ theme }) => theme.metrics.background};
  border: ${({ theme }) => theme.metrics.border};
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 15px;
  align-items: center;
`;

const CellHeadline = styled.span`
  color: white;
  text-transform: uppercase;
`;

const EthValue = styled.span`
  color: #06C799;
`;

const EthNegValue = styled.span`
  color: IndianRed;
`;

interface Props {
  data: VaultActivityEntryData;
}

export const VaultActivityEntry = ({ data }: Props) => {
  const iconImg =
    data.type == VaultActivityType.MINTED_CONTRACTS
      ? "minted_contract_icon.svg"
      : "sold_contract_icon.svg";
  return (
    <ContainerItem>
      <div>
        <img alt="" width="25" src={iconImg} />
      </div>
      <div>
        <CellHeadline>
          {data.type == VaultActivityType.MINTED_CONTRACTS
            ? "MINTED CONTRACTS"
            : "SOLD CONTRACTS"}
        </CellHeadline>
        <br />
        {daysAgo(data.datetime)} days ago
      </div>
      <div>
        <CellHeadline>{data.contractName}</CellHeadline>
        <br />
        {data.contractDescription}
      </div>
      <div style={{ textAlign: "center" }}>
        <CellHeadline>{formatValue(data.quantity)}</CellHeadline>
      </div>
      <div style={{ textAlign: "right" }}>
        {data.yieldValueEth >= 0 && <EthValue>{formatEth(data.yieldValueEth)}</EthValue>}
        {data.yieldValueEth < 0 && <EthNegValue>{formatEth(data.yieldValueEth)}</EthNegValue>}
        <br /> {formatUsdc(data.yieldValueUsdc)}
      </div>
      <div style={{ textAlign: "center" }}>
        <img src="/external_link_icon.svg" alt="" />
      </div>
    </ContainerItem>
  );
};

const formatValue = (v: number, minimumFractionDigits: number = 5): string => {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits }).format(Math.abs(v));  
}

const formatEth = (v: number): string => {
  if (v == 0) return "-";
  return (v > 0 ? "+" : "-") + formatValue(v, 6) + " ETH";
}

const formatUsdc = (v: number): string => {
  if (v == 0) return "-";
  return (v > 0 ? "+" : "-") + "$" + formatValue(v, 2);
}

const daysAgo = (aDate: Date) => {
  return differenceInDays(new Date(), aDate);
};
