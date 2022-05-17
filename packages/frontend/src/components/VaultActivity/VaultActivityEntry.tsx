import { differenceInDays } from "date-fns";
import styled from "styled-components";
import {
  VaultActivityEntryData,
  VaultActivityType,
} from "../../pages/api/vaultActivityServices";

const ContainerItem = styled.div`
  display: grid;
  width: 100%;
  grid-template-columns: 50px 1fr 1fr 1fr 1fr;
  background: ${({ theme }) => theme.metrics.background};
  border: ${({ theme }) => theme.metrics.border};
  border-radius: 10px;
  padding: 20px 24px;
  margin-bottom: 15px;
`;

interface Props {
  data: VaultActivityEntryData;
}

export const VaultActivityEntry = ({ data }: Props) => {
  return (
    <ContainerItem>
      <div>
        <img
          alt=""
          width="25"
          src={
            data.type == VaultActivityType.MINTED_CONTRACTS
              ? "minted_contract_icon.svg"
              : "sold_contract_icon.svg"
          }
        />
      </div>
      <div>
        {data.type == VaultActivityType.MINTED_CONTRACTS
          ? "MINTED CONTRACTS"
          : "SOLD CONTRACTS"}
        <br />
        {daysAgo(data.datetime)} days ago
      </div>
      <div>
        {data.contractName}
        <br />
        {data.contractDescription}
      </div>
      <div>{data.quantity}</div>
      <div>
        {data.yieldValue} {data.yieldCurrency} <br /> {data.yieldDescription}
      </div>
    </ContainerItem>
  );
};

const daysAgo = (aDate: Date) => {
  return differenceInDays(aDate, new Date());
};
