import { Progress } from "antd";
import styled from "styled-components";

type StrategyCapProps = {
  currentBalance: number;
  currency: string;
  cap: number;
};

const StyledProgress = styled(Progress)`
  .ant-progress-inner {
    background: ${({ theme }) => theme.metrics.progress.inner.color};
    border: 1px solid ${({ theme }) => theme.metrics.progress.inner.border};
    border-radius: 10px;
  }

  .ant-progress-bg {
    background: ${({ theme }) => theme.metrics.progress.background.color};
    border: 1px solid ${({ theme }) => theme.metrics.progress.background.border};
    border-radius: 10px;
  }
`;

const Container = styled.div`
  background: ${({ theme }) => theme.metrics.background};
  border: ${({ theme }) => theme.metrics.border};
  border-radius: 10px;
  padding: 20px 24px;
`;

const Details = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  line-height: 22px;
  font-weight: 500;

  letter-spacing: 0.05em;
  text-transform: uppercase;

  div:not(:first-child) {
    text-align: right;
  }
`;

const Amount = styled.div`
  font-family: "Clash Display";
  font-style: normal;
  font-weight: 600;
  font-size: 20px;
  line-height: 22px;
  margin-top: 4px;
  margin-bottom: 10px;

  color: ${({ theme }) => theme.metrics.accent.color};
`;

const StrategyCap = ({ currentBalance, cap, currency }: StrategyCapProps) => (
  <Container>
    <Details>
      <div>
        Strategy deposit
        <Amount>
          {currentBalance} {currency}
        </Amount>
      </div>
      <div>
        Strategy capacity
        <Amount>
          {cap} {currency}
        </Amount>
      </div>
    </Details>
    <StyledProgress
      percent={(currentBalance / cap) * 100}
      strokeWidth={15}
      showInfo={false}
    />
  </Container>
);

export default StrategyCap;
