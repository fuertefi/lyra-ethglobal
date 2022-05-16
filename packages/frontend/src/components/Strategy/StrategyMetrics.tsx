import { Tooltip } from "antd";
import styled from "styled-components";

const Container = styled.div`
  background: ${({ theme }) => theme.metrics.background};
  border: ${({ theme }) => theme.metrics.border};
  border-radius: 10px;
  padding: 20px 24px;
  position: relative;
`;

const Headline = styled.div`
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

const Text = styled.div`
  color: white;
`;

const TooltipContainer = styled.div`
  color: white;
  position: absolute;
  top: 20px;
  right: 20px;
`;

type Props = {
  headline: string;
  text: string;
  tooltip: string;
  className?: string;
};

const SingleColumnPanel = ({ headline, text, tooltip, className }: Props) => (
  <Container className={className}>
    <Headline>{headline}</Headline>
    <Text>{text}</Text>
    <TooltipContainer>
      <Tooltip placement="right" title={tooltip} color="#404349">
        <img src="/info_icon.svg" width="30" alt="" />
      </Tooltip>
    </TooltipContainer>
  </Container>
);

export const DoubleColumnPanel = styled(SingleColumnPanel)`
  grid-column: 1 / span 2;
`;

export default SingleColumnPanel;
