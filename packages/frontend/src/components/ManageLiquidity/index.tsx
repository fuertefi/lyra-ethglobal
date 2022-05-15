import { Tabs } from "antd";
import { FC, ReactElement } from "react";
import { ethers } from "ethers";
import styled from "styled-components";
import { FlexColumn } from "../styles";
import Button from "../Button";
import YourPosition from "./YourPosition";
import CurrencyInput from "./CurrencyInput";
import { lightGray } from "../../theme";

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

const renderTabBar = (props: any, DefaultTabBar: any): ReactElement => (
  <TabsWrapper>
    <DefaultTabBar {...props} />
  </TabsWrapper>
);

const ActionButton = styled(Button)`
  font-size: 18px;
  font-weight: bold;
  background: radial-gradient(
    93.99% 86.5% at 51.43% 106.5%,
    #0699c7 0%,
    #06c799 49.41%,
    #06c799 100%
  );
  background-size: 100% 100px;
  background-position: 0;
  animation-duration: 0.3s;
  animation-name: buttonHoverOut;
  :hover {
    animation-name: buttonHoverIn;
    background-position: 0 -50px;
  }
`;

const TabContent = styled(FlexColumn)`
  padding: 25px;
  gap: 25px;
`;

const DepositDisclaimer = styled.div`
  font-size: 12px;
  letter-spacing: 0.05em;
`;

const ManageLiquidity: FC = (props: any) => {
  // TODO: add contract query on position
  console.log(props.theme);
  return (
    <LiquidityWidget>
      <YourPosition position={ethers.utils.parseUnits("1", 6)} />
      <Tabs centered defaultActiveKey="1" renderTabBar={renderTabBar}>
        <TabPane tab="DEPOSIT" key="1">
          <TabContent>
            <CurrencyInput currency="USDC" />
            <ActionButton>Deposit</ActionButton>
            <DepositDisclaimer>
              Your deposit will be deployed in the vault's weekly strategy on
              Friday at 11am UTC
            </DepositDisclaimer>
          </TabContent>
        </TabPane>
        <TabPane tab="WITHDRAW" key="2">
          <TabContent>
            <CurrencyInput />
            <ActionButton>Withdraw</ActionButton>
          </TabContent>
        </TabPane>
      </Tabs>
    </LiquidityWidget>
  );
};

export default ManageLiquidity;
