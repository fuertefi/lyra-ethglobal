import { LoadingOutlined } from "@ant-design/icons";
import { VaultParamsStructOutput } from "contracts/typechain-types/BaseVault";
import { format } from "date-fns";
import { formatUnits } from "ethers/lib/utils";
import { useEffect, useState } from "react";
import styled from "styled-components";
import {
  getCurrentStrategy,
  StrategyDetails,
} from "../../pages/api/strategyServices";
import {useLyraMarket} from "../../state/lyra/hooks/getMarket";
import { useVault } from "../../state/vault/hooks";
import StrategyCap from "./StrategyCap";
import SingleColumnPanel, { DoubleColumnPanel } from "./StrategyMetrics";

const StrategyDetailsContainer = styled.div`
  width: 100%;
  display: inline-grid;
  grid-gap: 14px;
  grid-template-columns: 1fr 1fr;
`;

const StyledStrategyCap = styled(StrategyCap)`
  grid-column: 1 / span 2;
`;

const StrategyDetailsPanel = () => {
  const [strategyDetails, setStrategyDetails] = useState<StrategyDetails>();

  useEffect(() => {
    // simulate an API request for fetching current vault status
    const delayMilliseconds = 1000;
    let timer = setTimeout(
      () => setStrategyDetails(getCurrentStrategy()),
      delayMilliseconds
    );
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const { data: vaultParams } = useVault("vaultParams", []);
  const { data: vaultBalance } = useVault("totalBalance", []);
  const lyraMarket = useLyraMarket();

  if (!vaultParams || !vaultBalance || !lyraMarket?.baseToken.symbol) return null;
  const [decimals, cap] = vaultParams as unknown as VaultParamsStructOutput;

  return (
    <>
      {!strategyDetails && <LoadingOutlined />}
      {strategyDetails && (
        <StrategyDetailsContainer>
          <StyledStrategyCap
            currentBalance={parseFloat(formatUnits(vaultBalance, decimals))}
            cap={parseFloat(formatUnits(cap, decimals))}
            currency={lyraMarket?.baseToken.symbol}
          />
          <SingleColumnPanel
            headline={`Current Period: ${strategyDetails.cycleNumber}`}
            text={`${format(strategyDetails.startTime, "MMM dd")} - ${format(
              strategyDetails.endTime,
              "MMM dd"
            )}`}
            tooltip={
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
          />
          <SingleColumnPanel
            headline="Strategy Collateral"
            text={strategyDetails.collateralDescription}
            tooltip={
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
          />
          <SingleColumnPanel
            headline="Current ETH Price"
            text="2500 USD"
            tooltip={
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
          />
          <SingleColumnPanel
            headline="Another Parameter"
            text="Some value"
            tooltip={
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
          />
          <DoubleColumnPanel
            headline={"Options Positions"}
            text={strategyDetails.optionsPositions}
            tooltip={
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
          />
        </StrategyDetailsContainer>
      )}
    </>
  );
};

export default StrategyDetailsPanel;
