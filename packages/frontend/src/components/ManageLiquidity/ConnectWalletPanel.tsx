import { ConnectButton } from "@rainbow-me/rainbowkit";
import styled from "styled-components";

const Container = styled.div`
  border: 1px solid #414447;
  border-radius: 10px;
`;

const TopRow = styled.div`
  width: auto;
  padding: 20px;
  background-color: ${(props) => props.theme.position.bg};
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  font-family: "Satoshi", sans-serif;
  font-weight: 400;
  color: #99a0ab;
  font-size: 12px;
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.05em;
`;

const BottomRow = styled.div`
  width: auto;
  display: flex;
  padding: 20px;
  align-items: center;
  justify-content: center;
`;

export const ConnectWalletPanel = () => {
  return (
    <Container>
      <TopRow>Your position will be displayed here</TopRow>
      <BottomRow>
        <ConnectButton
          chainStatus="name"
          accountStatus="address"
          showBalance={false}
        />
      </BottomRow>
    </Container>
  );
};