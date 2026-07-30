"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";

export type PitchChartType = "bar" | "pie" | "scatter" | "stackedBar" | "line";

export type PitchBarDatum = {
  label: string;
  value: number;
  value2?: number;
};

export type PitchPieDatum = {
  label: string;
  value: number;
  color: string;
};

export type PitchScatterDatum = {
  label: string;
  value: number;
};

export type PitchChartPayload = {
  chartType: PitchChartType;
  legendLabel: string;
  yAxisLabel: string;
  barData: PitchBarDatum[];
  pieData: PitchPieDatum[];
  scatterData: PitchScatterDatum[];
  lineData: PitchBarDatum[];
  stackedBarData: PitchBarDatum[];
};

type Props = {
  payload?: Partial<PitchChartPayload> | null;
};

type PieLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  value?: string | number;
};

const DEFAULT_CHART_COLORS = [
  "#8B5CF6",
  "#06B6D4",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
];
const AXIS = "var(--background-text,#d8d4bf)";
const GRID = "var(--background-text,#585a61)";
const CHART_RIGHT_MARGIN = 36;

const graphColors = (index: number, fallbackColor?: string) => {
  const fallback =
    fallbackColor || DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
  return `var(--graph-${index}, ${fallback})`;
};
const DEFAULT_CHART_PAYLOAD: PitchChartPayload = {
  chartType: "bar",
  legendLabel: "Series Label",
  yAxisLabel: "Y axis name",
  barData: [
    { label: "Mon", value: 120 },
    { label: "Tue", value: 200 },
    { label: "Wed", value: 150 },
    { label: "Thu", value: 80 },
    { label: "Fri", value: 70 },
    { label: "Sat", value: 110 },
    { label: "Sun", value: 130 },
  ],
  pieData: [
    { label: "Category A", value: 55, color: "#d8d4bf" },
    { label: "Category B", value: 25, color: "#b8b4a3" },
    { label: "Category C", value: 20, color: "#a2a091" },
  ],
  scatterData: [
    { label: "Mon", value: 7 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 92 },
    { label: "Thu", value: 15 },
    { label: "Fri", value: 91 },
    { label: "Sat", value: 73 },
    { label: "Sun", value: 56 },
  ],
  lineData: [
    { label: "Mon", value: 30 },
    { label: "Tue", value: 48 },
    { label: "Wed", value: 64 },
    { label: "Thu", value: 42 },
    { label: "Fri", value: 58 },
    { label: "Sat", value: 70 },
    { label: "Sun", value: 90 },
  ],
  stackedBarData: [
    { label: "Mon", value: 50, value2: 50 },
    { label: "Tue", value: 80, value2: 70 },
    { label: "Wed", value: 90, value2: 90 },
    { label: "Thu", value: 40, value2: 60 },
    { label: "Fri", value: 80, value2: 70 },
    { label: "Sat", value: 90, value2: 90 },
    { label: "Sun", value: 70, value2: 80 },
  ],
};

function resolveChartPayload(
  payload?: Partial<PitchChartPayload> | null
): PitchChartPayload {
  return {
    ...DEFAULT_CHART_PAYLOAD,
    ...payload,
    barData: payload?.barData?.length
      ? payload.barData
      : DEFAULT_CHART_PAYLOAD.barData,
    pieData: payload?.pieData?.length
      ? payload.pieData
      : DEFAULT_CHART_PAYLOAD.pieData,
    scatterData: payload?.scatterData?.length
      ? payload.scatterData
      : DEFAULT_CHART_PAYLOAD.scatterData,
    lineData: payload?.lineData?.length
      ? payload.lineData
      : DEFAULT_CHART_PAYLOAD.lineData,
    stackedBarData: payload?.stackedBarData?.length
      ? payload.stackedBarData
      : DEFAULT_CHART_PAYLOAD.stackedBarData,
    chartType: payload?.chartType || DEFAULT_CHART_PAYLOAD.chartType,
    legendLabel: payload?.legendLabel || DEFAULT_CHART_PAYLOAD.legendLabel,
    yAxisLabel: payload?.yAxisLabel || DEFAULT_CHART_PAYLOAD.yAxisLabel,
  };
}

function PiePercentLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  outerRadius = 0,
  value = "",
}: PieLabelProps) {
  const radius = outerRadius * 0.72;
  const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
  const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);
  const text = `${value}%`;

  return (
    <g>
      <rect
        x={x - 24}
        y={y - 13}
        rx={11}
        ry={11}
        width={48}
        height={26}
        fill={"var(--card-color,#ececeb)"}
      />
      <text
        x={x}
        y={y + 5}
        textAnchor="middle"
        fontSize={16}
        fontWeight={600}
        fill={"var(--background-text,#2f2f2f)"}
      >
        {text}
      </text>
    </g>
  );
}

function Legend({
  label,
  color = graphColors(0),
}: {
  label: string;
  color?: string;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center gap-[10px] pt-[8px]"
      style={{ color: AXIS }}
    >
      <span
        className="h-[16px] w-[16px] rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[18px] leading-none">{label}</span>
    </div>
  );
}

