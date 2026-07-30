import React from "react";
import * as z from "zod";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const layoutId = "chart-or-table-with-description";
export const layoutName = "Chart or Table With Description";
export const layoutDescription =
  "Chart with description slide layout";

const businessModelSchema = z
  .object({

    title: z.string().min(3).max(60).default("Data Table or Chart"),
    description: z
      .string()
      .default(
        "Present structured information in a flexible table or visualize it with a chart.",
      )
      .meta({
        description: "Supporting description for the table/chart",
      }),

    mode: z.enum(["table", "chart"]).default("chart"),

    // Table configuration (generic)
    columns: z
      .array(z.string().min(1).max(40))
      .min(2)
      .max(10)
      .default(["Column 1", "Column 2", "Column 3"]),
    rows: z
      .array(
        z.object({
          cells: z
            .array(z.string().min(0).max(200))
            .min(2)
            .max(10)
            .default(["Row 1", "Value", "Value"]),
        }),
      )
      .min(1)
      .max(30)
      .default([
        { cells: ["Row A", "✓", "-"] },
        { cells: ["Row B", "Text", "123"] },
        { cells: ["Row C", "More text", "456"] },
      ]),

    // Chart configuration (parity with Swift TableorChart)
    chart: z
      .object({
        type: z.enum(["bar", "horizontalBar", "line", "pie"]).default("line"),
        data: z
          .array(z.object({ label: z.string().min(1).max(12), value: z.number() }))
          .min(3)
          .max(12)
          .default([
            { label: "A", value: 60 },
            { label: "B", value: 42 },
            { label: "C", value: 75 },
            { label: "D", value: 30 },
          ]),

        showLabels: z.boolean().default(true),
      })
      .default({
        type: "line",
        data: [
          { label: "A", value: 60 },
          { label: "B", value: 42 },
          { label: "C", value: 75 },
          { label: "D", value: 30 },
        ],

        showLabels: true,
      }),
  })
  .default({

    title: "Data Table or Chart",
    description:
      "Present structured information in a flexible table or visualize it with a chart.",
    mode: "table",
    columns: ["Column 1", "Column 2", "Column 3"],
    rows: [
      { cells: ["Row A", "✓", "-"] },
      { cells: ["Row B", "Text", "123"] },
      { cells: ["Row C", "More text", "456"] },
    ],
    chart: {
      type: "line",
      data: [
        { label: "A", value: 60 },
        { label: "B", value: 42 },
        { label: "C", value: 75 },
        { label: "D", value: 30 },
      ],

      showLabels: true,
    },
  });


const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
];

export const Schema = businessModelSchema;
export type BusinessModelData = z.infer<typeof businessModelSchema>;

interface Props {
  data?: Partial<BusinessModelData>;
}



const BusinessModelSlide: React.FC<Props> = ({ data }) => {
  const mode = data?.mode || "table";
  const columns = data?.columns || [];
  const rows = data?.rows || [];

  const cData = data?.chart?.data || [];
  const type = data?.chart?.type || "bar";

  const showLabels = data?.chart?.showLabels !== false;
  const axisProps = {
    tick: { fill: 'var(--background-text, #7f8491)', fontSize: 12, fontWeight: 600 },
    axisLine: { stroke: 'var(--background-text, #7f8491)' },
    tickLine: { stroke: 'var(--background-text, #7f8491)' },
  };

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
          {/* Left Column - Title and description */}
          <div className="flex-1 pr-12 flex flex-col justify-center">
            <h1 className="text-5xl font-bold mb-4 leading-tight text-left" style={{ color: 'var(--background-text, #234CD9)' }}>
              {data?.title}
            </h1>
            <p className="text-base leading-relaxed font-normal max-w-xl text-left" style={{ color: 'var(--background-text, #234CD9)' }}>
              {data?.description}
            </p>
          </div>

          {/* Right Column - Table or Chart (based on mode) */}
          <div className="flex flex-col items-start justify-center w-[52%] gap-8">
            {mode === "table" ? (
              <div className="w-full">
                <div className="rounded-lg border" style={{ borderColor: 'var(--stroke, rgba(0,0,0,0.08))' }}>
                  <table className="w-full border-separate border-spacing-0">
                    <thead>
                      <tr>
                        {columns.map((col, idx) => (
                          <th key={idx} className="text-left text-sm font-semibold px-4 py-3 border-b" style={{ borderColor: 'var(--stroke, rgba(0,0,0,0.12))', color: 'var(--primary-color, #1E4CD9)' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rIdx) => (
                        <tr key={rIdx} className="align-top">
                          {columns.map((_, cIdx) => (
                            <td key={cIdx} className="text-sm px-4 py-3 border-t" style={{ borderColor: 'var(--stroke, rgba(0,0,0,0.08))', color: 'var(--background-text, #334155)' }}>
                              {row.cells[cIdx] || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="w-full">
                <div className="bg-card rounded-lg shadow p-4"
                  style={{ backgroundColor: 'var(--card-color, #F5F8FE)' }}
                >
                  <div className="w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      {type === "bar" ? (
                        <BarChart data={cData} margin={{ top: 20, right: 20, left: 0, bottom: 10 }} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" stroke={`var(--background-text, #E5E7EB)`} />
                          <XAxis dataKey="label" {...axisProps} />
                          <YAxis {...axisProps} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[8, 8, 0, 0]} label={showLabels ? { position: 'top', fill: 'var(--background-text, #111827)', fontSize: 12 } : false} >
                            {cData.map((_, i) => (
                              <Cell key={i} fill={`var(--graph-${i}, ${CHART_COLORS[i % CHART_COLORS.length]})`} />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : type === "horizontalBar" ? (
                        <BarChart data={cData} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={`var(--background-text, #E5E7EB)`} />
                          <XAxis type="number" {...axisProps} />
                          <YAxis type="category" dataKey="label" {...axisProps} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 6, 6, 0]} label={showLabels ? { position: 'right', fill: 'var(--background-text, #111827)', fontSize: 12 } : false} >
                            {cData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : type === "line" ? (
                        <LineChart data={cData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={`var(--background-text, #E5E7EB)`} />
                          <XAxis dataKey="label" {...axisProps} />
                          <YAxis {...axisProps} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="value" strokeWidth={3} dot={{ r: 4, color: CHART_COLORS[0] }} label={showLabels ? { position: 'top', fill: 'var(--background-text, #111827)', fontSize: 12 } : false} >
                            {cData.map((_, i) => (
                              <Cell key={i} fill={`var(--graph-${i}, ${CHART_COLORS[i % CHART_COLORS.length]})`} />
                            ))}
                          </Line>
                        </LineChart>
                      ) : (
                        <PieChart >
                          <Tooltip />
                          <Legend />
                          <Pie data={cData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label={showLabels}>
                            {cData.map((_, i) => (
                              <Cell key={i} fill={`var(--graph-${i}, ${CHART_COLORS[i % CHART_COLORS.length]})`} />
                            ))}
                          </Pie>
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: 'var(--primary-color, #1E4CD9)' }} />
      </div>
    </>
  );
};

export default BusinessModelSlide;
