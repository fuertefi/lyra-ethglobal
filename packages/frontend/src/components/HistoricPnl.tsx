import moment from "moment";
import React, { useState } from "react";
import {
  Area,
  AreaChart,
  Dot,
  Label,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CartesianViewBox, Coordinate } from "recharts/types/util/types";
import styled, { useTheme } from "styled-components";
import { accentGreen, lightGray } from "../theme";

const data = [
  {
    date: "2007-06-29T00:00:00.000Z",
    index: 100,
  },
  {
    date: "2007-08-06T00:00:00.000Z",
    index: 100.38,
  },
  {
    date: "2007-09-18T00:00:00.000Z",
    index: 105.16,
  },
  {
    date: "2007-10-31T00:00:00.000Z",
    index: 131.14,
  },
  {
    date: "2007-12-13T00:00:00.000Z",
    index: 141.83,
  },
  {
    date: "2008-01-28T00:00:00.000Z",
    index: 123.95,
  },
  {
    date: "2008-03-11T00:00:00.000Z",
    index: 110.09,
  },
  {
    date: "2008-04-28T00:00:00.000Z",
    index: 115.38,
  },
  {
    date: "2008-06-11T00:00:00.000Z",
    index: 100.04,
  },
  {
    date: "2008-07-23T00:00:00.000Z",
    index: 98.93,
  },
  {
    date: "2008-09-05T00:00:00.000Z",
    index: 97.11,
  },
  {
    date: "2008-10-21T00:00:00.000Z",
    index: 70.45,
  },
  {
    date: "2008-12-05T00:00:00.000Z",
    index: 58.87,
  },
  {
    date: "2009-01-21T00:00:00.000Z",
    index: 59.61,
  },
  {
    date: "2009-03-06T00:00:00.000Z",
    index: 55.88,
  },
  {
    date: "2009-04-28T00:00:00.000Z",
    index: 73.55,
  },
  {
    date: "2009-06-10T00:00:00.000Z",
    index: 107.62,
  },
  {
    date: "2009-07-22T00:00:00.000Z",
    index: 104.22,
  },
  {
    date: "2009-09-03T00:00:00.000Z",
    index: 108.32,
  },
  {
    date: "2009-10-21T00:00:00.000Z",
    index: 122.28,
  },
  {
    date: "2009-12-03T00:00:00.000Z",
    index: 125.07,
  },
  {
    date: "2010-01-19T00:00:00.000Z",
    index: 128.98,
  },
  {
    date: "2010-03-05T00:00:00.000Z",
    index: 126.29,
  },
  {
    date: "2010-04-21T00:00:00.000Z",
    index: 129.02,
  },
  {
    date: "2010-06-02T00:00:00.000Z",
    index: 124.44,
  },
  {
    date: "2010-07-14T00:00:00.000Z",
    index: 134.17,
  },
  {
    date: "2010-08-25T00:00:00.000Z",
    index: 136.86,
  },
  {
    date: "2010-10-07T00:00:00.000Z",
    index: 152.98,
  },
  {
    date: "2010-11-22T00:00:00.000Z",
    index: 150.66,
  },
  {
    date: "2011-01-04T00:00:00.000Z",
    index: 150.44,
  },
  {
    date: "2011-02-17T00:00:00.000Z",
    index: 135.65,
  },
  {
    date: "2011-04-01T00:00:00.000Z",
    index: 142.27,
  },
  {
    date: "2011-05-20T00:00:00.000Z",
    index: 135.72,
  },
  {
    date: "2011-07-01T00:00:00.000Z",
    index: 139.11,
  },
  {
    date: "2011-08-12T00:00:00.000Z",
    index: 129.52,
  },
  {
    date: "2011-09-29T00:00:00.000Z",
    index: 123.55,
  },
  {
    date: "2011-11-17T00:00:00.000Z",
    index: 119.78,
  },
  {
    date: "2011-12-30T00:00:00.000Z",
    index: 110.02,
  },
  {
    date: "2012-02-13T00:00:00.000Z",
    index: 130.5,
  },
  {
    date: "2012-03-28T00:00:00.000Z",
    index: 126.11,
  },
  {
    date: "2012-05-14T00:00:00.000Z",
    index: 118.72,
  },
  {
    date: "2012-06-25T00:00:00.000Z",
    index: 124.6,
  },
  {
    date: "2012-08-06T00:00:00.000Z",
    index: 128.32,
  },
  {
    date: "2012-09-20T00:00:00.000Z",
    index: 134.07,
  },
  {
    date: "2012-11-05T00:00:00.000Z",
    index: 139.3,
  },
  {
    date: "2012-12-19T00:00:00.000Z",
    index: 149.18,
  },
  {
    date: "2013-01-31T00:00:00.000Z",
    index: 151,
  },
  {
    date: "2013-03-14T00:00:00.000Z",
    index: 145.95,
  },
  {
    date: "2013-05-02T00:00:00.000Z",
    index: 148.65,
  },
  {
    date: "2013-06-13T00:00:00.000Z",
    index: 142.91,
  },
  {
    date: "2013-07-25T00:00:00.000Z",
    index: 147.27,
  },
  {
    date: "2013-09-10T00:00:00.000Z",
    index: 143.84,
  },
  {
    date: "2013-10-24T00:00:00.000Z",
    index: 152.66,
  },
  {
    date: "2013-12-09T00:00:00.000Z",
    index: 158.87,
  },
  {
    date: "2014-01-21T00:00:00.000Z",
    index: 157.67,
  },
  {
    date: "2014-03-05T00:00:00.000Z",
    index: 158.92,
  },
  {
    date: "2014-04-22T00:00:00.000Z",
    index: 171.18,
  },
  {
    date: "2014-06-05T00:00:00.000Z",
    index: 192.66,
  },
  {
    date: "2014-07-17T00:00:00.000Z",
    index: 196.32,
  },
  {
    date: "2014-09-02T00:00:00.000Z",
    index: 208.33,
  },
  {
    date: "2014-10-20T00:00:00.000Z",
    index: 202.64,
  },
  {
    date: "2014-12-04T00:00:00.000Z",
    index: 222.19,
  },
  {
    date: "2015-01-16T00:00:00.000Z",
    index: 220.81,
  },
  {
    date: "2015-03-03T00:00:00.000Z",
    index: 231.3,
  },
  {
    date: "2015-04-20T00:00:00.000Z",
    index: 220.2,
  },
  {
    date: "2015-06-02T00:00:00.000Z",
    index: 217.92,
  },
  {
    date: "2015-07-14T00:00:00.000Z",
    index: 223.64,
  },
  {
    date: "2015-08-25T00:00:00.000Z",
    index: 211.33,
  },
  {
    date: "2015-10-09T00:00:00.000Z",
    index: 216.73,
  },
  {
    date: "2015-11-24T00:00:00.000Z",
    index: 210.13,
  },
  {
    date: "2016-01-07T00:00:00.000Z",
    index: 205.48,
  },
  {
    date: "2016-02-19T00:00:00.000Z",
    index: 190.44,
  },
  {
    date: "2016-04-06T00:00:00.000Z",
    index: 202.28,
  },
  {
    date: "2016-05-23T00:00:00.000Z",
    index: 205.82,
  },
  {
    date: "2016-07-04T00:00:00.000Z",
    index: 225.39,
  },
  {
    date: "2016-08-17T00:00:00.000Z",
    index: 239.3,
  },
  {
    date: "2016-09-30T00:00:00.000Z",
    index: 240.17,
  },
  {
    date: "2016-11-17T00:00:00.000Z",
    index: 226.32,
  },
  {
    date: "2016-12-29T00:00:00.000Z",
    index: 225.13,
  },
  {
    date: "2017-02-10T00:00:00.000Z",
    index: 246.96,
  },
  {
    date: "2017-03-28T00:00:00.000Z",
    index: 255.78,
  },
  {
    date: "2017-05-12T00:00:00.000Z",
    index: 266.23,
  },
  {
    date: "2017-06-23T00:00:00.000Z",
    index: 269.95,
  },
  {
    date: "2017-08-07T00:00:00.000Z",
    index: 286.76,
  },
  {
    date: "2017-09-20T00:00:00.000Z",
    index: 289.76,
  },
  {
    date: "2017-11-06T00:00:00.000Z",
    index: 299.65,
  },
  {
    date: "2017-12-18T00:00:00.000Z",
    index: 297.4,
  },
  {
    date: "2018-01-31T00:00:00.000Z",
    index: 313.11,
  },
  {
    date: "2018-03-16T00:00:00.000Z",
    index: 292.36,
  },
  {
    date: "2018-05-02T00:00:00.000Z",
    index: 306.91,
  },
  {
    date: "2018-06-13T00:00:00.000Z",
    index: 308.41,
  },
  {
    date: "2018-07-25T00:00:00.000Z",
    index: 313.55,
  },
  {
    date: "2018-09-07T00:00:00.000Z",
    index: 328.35,
  },
  {
    date: "2018-10-25T00:00:00.000Z",
    index: 285.19,
  },
  {
    date: "2018-12-11T00:00:00.000Z",
    index: 298.21,
  },
  {
    date: "2019-01-23T00:00:00.000Z",
    index: 304.950995581358,
  },
  {
    date: "2019-03-07T00:00:00.000Z",
    index: 310.704540671953,
  },
  {
    date: "2019-04-23T00:00:00.000Z",
    index: 324.131425598716,
  },
  {
    date: "2019-06-07T00:00:00.000Z",
    index: 330.044801531953,
  },
  {
    date: "2019-07-19T00:00:00.000Z",
    index: 319.639059709954,
  },
  {
    date: "2019-09-04T00:00:00.000Z",
    index: 306.689383458405,
  },
  {
    date: "2019-10-22T00:00:00.000Z",
    index: 330.164023432534,
  },
  {
    date: "2019-12-05T00:00:00.000Z",
    index: 337.6568003992351,
  },
  {
    date: "2020-01-17T00:00:00.000Z",
    index: 347.7119840644148,
  },
  {
    date: "2020-03-02T00:00:00.000Z",
    index: 315.6788520002291,
  },
  {
    date: "2020-04-20T00:00:00.000Z",
    index: 271.49095938908175,
  },
];

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
  // console.log("data", rest);
  // console.log(coordinate);
  // console.log(active);
  // console.log(payload[0]);
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
            <StyledToolTipLabel>{`${moment(payload[0].payload.date).format(
              "DD MMM'YY HH:mm"
            )}`}</StyledToolTipLabel>
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
            <StyledToolTipLabel>{`${payload[0].value.toFixed(
              2
            )}`}</StyledToolTipLabel>
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

