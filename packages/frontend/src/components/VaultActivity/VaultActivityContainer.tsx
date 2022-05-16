import styled from "styled-components";
import { useEffect, useState } from "react";
import { LoadingOutlined } from "@ant-design/icons";
import {
  getVaultActivityData,
  VaultActivityData,
} from "../../pages/api/vaultActivityServices";
import { VaultActivityEntry } from "./VaultActivityEntry";

const Header = styled.header`
  font-weight: 700;
  font-family: "Satoshi";
  margin-bottom: 8px;
  margin-top: 50px;
`;

export const VaultActivityContainer = () => {
  const [activityData, setActivityData] = useState<VaultActivityData>();

  useEffect(() => {
    // simulate an API request for fetching vault activity data
    const delayMilliseconds = 1250;
    let timer = setTimeout(
      () => setActivityData(getVaultActivityData()),
      delayMilliseconds
    );
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div>
      <Header>Vault Activity</Header>
      {!activityData && <LoadingOutlined />}
      {activityData &&
        activityData
          .getEntries()
          .map((entry, i) => <VaultActivityEntry key={i} data={entry} />)}
    </div>
  );
};
