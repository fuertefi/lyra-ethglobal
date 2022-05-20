import { ethers } from "ethers";
import styled from "styled-components";

type Token = {
  decimals: number;
  symbol: string;
}

export type PositionProps = {
  position: ethers.BigNumber | undefined;
  token: Token | undefined;
};

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

const Position = ({ position, token }: PositionProps) => {
  return (
    <Container>
      <Label>Your position</Label>
      <PositionValue>
        {ethers.utils.formatUnits(position || 0, token?.decimals)} {token?.symbol}
      </PositionValue>
    </Container>
  );
};

export default Position;