const AxisLabel = (props: any) => {
  return <Label {...props} />;
};
const _AxisLabel = ({
  axisType,
  x,
  y,
  width,
  height,
  stroke,
  children,
}: {
  axisType?: any;
  x?: any;
  y?: any;
  width?: any;
  height?: any;
  stroke?: any;
  children?: any;
}) => {
  const isVert = axisType === "yAxis";
  const cx = isVert ? x : x + width / 2;
  const cy = isVert ? height / 2 + y : y + height + 10;
  const rot = isVert ? `270 ${cx} ${cy}` : 0;
  return (
    <text
      x={x}
      y={140}
      transform={`rotate(${rot})`}
      textAnchor="middle"
      stroke={stroke}
    >
      {children}123
    </text>
  );
};

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

const Cursor = (props: any) => {
  return <Dot cx={props.points[1].x} cy={props.points[1].y} r={20} />;
};

const HistoricPnl = () => {
  const formatTick = (tickItem: string) => {
    return moment(tickItem).format("MMM");
  };
  const [refTooltipCoords, setRefTooltipCoords] = useState();
  const [mouseX, setMouseX] = useState(0);
  const [activeY, setActiveY] = useState(0);
  const [activeX, setActiveX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [chartActive, setActive] = useState(false);

  const theme = useTheme();

  const mouseMove = (e: any) => {
    setMouseX(e.activeCoordinate.x);
    setMouseY(e.activeCoordinate.y);
    setActiveY(e.activePayload[0].payload.index);
    setActiveX(e.activePayload[0].payload.date);
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
      <SectionHeader>Vault Performance</SectionHeader>
      <Container>
        <InnerContainer>
          <span style={{ display: "block", marginBottom: "20px" }}>
            Yield (Cumulative) ETH | USD
          </span>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart
              data={data}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              onMouseMove={mouseMove}
              onMouseEnter={() => setActive(true)}
              onMouseLeave={() => setActive(false)}
            >
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatTick}
                minTickGap={52}
              ></XAxis>
              <YAxis
                orientation="right"
                tickLine={false}
                style={{ position: "relative" }}
              />
              <Area
                dataKey="index"
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
              <ReferenceLine x={data[0].date} stroke={lightGray} />
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
        
            </AreaChart>
          </ResponsiveContainer>
        </InnerContainer>
        <span
          style={{ display: "block", marginLeft: "36px", marginBottom: "20px" }}
        >
          Projected APY: &nbsp;
          <span style={{ color: "#06C799" }}>+30%</span>
        </span>
      </Container>
    </>
  );
};

export default HistoricPnl;
