import { ethers } from "ethers";
import styled from "styled-components";
import { BalanceDestructured } from ".";

const Container = styled.div`
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  padding: 20px 25px;
`;

const Label = styled.span`
  font-size: 12px;
  line-height: 22px;

  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

const PositionValue = styled.span`
  font-size: 12px;
  line-height: 22px;

  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

interface Props {
  balance: BalanceDestructured;
}

const Position = ({ balance }: Props) => {
  const position = balance.availableNowValue
    .add(balance.lockedInStrategyValue)
    .add(balance.pendingUnlockValue);
  // only display 5 decimal points
  const positionStr = (+ethers.utils.formatUnits(position, balance.token?.decimals)).toFixed(5);
  return (
    <Container>
      <Label>Your position</Label>
      <PositionValue>
        {positionStr}{" "}
        {balance.token?.symbol}
      </PositionValue>
    </Container>
  );
};

export default Position;
