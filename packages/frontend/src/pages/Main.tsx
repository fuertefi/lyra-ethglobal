import ManageLiquidity from "../components/ManageLiquidity";
import styled from "styled-components";
import VaultDescription from "../components/Strategy/VaultDescription";
import StrategyDetailsPanel from "../components/Strategy/StrategyDetailsPanel";
import { VaultActivityContainer } from "../components/VaultActivity/VaultActivityContainer";

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

  return (
    <ContentColumns>
      <div className="left-section">
        <Header>
          Strategy<strong>Name</strong>
        </Header>
        <StyledVaultDescription>
          T-YVUSDC-P-ETH earns yield on its USDC deposits by running a weekly
          automated ETH put-selling strategy, where the put options are
          collateralized by yvUSDC. The vault reinvests the yield it earns back
          into the strategy, effectively compounding the yields for depositors
          over time.
        </StyledVaultDescription>
        <StrategyDetailsPanel />
        <VaultActivityContainer />
      </div>
      <div className="right-section">
        <ManageLiquidity />
      </div>
    </ContentColumns>
  );
};
