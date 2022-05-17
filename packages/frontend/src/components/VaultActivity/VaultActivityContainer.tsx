import styled from "styled-components";
import { useEffect, useState } from "react";
import { LoadingOutlined } from "@ant-design/icons";
import {
  getVaultActivityData,
  VaultActivityData,
} from "../../pages/api/vaultActivityServices";
import { VaultActivityEntry } from "./VaultActivityEntry";

const SectionHeader = styled.header`
  font-weight: 700;
  font-family: "Satoshi";
  margin-bottom: 50px;
  margin-top: 50px;
`;

const ContainerHeader = styled.div`
  display: inline-grid;
  width: 100%;
  grid-template-columns: 50px 1fr 1fr 1fr 1fr;
  padding: 20px 24px;
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
    <>
      <SectionHeader>Vault Activity</SectionHeader>
      {!activityData && <LoadingOutlined />}
      {activityData && (
        <>
          <ContainerHeader>
            <div></div>
            <div>Action</div>
            <div>Contract</div>
            <div>Quantity</div>
            <div>Yield</div>
          </ContainerHeader>
          {activityData.getEntries().map((entry, i) => (
            <VaultActivityEntry key={i} data={entry} />
          ))}
        </>
      )}
    </>
  );
};
