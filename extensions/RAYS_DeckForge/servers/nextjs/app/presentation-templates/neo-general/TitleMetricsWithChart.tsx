/**
 * Title Metrics With Chart - Enhanced with multiple bar chart variations
 */

import * as z from "zod";
import React from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    LabelList,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    ReferenceLine,
} from "recharts";

// Color palettes
const DEFAULT_CHART_COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899']

const ChartLegend: React.FC<{ series: z.infer<typeof SeriesSchema>[], colors: string[] }> = ({ series, colors }) => (
    <div className="my-2 flex flex-wrap justify-center gap-6">
        {series.map((serie, index) => (
            <div key={serie.name} className="flex items-center gap-2  font-normal text-sm text-[#101828]" style={{ color: 'var(--background-text, #111827)' }}>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: serie.color || colors[index % colors.length] }} />
                {serie.name}
            </div>
        ))}
    </div>
);

const SeriesSchema = z.object({
    name: z.string().max(32),
    color: z.string().optional(),
    values: z.array(z.number()).min(1),
});

// Diverging data
const DivergingDataSchema = z.object({
    name: z.string(),
    positive: z.number(),
    negative: z.number(),
});

export const Schema = z.object({
    title: z.string().max(21).describe('The main heading of the slide').default('Spend & ROI Overview'),
    description: z.string().max(100).describe('Supporting description text for the slide').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    chart: z.object({
        title: z.string().max(64).optional(),
        type: z.enum([
            'line',
            'bar',
            'horizontalBar',
            'bar-grouped-vertical',
            'bar-grouped-horizontal',
            'bar-stacked-vertical',
            'bar-stacked-horizontal',
            'bar-clustered',
            'bar-diverging',
            'area',
            'area-stacked',
            'pie',
            'donut',
        ]).default('bar-stacked-horizontal'),
        categories: z.array(z.string().max(16)).min(1),
        series: z.array(SeriesSchema).min(1),
        divergingData: z.array(DivergingDataSchema).optional(),
        divergingLabels: z.tuple([z.string(), z.string()]).optional(),
        colorPalette: z.enum(['vibrant', 'ocean', 'professional']).default('vibrant'),
    }).describe('Chart configuration to render on the slide').default({
        title: 'Revenue vs Spend',
        type: 'line',
        categories: ['Jan', 'Feb', 'Mar'],
        series: [
            { name: 'Revenue', color: '#8910FA', values: [520, 660, 985] },
            { name: 'Spend', color: '#457EE5', values: [140, 245, 400] },
        ],
        colorPalette: 'vibrant',
    }),
    metrics: z.array(
        z.object({
            value: z.string().max(7).describe('The displayed metric value'),
            label: z.string().max(13).describe('Label describing the metric'),
        })
    ).max(6).default([
        { value: '$1,800K', label: 'Total Planned' },
        { value: '$1,800K', label: 'Total Actual' },
        { value: '$1,800K', label: 'Total Planned' },
        { value: '$1,800K', label: 'Total Actual' },
        { value: '$1,800K', label: 'Total Planned' },
        { value: '$1,800K', label: 'Total Actual' },
    ]),
});

type SlideData = z.infer<typeof Schema>;

export const layoutId = 'title-metrics-with-chart';
export const layoutName = 'Chart With Sidebar Metrics';
export const layoutDescription = 'A two-column layout featuring a bold title, a large chart container on the left, and up to 6 vertical metrics on the right sidebar. Supports line, bar, grouped, stacked, clustered, diverging, area, pie, and donut charts.';

const buildChartData = (
    categories: string[],
    series: any[]
) => categories.map((category, index) => {
    const entry: Record<string, string | number> = { name: category };
    series.forEach((serie) => {
        entry[serie.name] = serie.values[index] ?? 0;
    });
    return entry;
});

const buildSimpleData = (categories: string[], series: any[]) => {
    if (series.length === 0) return [];
    return categories.map((name, index) => ({
        name,
        value: series[0].values[index] ?? 0,
    }));
};

