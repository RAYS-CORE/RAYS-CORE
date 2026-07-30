import React from "react"
import * as z from "zod"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const layoutId = "tableorChart"
const layoutName = "Table Or Chart"
const layoutDescription = "Swift: Generic data table with option to render a chart (bar, horizontalBar, line, pie)"

const ChartDatumSchema = z.object({
  label: z.string().min(1).max(12).default("A"),
  value: z.number().min(0).max(1000000).default(60),
})

const TableRowSchema = z.object({
  cells: z
    .array(z.string().min(0).max(200))
    .min(2)
    .max(10)
    .default(["Row 1", "Value", "Value"])
    .meta({ description: "Row cells; count should match columns length" }),
})

const Schema = z
  .object({
    title: z.string().min(6).max(60).default("Data Table or Chart"),
    description: z
      .string()
      .min(20)
      .max(220)
      .default(
        "Present structured information in a flexible table or visualize it with a chart."
      ),

    mode: z.enum(["table", "chart"]).default("table"),

    // Table configuration (generic)
    columns: z
      .array(z.string().min(1).max(40))
      .min(2)
      .max(10)
      .default(["Column 1", "Column 2", "Column 3"]),
    rows: z
      .array(TableRowSchema)
      .min(1)
      .max(30)
      .default([
        { cells: ["Row A", "✓", "-"] },
        { cells: ["Row B", "Text", "123"] },
        { cells: ["Row C", "More text", "456"] },
      ]),

    // Chart configuration (parity with @standard ChartLeftTextRightLayout)
    chart: z
      .object({
        type: z.enum(["bar", "horizontalBar", "line", "pie"]).default("line"),
        data: z.array(ChartDatumSchema).min(3).max(12).default([
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

    website: z.string().min(6).max(60).default("www.yourwebsite.com"),
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
    website: "www.yourwebsite.com",
  })

const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
];

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const TableOrChart: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const mode = slideData?.mode || "table"
  const columns = slideData?.columns || []
  const rows = slideData?.rows || []

  const cData = slideData?.chart?.data || []
  const type = slideData?.chart?.type || "bar"

  const showLabels = slideData?.chart?.showLabels !== false

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden"
        style={{
          fontFamily: "var(--heading-font-family,Albert Sans)",
          backgroundColor: "var(--background-color, #FFFFFF)",
        }}
      >
        {/* Header */}
        <div className="px-12 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rotate-45" style={{ backgroundColor: "var(--background-text, #111827)" }}></div>
            <div className="flex items-center gap-1">

              {(slideData as any)?._logo_url__ && <img src={(slideData as any)?._logo_url__} alt="logo" className="w-6 h-6" />}
              {(slideData as any)?.__companyName__ && <span className="text-[16px]" style={{ color: "var(--background-text, #6B7280)" }}>{(slideData as any)?.__companyName__}</span>}
            </div>
          </div>
        </div>

        {/* Title and description */}
        <div className="px-12 pt-3">
          <h1 className="text-[48px] leading-[1.1] font-semibold" style={{ color: "var(--background-text, #111827)" }}>{slideData?.title}</h1>
          <p className="mt-3 text-[16px] max-w-[900px]" style={{ color: "var(--background-text, #6B7280)" }}>{slideData?.description}</p>
        </div>

        {/* Content area: Table or Chart */}
        <div className="px-12 pt-6">
          {mode === "table" ? (
            <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--primary-color, #BFF4FF)' }}>
              <div className="overflow-x-auto rounded-lg bg-card ring-1" style={{ borderColor: 'var(--stroke, #E5E7EB)' }}>
                <table className="w-full border-separate border-spacing-0">
                  <thead className="w-full">
                    <tr>
                      {columns.map((col, idx) => (
                        <th
                          key={idx}
                          className="text-left  w-full text-[14px] font-semibold px-4 py-3 border-b first:rounded-tl-md last:rounded-tr-md"
                          style={{
                            color: 'var(--primary-text, #111827)',
                            borderColor: 'var(--stroke, #E5E7EB)',
                            backgroundColor: 'var(--primary-color, #BFF4FF)'
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} className="align-top">
                        {columns.map((_, cIdx) => (
                          <td
                            key={cIdx}
                            className={`text-[14px] px-4 py-3 border-t ${rIdx === rows.length - 1 ? 'first:rounded-bl-md last:rounded-br-md' : ''}`}
                            style={{
                              color: 'var(--primary-text, #6B7280)',
                              borderColor: 'rgba(0,0,0,0.08)',
                              backgroundColor: rIdx % 2 === 0 ? 'var(--primary-color, #BFF4FF)' : 'var(--card-color, #F3F4F6)'
                            }}
                          >
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
            <div className="w-full h-[360px] rounded-xl p-4" >
              <ResponsiveContainer width="100%" height="100%">
                {type === 'bar' ? (
                  <BarChart data={cData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--background-text, #6B7280)', fontWeight: 600 }} />
                    <YAxis tick={{ fill: 'var(--background-text, #6B7280)', fontWeight: 600 }} />
                    <Tooltip labelStyle={{ color: 'var(--background-text, #6B7280)' }} itemStyle={{ color: 'var(--background-text, #6B7280)' }} />
                    <Legend wrapperStyle={{ color: 'var(--background-text, #6B7280)' }} />
                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} label={showLabels ? { position: 'top', fill: 'var(--background-text, #111827)', fontSize: 12 } : false} >{cData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}</Bar>
                  </BarChart>
                ) : type === 'horizontalBar' ? (
                  <BarChart data={cData} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                    <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fill: 'var(--background-text, #6B7280)', fontWeight: 600 }} />
                    <YAxis type="category" dataKey="label" tick={{ fill: 'var(--background-text, #6B7280)', fontWeight: 600 }} />
                    <Tooltip labelStyle={{ color: 'var(--background-text, #6B7280)' }} itemStyle={{ color: 'var(--background-text, #6B7280)' }} />
                    <Legend wrapperStyle={{ color: 'var(--background-text, #6B7280)' }} />
                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 6, 6, 0]} label={showLabels ? { position: 'right', fill: 'var(--background-text, #111827)', fontSize: 12 } : false} >{cData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}</Bar>
                  </BarChart>
                ) : type === 'line' ? (
                  <LineChart data={cData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--background-text, #6B7280)', fontWeight: 600 }} />
                    <YAxis tick={{ fill: 'var(--background-text, #6B7280)', fontWeight: 600 }} />
                    <Tooltip labelStyle={{ color: 'var(--background-text, #6B7280)' }} itemStyle={{ color: 'var(--background-text, #6B7280)' }} />
                    <Legend wrapperStyle={{ color: 'var(--background-text, #6B7280)' }} />
                    <Line type="monotone" dataKey="value" strokeWidth={3} dot={{ r: 3 }} label={showLabels ? { position: 'top', fill: 'var(--background-text, #111827)', fontSize: 12 } : false} >{cData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}</Line>
                  </LineChart>
                ) : (
                  <PieChart>
                    <Tooltip labelStyle={{ color: 'var(--background-text, #6B7280)' }} itemStyle={{ color: 'var(--background-text, #6B7280)' }} />
                    <Legend wrapperStyle={{ color: 'var(--background-text, #6B7280)' }} />
                    <Pie data={cData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={120} label={showLabels ? { fill: 'var(--background-text, #6B7280)' } : false}>
                      {cData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Footer (standardized like IntroSlideLayout) */}
        <div className="absolute bottom-8 left-12 right-12 flex items-center">
          <span className="text-[14px]" style={{ color: "var(--background-text, #6B7280)" }}>{slideData?.website}</span>
          <div className="ml-6 h-[2px] flex-1" style={{ backgroundColor: "var(--background-text, #111827)" }}></div>
        </div>
        <div className="absolute bottom-7 right-6 w-8 h-8 rotate-45" style={{ backgroundColor: "var(--background-text, #111827)" }}></div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default TableOrChart


