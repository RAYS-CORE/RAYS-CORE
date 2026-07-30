/**
 * Enhanced Full Width Chart Slide
 * Supports multiple bar chart types including grouped, stacked, clustered, and diverging
 */

import {
    LabelList,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    CartesianGrid,
    XAxis,
    YAxis,
    Bar,
    BarChart,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    Legend,
    ReferenceLine,
} from 'recharts';
import * as z from 'zod';
import React from 'react';

// Default color palettes for beautiful charts (fallback)
const DEFAULT_CHART_COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899']



// Series schema for multi-series charts
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
    title: z.string().max(30).describe('The main title of the slide').default('Spend & ROI Dashbo       ard'),
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
        ]).default('bar'),
        categories: z.array(z.string().max(16)).min(1),
        series: z.array(SeriesSchema).min(1),
        // For diverging charts
        divergingData: z.array(DivergingDataSchema).optional(),
        divergingLabels: z.tuple([z.string(), z.string()]).optional(),

    }).describe('Chart configuration to render on the slide').default({
        title: 'Revenue vs Spend',
        type: 'bar',
        categories: ['Jan', 'Feb', 'Mar'],
        series: [
            { name: 'Revenue', color: '#8910FA', values: [520, 660, 185, 200, 250, 300] },
            { name: 'Spend', color: '#457EE5', values: [140, 245, 400] },
        ],

    }),
});

type FormData = z.infer<typeof Schema>;

export const layoutId = 'title-with-full-width-chart';
export const layoutName = 'Title With Full-Width Chart';
export const layoutDescription = 'A centered layout with a bold title and underline accent, followed by a full-width chart container with legend. Supports line, bar, grouped, stacked, clustered, diverging, area, pie, and donut charts.';

const ChartLegend: React.FC<{ series: z.infer<typeof SeriesSchema>[], colors: string[] }> = ({ series, colors }) => {
    const totalSeries = series.length;
    const getSpreadIndex = (index: number) => {
        if (totalSeries <= 1) return 0;
        return Math.floor((index * 10) / totalSeries) % 10;
    };

    return (
        <div className="my-2 flex flex-wrap justify-center gap-6">
            {series.map((serie, index) => {
                const spreadIndex = getSpreadIndex(index);
                const fallback = serie.color || colors[index % colors.length];
                return (
                    <div key={serie.name} className="flex items-center gap-2 font-normal text-sm" style={{ color: 'var(--background-text,#101828)' }}>
                        <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: `var(--graph-${spreadIndex}, ${fallback})` }}
                        />
                        {serie.name}
                    </div>
                );
            })}
        </div>
    );
};

const buildChartData = (
    categories: string[],
    series: z.infer<typeof SeriesSchema>[]
) => categories.map((category, index) => {
    const entry: Record<string, string | number> = { name: category };
    series.forEach((serie) => {
        entry[serie.name] = serie.values[index] ?? 0;
    });
    return entry;
});

// Build simple data for single series charts
const buildSimpleData = (categories: string[], series: z.infer<typeof SeriesSchema>[]) => {
    if (series.length === 0) return [];
    return categories.map((name, index) => ({
        name,
        value: series[0].values[index] ?? 0,
    }));
};

// Transform diverging data
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

const ChartRenderer: React.FC<{ chart: z.infer<typeof Schema>['chart'] }> = ({ chart }) => {
    const colors = DEFAULT_CHART_COLORS;
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
        opacity: 0.7,
    };


    const graphColors = (index: number, serieColor?: string) => {
        const fallback = serieColor || colors[index % colors.length];
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
                                activeDot={{ r: 7 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            );

        case 'bar':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
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
                                <LabelList dataKey={serie.name} position="top" fill="#101828" style={{ fontSize: '11px', fontWeight: 600 }} />
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'horizontalBar':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={80} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        {chart.series.map((serie, index) => (
                            <Bar
                                key={serie.name}
                                dataKey={serie.name}
                                fill={graphColors(index, serie.color)}

                                radius={[0, 6, 6, 0]}
                            >
                                <LabelList dataKey={serie.name} position="right" fill="#101828" style={{ fontSize: '11px', fontWeight: 600 }} />
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
                            >
                                <LabelList dataKey={serie.name} position="top" fill="#4B5563" style={{ fontSize: '10px', fontWeight: 600 }} />
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'bar-grouped-horizontal':
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
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
                    <BarChart data={data} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
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
                            >
                                <LabelList dataKey={serie.name} position="top" fill="#4B5563" style={{ fontSize: '9px', fontWeight: 600 }} />
                            </Bar>
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
                    <BarChart data={divergingData} layout="vertical" stackOffset="sign" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
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
                                <linearGradient key={serie.name} id={`gradient-${serie.name}`} x1="0" y1="0" x2="0" y2="1">
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
                                fill={`url(#gradient-${serie.name})`}
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
                            outerRadius={140}
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
                    <PieChart>
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        <Pie
                            data={donutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={140}
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

const dynamicSlideLayout: React.FC<{ data: Partial<FormData> }> = ({ data }) => {
    const { title, chart } = data;
    const chartConfig = chart;
    const colors = DEFAULT_CHART_COLORS;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col items-center px-[48px] py-[40px]"

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
                <div className="flex flex-col items-center gap-[16px]">
                    <h1 className="text-[42.7px] font-bold tracking-[-2px]" style={{ color: 'var(--background-text,#101828)' }}>
                        {title || 'Spend & ROI Dashboard'}
                    </h1>
                    <div className="w-[116.6px] h-[5.7px]" style={{ backgroundColor: 'var(--primary-color,#9234EB)' }} />
                </div>

                <div className="mt-10 w-full">
                    <div className="rounded-[24px] px-6 py-6 border  w-full" style={{ backgroundColor: 'var(--card-color,#F0F0F2)', borderColor: 'var(--stroke,#F0F0F2)' }}>
                        <ChartLegend series={chartConfig?.series ?? []} colors={colors} />
                        <ChartRenderer chart={chartConfig ?? { categories: [], series: [], type: 'bar' }} />
                    </div>
                </div>
            </div>
        </>
    );
};

export default dynamicSlideLayout;