const transformDivergingData = (data: any[]) => {
    return data.map(item => ({
        name: item.name,
        positive: item.positive,
        negative: -Math.abs(item.negative),
    }));
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2"
                style={{
                    backgroundColor: 'var(--card-color, #ffffff)',
                    borderColor: 'var(--stroke, #e5e7eb)',
                }}
            >
                <p className="text-sm font-semibold text-foreground mb-1" style={{ color: 'var(--background-text, #111827)' }}>{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-xs" style={{ color: 'var(--background-text, #111827)' }}>
                        {entry.name}: <span className="font-medium">{entry.value?.toLocaleString()}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const ChartRenderer: React.FC<{ chart: { categories: string[]; series: any[], type: string, divergingData?: any[], divergingLabels?: [string, string] } }> = ({ chart }) => {

    const data = buildChartData(chart.categories, chart.series);
    const simpleData = buildSimpleData(chart.categories, chart.series);

    const formatComma = (value: number) => {
        return value.toLocaleString('en-US');
    };
    const axisProps = {
        tick: { fill: 'var(--background-text, #7f8491)', fontSize: 11, fontWeight: 500 },
        axisLine: { stroke: 'var(--background-text, #7f8491)' },
        tickLine: { stroke: 'var(--background-text, #7f8491)' },
    };

    const gridProps = {
        strokeDasharray: "3 3",
        stroke: "var(--background-text, #7f8491)",
        opacity: 0.6,
    };

    const graphColors = (index: number, serieColor?: string) => {
        const fallback = serieColor || DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
        return `var(--graph-${index}, ${fallback})`;
    };

    switch (chart.type) {
        case 'line':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={data} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        {chart.series.map((serie, index) => (
                            <Line
                                key={serie.name}
                                type="monotone"
                                dataKey={serie.name}
                                stroke={graphColors(index, serie.color)}
                                strokeWidth={3}
                                dot={{ r: 5, strokeWidth: 0 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            );

        case 'bar':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart

                        data={data} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        {chart.series.map((serie, index) => (
                            <Bar
                                key={serie.name}
                                dataKey={serie.name}
                                fill={graphColors(index, serie.color)}

                                radius={[6, 6, 0, 0]}
                            >
                                <LabelList dataKey={serie.name} position="top" fill="var(--background-text,#101828)" style={{ fontSize: '13px', fontFamily: 'Poppins' }} />
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'horizontalBar':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} layout="vertical" margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        {chart.series.map((serie, index) => (
                            <Bar
                                key={serie.name}
                                dataKey={serie.name}
                                fill={graphColors(index, serie.color)}
                                radius={[0, 6, 6, 0]}
                            >
                                <LabelList dataKey={serie.name} position="middle" fill="var(--background-text,#101828)" style={{ fontSize: '13px', fontFamily: 'Poppins' }} />
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'bar-grouped-vertical':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        {chart.series.map((serie, index) => (
                            <Bar
                                key={serie.name}
                                dataKey={serie.name}
                                fill={graphColors(index, serie.color)}
                                radius={[4, 4, 0, 0]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'bar-grouped-horizontal':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} layout="vertical" margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={80} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        {chart.series.map((serie, index) => (
                            <Bar
                                key={serie.name}
                                dataKey={serie.name}
                                fill={graphColors(index, serie.color)}
                                radius={[0, 4, 4, 0]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'bar-stacked-vertical':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        {chart.series.map((serie, index) => (
                            <Bar
                                key={serie.name}
                                dataKey={serie.name}
                                stackId="stack"
                                fill={graphColors(index, serie.color)}
                                radius={index === chart.series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'bar-stacked-horizontal':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} layout="vertical" margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={80} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        {chart.series.map((serie, index) => (
                            <Bar
                                key={serie.name}
                                dataKey={serie.name}
                                stackId="stack"
                                fill={graphColors(index, serie.color)}
                                radius={index === chart.series.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'bar-clustered':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} barGap={2} barCategoryGap="20%" margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        {chart.series.map((serie, index) => (
                            <Bar
                                key={serie.name}
                                dataKey={serie.name}
                                fill={graphColors(index, serie.color)}
                                radius={[4, 4, 0, 0]}
                                barSize={Math.max(20, 60 / chart.series.length)}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'bar-diverging': {
            const divergingData = chart.divergingData ? transformDivergingData(chart.divergingData) :
                chart.series.length >= 2 ? chart.categories.map((name, index) => ({
                    name,
                    positive: chart.series[0].values[index] ?? 0,
                    negative: -(chart.series[1].values[index] ?? 0),
                })) : [];
            const labels = chart.divergingLabels || [chart.series[0]?.name || 'Positive', chart.series[1]?.name || 'Negative'];

            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={divergingData} layout="vertical" stackOffset="sign" margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={80} tickFormatter={formatComma} />
                        <ReferenceLine x={0} stroke="#9CA3AF" strokeWidth={1} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        <Bar
                            dataKey="positive"
                            name={labels[0]}
                            fill={graphColors(0)}
                            stackId="stack"
                            radius={[0, 4, 4, 0]}
                        />
                        <Bar
                            dataKey="negative"
                            name={labels[1]}
                            fill={graphColors(3)}
                            stackId="stack"
                            radius={[4, 0, 0, 4]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        case 'area':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={data} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <defs>
                            {chart.series.map((serie, index) => (
                                <linearGradient key={serie.name} id={`metrics-gradient-${serie.name}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={graphColors(index, serie.color)} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={graphColors(index, serie.color)} stopOpacity={0.05} />
                                </linearGradient>
                            ))}
                        </defs>
                        {chart.series.map((serie, index) => (
                            <Area
                                key={serie.name}
                                type="monotone"
                                dataKey={serie.name}
                                stroke={graphColors(index, serie.color)}
                                strokeWidth={2}
                                fill={`url(#metrics-gradient-${serie.name})`}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            );

        case 'area-stacked':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={data} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        {chart.series.map((serie, index) => (
                            <Area
                                key={serie.name}
                                type="monotone"
                                dataKey={serie.name}
                                stackId="1"
                                stroke={graphColors(index, serie.color)}
                                fill={graphColors(index, serie.color)}
                                fillOpacity={0.5}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            );

        case 'pie': {
            const pieData = simpleData.length > 0 ? simpleData :
                chart.categories.map((name, index) => ({
                    name,
                    value: chart.series.reduce((sum, s) => sum + (s.values[index] || 0), 0),
                }));
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <PieChart margin={{ top: 15, right: 15, left: 15, bottom: 15 }}>
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                            {pieData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            );
        }

        case 'donut': {
            const donutData = simpleData.length > 0 ? simpleData :
                chart.categories.map((name, index) => ({
                    name,
                    value: chart.series.reduce((sum, s) => sum + (s.values[index] || 0), 0),
                }));
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <PieChart margin={{ top: 15, right: 15, left: 15, bottom: 15 }}>
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        <Pie
                            data={donutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={120}
                            dataKey="value"
                            paddingAngle={2}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                            {donutData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            );
        }

        default:
            return (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    Unsupported chart type: {chart.type}
                </div>
            );
    }
};

const dynamicSlideLayout: React.FC<{ data: Partial<SlideData> }> = ({ data }) => {
    const { title, description, chart, metrics } = data;


    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden  font-['Poppins'] gap-6 font-normal px-16 py-10"

                style={{
                    fontFamily: 'var(--heading-font-family,Poppins)',
                    background: "var(--background-color,#ffffff)"
                }}
            >
                {((data as any)?.__companyName__ || (data as any)?._logo_url__) && (
                    <div className="absolute top-0 left-0 right-0 px-8  pt-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                {(data as any)?._logo_url__ && <img src={(data as any)?._logo_url__} alt="logo" className="w-[60px] object-contain" />}
                                <span
                                    style={{ backgroundColor: 'var(--stroke, #F0F0F0)' }}
                                    className=' w-[2px] h-4'></span>
                                {(data as any)?.__companyName__ && <span className="text-sm  font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                                    {(data as any)?.__companyName__ || 'Company Name'}
                                </span>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content Area */}

                <div className="mb-8 flex justify-between">
                    <div className="max-w-[400px]">
                        <h1 className="text-[42.7px] font-bold leading-tight mb-4 tracking-[-2px]" style={{ color: 'var(--background-text,#101828)' }}>
                            {title}
                        </h1>
                        <div className="w-[116.6px] h-[5.7px]" style={{ backgroundColor: 'var(--primary-color,#9234EB)' }} />
                    </div>
                    <p className="text-[17.8px] max-w-[560px] leading-[1.6]" style={{ color: 'var(--background-text,#000000)' }}>
                        {description}
                    </p>
                </div>

                {/* Graph Section */}
                <div className=" flex justify-between items-center gap-6 w-full">
                    <div className=" flex-1 border  rounded-xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card-color,#F0F0F2)', borderColor: 'var(--stroke,#F0F0F2)' }}>
                        <ChartLegend series={chart?.series ?? []} colors={DEFAULT_CHART_COLORS} />
                        <ChartRenderer chart={chart ?? { categories: [], series: [], type: 'bar' }} />
                    </div>
                    <div className="  flex-1 flex flex-wrap items-center  justify-start gap-x-8 gap-y-12 pl-4">
                        {metrics?.map((metric, index) => (
                            <div key={index} className=" max-w-[245px] w-full ">
                                <div className="text-[45px] font-medium leading-none" style={{ color: 'var(--background-text,#4D5463)' }}>
                                    {metric.value}
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                    <div className="w-[10.5px] h-[10.5px] rounded-full" style={{ backgroundColor: 'var(--primary-color,#9134EB)' }} />
                                    <div className="text-[14px] font-normal uppercase tracking-wide" style={{ color: 'var(--background-text,#4D5463)' }}>
                                        {metric.label}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>





            </div>
        </>
    );
};

export default dynamicSlideLayout;
