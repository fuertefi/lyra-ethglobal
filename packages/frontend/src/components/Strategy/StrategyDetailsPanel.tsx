import { LoadingOutlined } from "@ant-design/icons";
import { VaultParamsStructOutput } from "contracts/typechain-types/BaseVault";
import { format } from "date-fns";
import { formatUnits } from "ethers/lib/utils";
import { useEffect, useState } from "react";
import styled from "styled-components";
import useChainlinkETHPrice from "../../hooks/useChainlinkETHPrice";
import useRound from "../../hooks/useRound";
import usePositions from "../../hooks/useLyraPositions";
import {
  getCurrentStrategy,
  StrategyDetails,
} from "../../pages/api/strategyServices";
import { useLyraMarket } from "../../state/lyra/hooks/getMarket";
import { useVault } from "../../state/vault/hooks";
import StrategyCap from "./StrategyCap";
import SingleColumnPanel, { DoubleColumnPanel } from "./StrategyMetrics";
import {ethers} from "ethers";
import {Positions_positions} from "../../queries/lyra/__generated__/Positions";

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
  const ethPrice = useChainlinkETHPrice() || 0;
  const { data: roundData } = useRound();
  const { data: positions } = usePositions(roundData?.positions || []);

  if (!vaultParams || !vaultBalance || !lyraMarket?.baseToken.symbol)
    return null;
  const [decimals, cap] = vaultParams as unknown as VaultParamsStructOutput;

  const roundPeriod =
    roundData?.createdAt && roundData?.expiry
      ? `${format(roundData.createdAt * 1000, "MMM dd")} - ${format(
          roundData.expiry * 1000,
          "MMM dd"
        )}`
      : "-";

  const formatPositions = (positions: Positions_positions[]) => (
    positions?.map((i, index, arr) => `${index <= arr.length - 1 ? " ": ""}${parseFloat(ethers.utils.formatUnits(i.size, 18)).toFixed(2)
    } calls ${parseFloat(ethers.utils.formatUnits(i.strike?.strikePrice, 18))}`))

    const optionsData = roundData?.roundInProgress ? `Sold ${formatPositions(positions || [])}` : '-';

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
            headline={`Current Period: ${roundData?.id}`}
            text={roundPeriod}
            tooltip={
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
          />
          <SingleColumnPanel
            headline="Strategy Collateral"
            text={`${parseFloat(formatUnits(roundData?.lockedAmount, decimals))} ${
              lyraMarket?.baseToken.symbol
            }`}
            tooltip={
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
          />
          <SingleColumnPanel
            headline="Current ETH Price"
            text={ethPrice?.toFixed(2).toString()}
            tooltip={
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
          />
          <SingleColumnPanel
            headline="Vault performance since start"
            text="0%"
            tooltip={
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
          />
          <DoubleColumnPanel
            headline={"Options Positions"}
            text={optionsData}
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
