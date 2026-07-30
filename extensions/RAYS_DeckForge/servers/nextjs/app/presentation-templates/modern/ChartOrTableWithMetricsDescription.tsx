import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as z from "zod";

export const layoutId = "chart-with-metrics";
export const layoutName = "Chart With Metrics Slide";
export const layoutDescription =
  "A chart or table with metrics slide layout";

const growthStatsSchema = z
  .object({
    year: z.string(),
  })
  .catchall(z.number())
  .meta({
    description:
      "Growth statistics for a specific year, with any number of metrics as key-value pairs where keys are metric names and values are numbers.",
  });

// growthStats: list of dicts, each dict is { year: string, <metric1>: number, <metric2>: number, ... }
const tractionSchema = z.object({


  title: z.string().default("Company Traction").meta({
    description: "Main title of the slide",
  }),
  description: z
    .string()
    .min(3)
    .max(200)
    .default(
      "Traction is a period where the company is feeling momentum during its development period. If traction momentum is not harnessed, sales figures can decline and the customer base can shrink. In general, companies will judge success by the amount of revenue and new customers they receive.",
    )
    .meta({
      description:
        "Main content text describing the company's traction and growth momentum.",
    }),
  tableMode: z.boolean().default(false),
  tableColumns: z.array(z.string().min(1).max(40)).min(2).max(10).default(["Metric", "Value"]),
  tableRows: z.array(z.array(z.string().min(0).max(200)).min(2).max(10)).min(1).max(30).default([["Users", "10K+"], ["Revenue", "$1.2M"], ["Satisfaction", "95%"]]),
  // growthStats is a list of objects, each with a 'year' and any number of metric keys (all numbers)
  growthStats: z
    .array(growthStatsSchema)
    .min(1)
    .max(20)
    .default([
      growthStatsSchema.parse({
        year: "2020",
        artificialIntelligence: 5,
        internetOfThings: 10,
        others: 8,
      }),
      growthStatsSchema.parse({
        year: "2021",
        artificialIntelligence: 10,
        internetOfThings: 20,
        others: 15,
      }),
      growthStatsSchema.parse({
        year: "2022",
        artificialIntelligence: 20,
        internetOfThings: 30,
        others: 22,
      }),
      growthStatsSchema.parse({
        year: "2023",
        artificialIntelligence: 28,
        internetOfThings: 38,
        others: 29,
      }),
      growthStatsSchema.parse({
        year: "2024",
        artificialIntelligence: 35,
        internetOfThings: 45,
        others: 34,
      }),
      growthStatsSchema.parse({
        year: "2025",
        artificialIntelligence: 45,
        internetOfThings: 53,
        others: 42,
      }),
      growthStatsSchema.parse({
        year: "2026",
        artificialIntelligence: 55,
        internetOfThings: 65,
        others: 52,
      }),
      growthStatsSchema.parse({
        year: "2029",
        artificialIntelligence: 55,
        internetOfThings: 65,
        others: 52,
      }),
    ])
    .meta({
      description:
        "Growth statistics for the company, used for chart visualization. Each entry is an object representing a specific year, with the 'year' key as a string (e.g., '2020'), and additional keys for each metric (such as 'artificialIntelligence', 'internetOfThings', 'others'), where the values are numbers representing the metric's value for that year. Example:\n\n[\n  { year: '2020', artificialIntelligence: 5, internetOfThings: 10, others: 8 },\n  { year: '2021', artificialIntelligence: 10, internetOfThings: 20, others: 15 },\n  ...\n]\nThis structure allows the chart to dynamically render multiple series over time, with each metric visualized as a separate line.",
    }),
});

export const Schema = tractionSchema;
export type CompanyTractionData = z.infer<typeof tractionSchema>;

interface Props {
  data?: Partial<CompanyTractionData>;
}

// Helper: assign colors to series
const defaultColors = [
  "#1E4CD9",
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#a21caf",
  "#6366f1",
  "#f43f5e",
  "#fbbf24",
  "#14b8a6",
];

function getSeriesKeys(
  growthStats: Array<Record<string, string | number>>,
): string[] {
  if (!growthStats.length) return [];
  // Exclude 'year' or any non-numeric keys
  const first = growthStats[0];
  return Object.keys(first).filter(
    (key) => key !== "year" && typeof first[key] === "number",
  );
}

// Compute stats for right column, generic for all series
function computeStats(
  growthStats: Array<Record<string, string | number>>,
  seriesKeys: string[],
) {
  if (!growthStats.length) return [];
  const first = growthStats[0];
  const last = growthStats[growthStats.length - 1];
  return seriesKeys.map((key) => {
    const start = typeof first[key] === "number" ? (first[key] as number) : 0;
    const end = typeof last[key] === "number" ? (last[key] as number) : 0;
    const growth = start === 0 ? 0 : ((end - start) / Math.abs(start)) * 100;
    return {
      label: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase()),
      value: `${growth >= 0 ? "+" : ""}${Math.round(growth)}% growth`,
      description: `${key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())} growth over the period.`,
    };
  });
}

