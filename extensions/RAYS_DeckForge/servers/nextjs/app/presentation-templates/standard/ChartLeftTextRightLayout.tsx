import React from 'react'
import * as z from 'zod'
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
} from 'recharts'

const layoutId = 'chart-left-text-right-layout'
const layoutName = 'Chart Left Text Right'
const layoutDescription = 'A slide with header label, a left-side inline bar chart, and right-side title with paragraph.'

const ChartDatumSchema = z.object({
  label: z.string().min(1).max(12).default('A').meta({ description: 'Category label' }),
  value: z.number().min(0).max(100).default(60).meta({ description: 'Value 0–100' }),
})

const Schema = z.object({

  title: z
    .string()
    .min(16)
    .max(64)
    .default('Insights At A Glance')
    .meta({ description: 'Main heading (max ~7 words)' }),
  paragraph: z
    .string()
    .min(50)
    .max(200)
    .default(
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
    )
    .meta({ description: 'Supporting description' }),
  chart: z
    .object({
      type: z.enum(['bar', 'horizontalBar', 'line', 'pie']).default('line'),
      data: z.array(ChartDatumSchema).min(3).max(8).default([
        { label: 'A', value: 60 },
        { label: 'B', value: 42 },
        { label: 'C', value: 75 },
        { label: 'D', value: 30 },
      ]),

      showLabels: z.boolean().default(true),
    })
    .default({
      type: 'line',
      data: [
        { label: 'A', value: 60 },
        { label: 'B', value: 42 },
        { label: 'C', value: 75 },
        { label: 'D', value: 30 },
      ],

      showLabels: true,
    }),
})


const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
];
type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const dynamicSlideLayout: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const data = slideData?.chart?.data || []
  const type = slideData?.chart?.type || 'bar'

  const showLabels = slideData?.chart?.showLabels !== false
  const axisProps = {
    tick: { fill: 'var(--background-text, #7f8491)', fontSize: 12, fontWeight: 600 },
    axisLine: { stroke: 'var(--background-text, #7f8491)' },
    tickLine: { stroke: 'var(--background-text, #7f8491)' },
  };

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div
        className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden"
        style={{ fontFamily: "var(--heading-font-family,Playfair Display)", backgroundColor: 'var(--background-color, #FFFFFF)' }}
      >
        <div className="w-full flex items-center justify-between px-10 pt-6">
          {((slideData as any)?.__companyName__ || (slideData as any)?._logo_url__) && <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">

              {(slideData as any)?._logo_url__ && <img src={(slideData as any)?._logo_url__} alt="logo" className="w-6 h-6" />}
              {(slideData as any)?.__companyName__ && <span className="text-[18px]  font-semibold" style={{ color: 'var(--background-text, #111827)' }}>{(slideData as any)?.__companyName__ || "Pitchdeck"}</span>}
            </div>
            <svg className="w-[220px] h-[2px]" viewBox="0 0 220 2" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="220" height="2" style={{ fill: 'var(--background-text, #111827)' }}></rect>
            </svg>
          </div>}
        </div>

        <div className="grid grid-cols-2 h-[calc(100%-64px)]">
          {/* Left: Recharts visualization */}
          <div className="h-full px-10 pt-8">
            <div className="w-full h-full flex items-center">
              <div className="w-full" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {type === 'bar' ? (
                    <BarChart data={data} margin={{ top: 15, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid stroke="var(--background-text, #E5E7EB)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} label={showLabels ? { position: 'top', fill: 'var(--background-text, #111827)', fontSize: 12 } : false} >{data.map((_, i) => (
                        <Cell key={i} fill={`var(--graph-${i}, ${CHART_COLORS[i % CHART_COLORS.length]})`} />
                      ))}</Bar>
                    </BarChart>
                  ) : type === 'horizontalBar' ? (
                    <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <CartesianGrid stroke="var(--background-text, #E5E7EB)" strokeDasharray="3 3" />
                      <XAxis type="number" {...axisProps} />
                      <YAxis type="category" dataKey="label" {...axisProps} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} label={showLabels ? { position: 'right', fill: 'var(--background-text, #111827)', fontSize: 12 } : false} >{data.map((_, i) => (
                        <Cell key={i} fill={`var(--graph-${i}, ${CHART_COLORS[i % CHART_COLORS.length]})`} />
                      ))}</Bar>
                    </BarChart>
                  ) : type === 'line' ? (
                    <LineChart data={data} margin={{ top: 15, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid stroke="var(--background-text, #E5E7EB)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="value" strokeWidth={3} dot={{ r: 3 }} label={showLabels ? { position: 'top', fill: 'var(--background-text, #111827)', fontSize: 12 } : false} >{data.map((_, i) => (
                        <Cell key={i} fill={`var(--graph-${i}, ${CHART_COLORS[i % CHART_COLORS.length]})`} />
                      ))}</Line>
                    </LineChart>
                  ) : (
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label={showLabels}>
                        {data.map((_, i) => (
                          <Cell key={i} fill={`var(--graph-${i}, ${CHART_COLORS[i % CHART_COLORS.length]})`} />
                        ))}
                      </Pie>
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right: Text */}
          <div className="h-full px-12 flex flex-col justify-center">
            <h1 className="text-[64px] leading-[1.05] tracking-tight font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
              {slideData?.title || 'Insights At A Glance'}
            </h1>
            <p className="mt-6 text-[16px] leading-[28px]" style={{ color: 'var(--background-text, #6B7280)' }}>
              {slideData?.paragraph ||
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default dynamicSlideLayout


