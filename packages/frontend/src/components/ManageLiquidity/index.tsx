import { Tabs } from "antd";
import HackMoneyVaultABI from "contracts/abi/HackMoneyVault.json";
import { DEPLOYED_CONTRACTS } from "contracts/constants";
import { BigNumber, utils } from "ethers";
import { useAtomValue } from "jotai";
import { FC, ReactElement } from "react";
import styled from "styled-components";
import {
  erc20ABI,
  useAccount,
  useBalance,
  useContractRead,
  useContractWrite,
  useNetwork,
  useWaitForTransaction,
} from "wagmi";
import { useLyraMarket } from "../../state/lyra/hooks/getMarket";
import { depositAtom } from "../../state/position/atoms";
import { useVault } from "../../state/vault/hooks";
import { disabledGray, lightGray } from "../../theme";
import Button from "../Button";
import { FlexColumn } from "../styles";
import CurrencyInput from "./CurrencyInput";
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

  &:disabled {
    background: ${lightGray};
    pointer-events: none;
    color: ${disabledGray};
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
  const market = useLyraMarket();

  const account = useAccount();
  const { data: balanceData } = useBalance({
    addressOrName: account.data?.address,
    token: market?.baseToken.address,
    formatUnits: market?.baseToken.decimals,
  });

  // FIXME: Should be account vault balance, but the shares user have in the first round is 0. Otherwise we need to use both sums for current round deposit and shares user have
  // const { data: accountVaultBalance } = useVault('accountVaultBalance', []);
  const { data: depositReceipt } = useVault("depositReceipts", [
    account.data?.address,
  ]);
  const accountVaultBalance = depositReceipt && depositReceipt[1];

  const network = useNetwork();
  const lyraVaultAddress = DEPLOYED_CONTRACTS.LyraVault[network.activeChain?.id || 69];
  const { data: allowance } = useContractRead(
    {
      addressOrName: market?.baseToken.address || "",
      contractInterface: erc20ABI,
    },
    "allowance",
    {
      args: [
        account?.data?.address,
        lyraVaultAddress
      ],
      watch: true,
    }
  );

  const depositValue = useAtomValue(depositAtom);

  const { data: approvalData, write: approve } = useContractWrite(
    {
      addressOrName: market?.baseToken.address || "",
      contractInterface: erc20ABI,
    },
    "approve",
    {
      args: [
        lyraVaultAddress,
        utils.parseUnits(depositValue || "0", market?.baseToken.decimals),
      ],
    }
  );

  const { isLoading: approvalIsPending } = useWaitForTransaction({
    hash: approvalData?.hash,
    confirmations: 2,
  });

  const enoughAllowance = allowance?.gte(
    BigNumber.from(
      utils.parseUnits(depositValue || "0", market?.baseToken.decimals)
    )
  );

  const { data: depositData, write: deposit } = useContractWrite(
    {
      addressOrName: lyraVaultAddress,
      contractInterface: HackMoneyVaultABI,
    },
    "deposit",
    {
      args: [utils.parseUnits(depositValue || "0", market?.baseToken.decimals)],
    }
  );

  const { isLoading: depositIsPending } = useWaitForTransaction({
    hash: depositData?.hash,
    confirmations: 2,
  });

  return (
    <LiquidityWidget>
      <YourPosition
        position={(accountVaultBalance as unknown as BigNumber) || 0}
        token={market?.baseToken}
      />
      <Tabs centered defaultActiveKey="1" renderTabBar={renderTabBar}>
        <TabPane tab="DEPOSIT" key="1">
          <TabContent>
            <CurrencyInput
              currency={market?.baseToken.symbol}
              maxAmount={balanceData?.formatted}
            />
            {enoughAllowance ? (
              <ActionButton
                disabled={depositIsPending}
                onClick={() => {
                  deposit();
                }}
              >
                {depositIsPending ? "Depositing..." : "Deposit"}
              </ActionButton>
            ) : (
              <ActionButton
                disabled={approvalIsPending}
                onClick={() => {
                  approve();
                }}
              >
                {approvalIsPending ? "Approving..." : "Approve"}
              </ActionButton>
            )}
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
