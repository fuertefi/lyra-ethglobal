import { Tabs } from "antd";
import { DEPLOYED_CONTRACTS } from "contracts/constants";
import { BigNumber } from "ethers";
import { FC, ReactElement } from "react";
import styled from "styled-components";
import { useAccount, useNetwork } from "wagmi";
import { useLyraMarket } from "../../state/lyra/hooks/getMarket";
import { useVault } from "../../state/vault/hooks";
import { lightGray } from "../../theme";
import { FlexColumn } from "../styles";
import { DepositPanel } from "./DepositPanel";
import { WithdrawPanel } from "./WithdrawPanel";
import YourPosition from "./YourPosition";

const { TabPane } = Tabs;

const LiquidityWidget = styled.div`
  border: 1px solid #414447;
  border-radius: 10px;
  background-color: ${(props) => props.theme.position.bg};
`;

const TabsWrapper = styled.div`
  .ant-tabs-nav::before {
    border-bottom: none !important;
  }

  .ant-tabs-nav-list {
    width: 100%;
    display: flex;
  }

  .ant-tabs-tab {
    padding: 15px 0px 10px;
    width: 100%;
    display: flex;
    justify-content: center;
    letter-spacing: 0.12em;
    font-weight: 500;
    &:not(.ant-tabs-tab-active) {
      cursor: pointer;
      background-color: ${(props) => props.theme.position.tabs.inactive.bg};
      color: ${(props) => props.theme.position.tabs.inactive.color};
      :hover {
        color: ${lightGray};
      }
    }
  }
`;

const SmartContractLink = styled.div`
  text-align: center;
  margin-top: 9px;
  font-family: "Satoshi";
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

const renderTabBar = (props: any, DefaultTabBar: any): ReactElement => (
  <TabsWrapper>
    <DefaultTabBar {...props} />
  </TabsWrapper>
);

const TabContent = styled(FlexColumn)`
  padding: 25px;
  gap: 25px;
`;

const ManageLiquidity: FC = (props: any) => {
  const market = useLyraMarket();
  const account = useAccount();

  // FIXME: Should be account vault balance, but the shares user have in the first round is 0. Otherwise we need to use both sums for current round deposit and shares user have
  // const { data: accountVaultBalance } = useVault('accountVaultBalance', []);
  const { data: depositReceipt } = useVault("depositReceipts", [
    account.data?.address,
  ]);
  const accountVaultBalance = depositReceipt && depositReceipt[1];
  const network = useNetwork();
  const lyraVaultAddress =
    DEPLOYED_CONTRACTS.LyraVault[network.activeChain?.id || 69];

  // TODO: add contract query on position

  return (
    <>
      <LiquidityWidget>
        <YourPosition
          position={(accountVaultBalance as unknown as BigNumber) || 0}
          token={market?.baseToken}
        />
        <Tabs centered defaultActiveKey="1" renderTabBar={renderTabBar}>
          <TabPane tab="DEPOSIT" key="1">
            <TabContent>
              <DepositPanel
                market={market}
                account={account}
                lyraVaultAddress={lyraVaultAddress}
              />
            </TabContent>
          </TabPane>
          <TabPane tab="WITHDRAW" key="2">
            <TabContent>
              <WithdrawPanel />
            </TabContent>
          </TabPane>
        </Tabs>
      </LiquidityWidget>
      <SmartContractLink>
        contract: {shortenAddress(lyraVaultAddress)}
        &nbsp;
        <a
          href={`${network?.activeChain?.blockExplorers?.etherscan.url}/address/${lyraVaultAddress}`}
          target="_blank"
        >
          <img src="external_link_icon.svg" />
        </a>
      </SmartContractLink>
    </>
  );
};

function shortenAddress(address: string) {
  return address?.slice(0, 6) + "..." + address?.slice(-4);
}

export default ManageLiquidity;