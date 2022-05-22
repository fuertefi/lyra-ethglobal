import React, { useState } from "react";
import {
  Dot,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CartesianViewBox, Coordinate } from "recharts/types/util/types";
import styled, { useTheme } from "styled-components";
import { accentGreen, lightGray } from "../theme";
import _range from "lodash/range";

const step = 50;
const range = _range(1600, 2500, step); 

const generateValues = (range: number[], spot_initial: number, strike_1: number, strike_2: number, premium_1: number, premium_2: number) => {
  const res = []
  for (const spot_now of range) {
    const currentRes = {
      price: spot_now,
      value: (((((((spot_now-spot_initial-Math.max(0,spot_now-strike_1)+premium_1)+(spot_now-spot_initial-Math.max(0,spot_now-strike_2)+premium_2))/2)*((premium_1+premium_2)/spot_initial+1))+(spot_initial))/spot_initial)-1)*100
    }
    
    res.push(currentRes);
  }

  return res;
}

const data = generateValues(range, 2000, 2250, 1800, 15.2295175, 221.81);

const StyledToolTipLabel = styled.div`
  color: #131517;
  background: ${accentGreen};
  display: inline-block;
  border-radius: 14px;
  font-size: 12px;
  padding: 0 10px;
  height: 23px;
  line-height: 23px;
  width: auto;
`;

const VerticalContainer = styled.div`
  position: relative;
  top: -12px;
  left: 5px;
`;

const HorizontalContainer = styled.div`
  position: relative;
  left: -50%;
  top: 2px;
  display: inline-block;
`;

const ReferenceTooltip = ({
  payload,
  label,
  active,
  viewBox,
  coordinate,
  align = "xaxis",
  tooltipPos,
  ...rest
}: {
  payload?: any;
  label?: any;
  active?: boolean;
  viewBox?: CartesianViewBox;
  coordinate?: Coordinate;
  align?: "xaxis" | "yaxis";
  tooltipPos: Coordinate;
}) => {
  if (payload && payload[0]) {
    return (
      <div>
        <div
          style={{
            position: "absolute",
            left: tooltipPos?.x,
            // left: coordinate?.x,
            top: viewBox?.height,
          }}
        >
          <HorizontalContainer>
            <StyledToolTipLabel>{`${payload[0].payload.price}`}</StyledToolTipLabel>
          </HorizontalContainer>
        </div>
        <div
          style={{
            position: "absolute",
            right: 0,
            // left: coordinate?.x,
            top: tooltipPos?.y,
          }}
        >
          <VerticalContainer>
            <StyledToolTipLabel>{`${payload[0].value.toFixed(2)}%`}</StyledToolTipLabel>
          </VerticalContainer>
        </div>
      </div>
    );
  }

  return null;
};

const Container = styled.div`
  background: ${({ theme }) => theme.metrics.background};
  border-radius: 10px;
  border: ${({ theme }) => theme.metrics.border};
  width: 100%;
`;

const InnerContainer = styled.div`
  width: 100%;
  height: 100%;
  padding: 20px 36px 20px;
`;

export const CustomLine: React.FC<{ cx?: number; cy?: number }> = ({
  cx,
  cy,
}) => {
  return (
    <ReferenceLine
      x={cx! - 10}
      y={cy! - 10}
      r={4}
      stroke="black"
      style={{ opacity: "0.9" }}
      strokeWidth={2}
      fill={"green"}
    />
  );
};

const RoundPayoff = () => {
  const formatTick = (tickItem: string) => {
    return `${tickItem}%`;
  };
  const [mouseX, setMouseX] = useState(0);
  const [activeY, setActiveY] = useState(0);
  const [activeX, setActiveX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [chartActive, setActive] = useState(false);

  const theme = useTheme();

  const mouseMove = (e: any) => {
    console.log(e);
    setMouseX(e.activeCoordinate.x);
    setMouseY(e.activeCoordinate.y);
    setActiveY(e.activePayload[0].payload.value);
    setActiveX(e.activePayload[0].payload.price);
    setActive(true);
  };

  const SectionHeader = styled.header`
    font-weight: 700;
    font-family: "Satoshi";
    margin-top: 40px;
    margin-bottom: 20px;
  `;

  return (
    <>
      <SectionHeader>Current Round payoff</SectionHeader>
      <Container>
        <InnerContainer>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={data}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              onMouseMove={mouseMove}
              onMouseEnter={() => setActive(true)}
              onMouseLeave={() => setActive(false)}
            >
              <XAxis
                dataKey="price"
                tickLine={false}
                axisLine={false}
                // tickFormatter={formatTick}
                minTickGap={52}
              ></XAxis>
              <YAxis
                orientation="left"
                tickLine={false}
                tickFormatter={formatTick}
                style={{ position: "relative" }}
              />
              <Line
                dot={false}
                dataKey="value"
                stroke={theme?.charts.stroke}
                strokeWidth={2}
                fillOpacity={1}
                fill={theme?.charts.background}
              />
              {chartActive && (
                <>
                  <ReferenceLine
                    y={activeY}
                    stroke={lightGray}
                    strokeDasharray="3 3"
                  />
                  <ReferenceLine
                    x={activeX}
                    stroke={lightGray}
                    strokeDasharray="3 3"
                  />
                </>
              )}
                <ReferenceLine x={data[0].price} stroke={lightGray} />
              {/*
          <Tooltip
            active={false}
            filterNull={false}
            content={<ReferenceTooltip />}
            isAnimationActive={false}
            position={{ x: 0, y: 0 }}
            wrapperStyle={{
              visibility: "visible",
              color: "red",
              width: 10,
              height: 10,
              // position: "absolute",
              transform: "none",
            }}
          />
            */}
              <Tooltip
                active={false}
                filterNull={false}
                cursor={false}
                content={
                  <ReferenceTooltip
                    tooltipPos={{ x: mouseX, y: ((360 - activeY) / 360) * 120 }}
                    align="yaxis"
                  />
                }
                isAnimationActive={false}
                position={{ x: 0, y: 0 }}
                wrapperStyle={{
                  visibility: "visible",
                  color: "red",
                  width: "100%",
                  height: "100%",
                  // position: "absolute",
                  transform: "none",
                }}
              />
        
            </LineChart>
          </ResponsiveContainer>
        </InnerContainer>
      </Container>
    </>
  );
};

export default RoundPayoff;
