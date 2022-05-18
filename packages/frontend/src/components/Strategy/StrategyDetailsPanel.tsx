import { format } from "date-fns";
import styled from "styled-components";
import {
  getCurrentStrategy,
  StrategyDetails,
} from "../../pages/api/strategyServices";
import SingleColumnPanel, { DoubleColumnPanel } from "./StrategyMetrics";
import StrategyCap from "./StrategyCap";
import { useEffect, useState } from "react";
import { LoadingOutlined } from "@ant-design/icons";

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

  return (
    <>
      {!strategyDetails && <LoadingOutlined />}
      {strategyDetails && (
        <StrategyDetailsContainer>
          <StyledStrategyCap
            currentBalance={strategyDetails.deposit}
            cap={strategyDetails.capacity}
            currency={strategyDetails.currency}
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
