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
    headline1: string;
    text1: string;
    tooltip1: string;
    headline2: string;
    text2: string;
    tooltip2: string;
};

const DoubleColumnPanel = ({ headline1, text1, tooltip1, headline2, text2, tooltip2 }: Props) => (
    <div style={{ display: "flex", marginTop: "20px" }}>
        <Container style={{ marginRight: "10px" }}>
            <Headline>{headline1}</Headline>
            <Text>{text1}</Text>
            <TooltipContainer>
                <Tooltip placement="right" title={tooltip1} color="#404349">
                    <img src="/info_icon.svg" width="30" alt="" />
                </Tooltip>
            </TooltipContainer>
        </Container>
        <Container style={{ marginLeft: "10px" }}>
            <Headline>{headline2}</Headline>
            <Text>{text2}</Text>
            <TooltipContainer>
                <Tooltip placement="right" title={tooltip2} color="#404349">
                    <img src="/info_icon.svg" width="30" alt="" />
                </Tooltip>
            </TooltipContainer>
        </Container>
    </div>
);

export default DoubleColumnPanel;
