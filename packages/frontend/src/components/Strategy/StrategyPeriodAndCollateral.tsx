import { Tooltip } from "antd";
import styled from "styled-components";
import { format } from "date-fns";

const Container = styled.div`
    background: ${({ theme }) => theme.metrics.background};
    border: ${({ theme }) => theme.metrics.border};
    border-radius: 10px;
    padding: 20px 24px;
    width: 50%;
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
    cycleNumber: number;
    startTime: Date;
    endTime: Date;
    collateral: string;
};

const StrategyPeriodAndCollateral = ({ cycleNumber, startTime, endTime, collateral }: Props) => (
    <div style={{ display: "flex", marginTop: "20px" }}>
        <Container style={{ marginRight: "10px" }}>
            <Headline>Current Period: {cycleNumber}</Headline>
            <Text>
                {format(startTime, "MMM dd")} - {format(endTime, "MMM dd")}
            </Text>
            <TooltipContainer>
                <Tooltip
                    placement="right"
                    title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
                    color="#404349"
                >
                    <img src="/info_icon.svg" width="30" alt="" />
                </Tooltip>
            </TooltipContainer>
        </Container>
        <Container style={{ marginLeft: "10px" }}>
            <Headline>Strategy Collateral</Headline>
            <Text>{collateral}</Text>
            <TooltipContainer>
                <Tooltip
                    placement="right"
                    title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
                    color="#404349"
                >
                    <img src="/info_icon.svg" width="30" alt="" />
                </Tooltip>
            </TooltipContainer>
        </Container>
    </div>
);

export default StrategyPeriodAndCollateral;
