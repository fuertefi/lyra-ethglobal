import { ConnectButton } from "@rainbow-me/rainbowkit";
import styled from "styled-components";
import { useAccount } from "wagmi";

const Container = styled.div`
  display: flex;
  justify-content: space-between;
`;

export const Header = () => {
  const { data: walletData } = useAccount();
  return (
    <Container style={{ margin: "30px" }}>
      <img src="/logo.svg" alt="0" width="200" />
      {walletData && (
        <ConnectButton
          chainStatus="name"
          accountStatus="address"
          showBalance={false}
        />
      )}
    </Container>
  );
};