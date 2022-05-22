import { useEffect } from "react";
import styled from "styled-components";
import { useAccount } from "wagmi";
import HistoricPnl from "../components/HistoricPnl";
import ManageLiquidity from "../components/ManageLiquidity";
import { ConnectWalletPanel } from "../components/ManageLiquidity/ConnectWalletPanel";
import RoundPayoff from "../components/RoundPayoff";
import StrategyDetailsPanel from "../components/Strategy/StrategyDetailsPanel";
import VaultDescription from "../components/Strategy/VaultDescription";
import { VaultActivityContainer } from "../components/VaultActivity/VaultActivityContainer";
import { useGetLyraMarket, useLyraMarket } from "../state/lyra/hooks/getMarket";

const ContentColumns = styled.div`
  display: flex;
  flex-direction: row;

  max-width: 1272px;
  margin: 0 auto;

  .left-section {
    flex-grow: 1;
    padding-right: 50px;
  }
  .right-section {
    min-width: 400px;
  }
`;

const Header = styled.header`
  font-family: "Clash Display";
  font-size: 48px;
  margin-bottom: 37px;
`;

const StyledVaultDescription = styled(VaultDescription)`
  margin-bottom: 50px;
`;

export const Main = () => {
  const getLyraMarket = useGetLyraMarket();
  useEffect(() => {
    getLyraMarket();
  }, []);

  const market = useLyraMarket();
  const { data: walletData } = useAccount();

  return (
    <ContentColumns>
      <div className="left-section">
        <Header>
          Strategy<strong>Name</strong>
        </Header>
        <StyledVaultDescription>
          Vaults imitate the payoff of selling out-of-the-money covered calls, and one out-of-the-money cash secured puts in equal parts on a weekly basis. Covered strangle is a classic short volatility strategy – it will perform best in USD terms if the price of underlying goes up and lose money if the price of the underlying declines. Compared to a covered call, it has a more protected downside for the cost of a more limited upside.
        </StyledVaultDescription>
        <StrategyDetailsPanel />
        <RoundPayoff />
        <HistoricPnl />
        <VaultActivityContainer />
      </div>
      <div className="right-section">
        {walletData && market ? <ManageLiquidity /> : <ConnectWalletPanel />}
      </div>
    </ContentColumns>
  );
};