const CompanyTractionSlideLayout: React.FC<Props> = ({ data }) => {
  const growthStats = data?.growthStats || [];

  // Dynamically determine series keys
  const seriesKeys = getSeriesKeys(growthStats);

  // Prepare stats for the right column, generic for all series
  const stats = computeStats(growthStats, seriesKeys);

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
        rel="stylesheet"
      />
      <div
        className="w-full max-w-[1280px] max-h-[720px] aspect-video mx-auto rounded shadow-lg overflow-hidden relative z-20"
        style={{
          fontFamily: "var(--heading-font-family,Montserrat)",
          backgroundColor: "var(--background-color, #FFFFFF)",
        }}
      >
        {/* Header */}
        {((data as any)?.__companyName__ || (data as any)?._logo_url__) && (
          <div className="absolute top-0 left-0 right-0 px-8 sm:px-12 lg:px-20 pt-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">

                {(data as any)?._logo_url__ && <img src={(data as any)?._logo_url__} alt="logo" className="w-6 h-6" />}
                {(data as any)?.__companyName__ && <span className="text-sm sm:text-base font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                  {(data as any)?.__companyName__ || 'Company Name'}
                </span>}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="px-16 py-16 flex h-full gap-8">
          {/* Left Column - Chart with Title Below */}
          <div className="flex-1 pr-12 flex flex-col justify-center">
            <h1 className="text-5xl font-bold mb-4 leading-tight text-left" style={{ color: 'var(--background-text, #234CD9)' }}>
              {data?.title}
            </h1>
            <div className=" rounded-lg shadow p-4 mb-8"
              style={{ backgroundColor: 'var(--card-color, #ffffff)' }}
            >
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthStats} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={`var(--background-text, #E5E7EB)`} />
                    <XAxis
                      dataKey="year"
                      stroke="var(--background-text, #234CD9)"
                      tick={{ fill: "var(--background-text, #234CD9)", fontSize: 12, fontWeight: 600 }}
                    />
                    <YAxis
                      stroke="var(--background-text, #234CD9)"
                      tick={{ fill: "var(--background-text, #234CD9)", fontSize: 12, fontWeight: 600 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card-color, #234CD9)",
                        border: "none",
                        color: "var(--background-text, #ffffff)",
                      }}

                    />
                    <Legend
                      wrapperStyle={{ color: "var(--background-text, #234CD9)", fontSize: 12, fontWeight: 600 }}
                      iconType="circle"
                    />
                    {seriesKeys.map((key, idx) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={`var(--graph-${idx}, ${defaultColors[idx % defaultColors.length]})`}
                        strokeWidth={3}
                        name={key
                          .replace(/([A-Z])/g, " $1")
                          .replace(/^./, (str) => str.toUpperCase())}
                        dot={{
                          r: 4,
                          fill: `var(--graph-${idx}, ${defaultColors[idx % defaultColors.length]})`,
                        }}
                        activeDot={{
                          r: 6,
                          fill: `var(--graph-${idx}, ${defaultColors[idx % defaultColors.length]})`,
                        }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Column - Description and Stats or Table */}
          <div className="flex flex-col items-start justify-center w-[52%] gap-8">
            <p className="text-base leading-relaxed font-normal mb-6 max-w-xl text-left" style={{ color: 'var(--background-text, #234CD9)' }}>
              {data?.description ||
                "Traction is a period where the company is feeling momentum during its development period. If traction momentum is not harnessed, sales figures can decline and the customer base can shrink. In general, companies will judge success by the amount of revenue and new customers they receive."}
            </p>
            {data?.tableMode ? (
              <div className="w-full">
                <div className="rounded-lg ring-1" style={{ borderColor: 'var(--secondary-accent-color, rgba(0,0,0,0.08))' }}>
                  <table className="w-full border-separate border-spacing-0">
                    <thead>
                      <tr>
                        {data.tableColumns?.map((col, idx) => (
                          <th key={idx} className="text-left text-sm font-semibold px-4 py-3 border-b" style={{ borderColor: 'var(--stroke, rgba(0,0,0,0.12))', color: 'var(--primary-color, #1E4CD9)' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.tableRows?.map((row, rIdx) => (
                        <tr key={rIdx} className="align-top">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="text-sm px-4 py-3 border-t" style={{ borderColor: 'var(--stroke, rgba(0,0,0,0.08))', color: 'var(--background-text, #334155)' }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-row w-full gap-6">
                {stats.map((stat, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-lg shadow-sm px-5 py-4 flex flex-col items-start"
                    style={{ backgroundColor: 'var(--primary-color, #F5F8FE)' }}
                  >
                    <div className="text-foreground text-xs font-semibold px-3 py-1 rounded-sm mb-2" style={{ backgroundColor: 'var(--card-color, #234CD9)', color: 'var(--background-text, #ffffff)' }}>
                      {stat.label}
                    </div>
                    <div className="text-2xl font-bold mb-1" style={{ color: 'var(--primary-text, #234CD9)' }}>
                      {stat.value}
                    </div>
                    <p className="text-sm leading-snug" style={{ color: 'var(--primary-text, #234CD9)' }}>
                      {stat.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: 'var(--primary-color, #1E4CD9)' }} />
      </div>
    </>
  );
};

export default CompanyTractionSlideLayout;
