import { VaultActivityEntryData } from "../../pages/api/vaultActivityServices";

interface Props {
  data: VaultActivityEntryData;
}

export const VaultActivityEntry = ({ data }: Props) => {
  return <div>{data.type}</div>;
};