export default function PitchDeckChart({ payload }: Props) {
  const {
    chartType,
    barData,
    pieData,
    scatterData,
    lineData,
    stackedBarData,
    legendLabel,
    yAxisLabel,
  } = resolveChartPayload(payload);

  if (chartType === "pie") {
    return (
      <div className="flex h-full min-h-[320px] w-full flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart
              margin={{ top: 18, right: CHART_RIGHT_MARGIN, bottom: 18, left: 28 }}
            >
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius="74%"
                stroke="none"
                labelLine={false}
                label={({ cx, cy, midAngle, outerRadius, value }) => (
                  <PiePercentLabel
                    cx={Number(cx)}
                    cy={Number(cy)}
                    midAngle={Number(midAngle)}
                    outerRadius={Number(outerRadius)}
                    value={String(value)}
                  />
                )}
                isAnimationActive={false}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`${entry.label}-${index}`}
                    fill={graphColors(index, entry.color)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div
          className="flex shrink-0 items-center justify-center gap-[26px] pb-[2px] pt-[8px] text-[18px] leading-none"
          style={{ color: AXIS }}
        >
          {pieData.map((entry, index) => (
            <span key={entry.label} className="flex items-center gap-[10px]">
              <span
                className="h-[15px] w-[15px] rounded-full"
                style={{ backgroundColor: graphColors(index, entry.color) }}
              />
              {entry.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (chartType === "scatter") {
    const points = scatterData.map((item, index) => ({
      x: index + 1,
      y: item.value,
      label: item.label,
    }));

    return (
      <div className="flex h-full min-h-[320px] w-full flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{ top: 18, right: CHART_RIGHT_MARGIN, left: 18, bottom: 20 }}
            >
              <CartesianGrid
                vertical={false}
                horizontal={false}
                stroke={GRID}
                opacity={0.7}
              />
              <XAxis
                type="number"
                dataKey="x"
                domain={[1, Math.max(points.length, 2)]}
                tickCount={points.length}
                tickFormatter={(value) =>
                  points[Number(value) - 1]?.label ?? "label"
                }
                tick={{ fill: AXIS, fontSize: 18 }}
                axisLine={{ stroke: AXIS }}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0, 100]}
                tick={{ fill: AXIS, fontSize: 18 }}
                axisLine={false}
                tickLine={false}
                tickSize={0}
                width={64}
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  fill: AXIS,
                  fontSize: 18,
                  offset: 0,
                }}
              />
              <Scatter
                data={points}
                fill={graphColors(0)}
                isAnimationActive={false}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <Legend label={legendLabel} />
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <div className="flex h-full min-h-[320px] w-full flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={lineData}
              margin={{ top: 24, right: CHART_RIGHT_MARGIN, left: 8, bottom: 20 }}
            >
              <CartesianGrid stroke={GRID} vertical={false} opacity={0.7} />
              <XAxis
                dataKey="label"
                tick={{ fill: AXIS, fontSize: 18 }}
                tickLine={false}
                axisLine={{ stroke: AXIS }}
              />
              <YAxis
                tick={{ fill: AXIS, fontSize: 18 }}
                tickLine={false}
                axisLine={false}
                width={34}
              />
              <Line
                dataKey="value"
                stroke={graphColors(0)}
                strokeWidth={4}
                dot={{ r: 5, fill: graphColors(0) }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Legend label={legendLabel} />
      </div>
    );
  }

  if (chartType === "stackedBar") {
    return (
      <div className="flex h-full min-h-[320px] w-full flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stackedBarData}
              margin={{ top: 28, right: CHART_RIGHT_MARGIN, left: 8, bottom: 20 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fill: AXIS, fontSize: 18 }}
                tickLine={false}
                axisLine={{ stroke: AXIS }}
              />
              <YAxis
                tick={{ fill: AXIS, fontSize: 18 }}
                tickLine={false}
                axisLine={false}
                width={34}
              />
              <Bar
                dataKey="value"
                stackId="stack"
                fill={graphColors(1)}
                radius={[5, 5, 0, 0]}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="value"
                  position="insideTop"
                  fill={"var(--primary-text,#ffffff)"}
                  fontSize={16}
                />
              </Bar>
              <Bar
                dataKey="value2"
                stackId="stack"
                fill={graphColors(0)}
                radius={[5, 5, 0, 0]}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="value2"
                  position="insideTop"
                  fill={"var(--primary-text,#ffffff)"}
                  fontSize={16}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Legend label={legendLabel} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[320px] w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={barData}
            margin={{ top: 36, right: CHART_RIGHT_MARGIN, left: 8, bottom: 20 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fill: AXIS, fontSize: 18 }}
              tickLine={false}
              axisLine={{ stroke: AXIS }}
            />
            <YAxis
              tick={{ fill: AXIS, fontSize: 18 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Bar
              dataKey="value"
              fill={graphColors(0)}
              radius={[5, 5, 0, 0]}
              barSize={34}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="value"
                position="top"
                fill={AXIS}
                fontSize={16}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend label={legendLabel} />
    </div>
  );
}
