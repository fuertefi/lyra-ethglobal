import { ConnectButton } from "@rainbow-me/rainbowkit";
import styled from "styled-components";
import { useAccount } from "wagmi";

const StyledHeader = styled.div`
  display: flex;
  max-width: 1272px;
  margin: 0 auto;
  justify-content: space-between;
`;
export const Header = () => {
  const { data: walletData } = useAccount();
  return (
    <StyledHeader>
      <div style={{ marginTop: "103px" }}>
        <img src="/covered_strangle.svg" alt="" width="533" />
        <br />
        <img src="/strategy_on_lyra.svg" alt="" />
      </div>
      <div style={{ marginTop: "33px" }}>
        {walletData && (
          <ConnectButton
            chainStatus="name"
            accountStatus="address"
            showBalance={false}
          />
        )}
      </div>
    </StyledHeader>
  );
};
