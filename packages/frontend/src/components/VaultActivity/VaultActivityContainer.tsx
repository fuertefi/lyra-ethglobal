import styled from "styled-components";
import { useEffect, useState } from "react";
import { LoadingOutlined } from "@ant-design/icons";
import {
  getVaultActivityData,
  VaultActivityData,
  VaultActivitySorting,
} from "../../pages/api/vaultActivityServices";
import { VaultActivityEntry } from "./VaultActivityEntry";

const SectionHeader = styled.header`
  font-weight: 700;
  font-family: "Satoshi";
  margin-top: 40px;
  margin-bottom: 20px;
`;

const ContainerHeader = styled.div`
  display: inline-grid;
  width: 100%;
  box-sizing: border-box;
  grid-template-columns: 25px 1fr 1fr 1fr 1fr 25px;
  grid-gap: 14px;
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
            <div style={{ textAlign: "center" }}>Quantity</div>
            <div style={{ textAlign: "right" }}>Yield</div>
            <div></div>
          </ContainerHeader>
          {activityData
            .getEntries(VaultActivitySorting.SORT_BY_LATEST)
            .map((entry, i) => (
              <VaultActivityEntry key={i} data={entry} />
            ))}
        </>
      )}
    </>
  );
};
