/**
 * Zod Schema for the slide content.
 * Enhanced with multiple chart type support
 */
import * as z from 'zod'
import React from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, LabelList, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ScatterChart, Scatter, ReferenceLine } from 'recharts';

const chartTypeEnum = z.enum([
    'bar',
    'horizontalBar',
    'bar-grouped-vertical',
    'bar-grouped-horizontal',
    'bar-stacked-vertical',
    'bar-stacked-horizontal',
    'bar-clustered',
    'bar-diverging',
    'line',
    'area',
    'area-stacked',
    'pie',
    'donut',
    'scatter'
]).default('bar');

export const Schema = z.object({
    title: z.string().max(25).describe("The main heading of the slide").default("Barchart with Description & metrix"),
    description: z.string().max(180).describe("Supporting description text").default("Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies."),
    metricCards: z.array(z.object({
        heading: z.string().max(25).describe("Label text for the metric card"),
        value: z.string().max(8).describe("Value displayed in the metric card")
    })).max(4).describe("List of metric cards displayed in a grid").default([
        { heading: "Main Challenge: Delayed Client", value: "85%" },
        { heading: "Total Registered Users", value: ">500 M" },
    ]),
    chartTitle: z.string().max(12).describe("Title text for the chart").default("Campaign A"),
    chartCategory: z.string().max(12).describe("Secondary label text").default("Top Campaign"),
    chartFooterLabel: z.string().max(15).describe("Footer label text for the chart").default("Engangment Rate"),
    chartType: chartTypeEnum.describe('Type of chart to display'),
    chartData: z.object({
        columns: z.array(z.string()).max(2).describe("Names of the chart data series"),
        rows: z.array(z.object({
            label: z.string().describe("The x-axis category label"),
            value1: z.number().describe("The first series value"),
            value2: z.number().optional().describe("The second series value (optional for single-series charts)")
        })).max(4).describe("The data rows for the chart")
    }).describe("The data used to render the chart").default({
        columns: ["Planned Budget", "Actual Budget"],
        rows: [
            { label: "Paid Social", value1: 920, value2: 485 },
            { label: "Content Marketing", value1: 380, value2: 412 },
            { label: "Events & Sponsorships", value1: 450, value2: 468 },
            { label: "SEO & Organic", value1: 280, value2: 276 }
        ]
    })
});

export const layoutId = "title-description-metrics-chart";
export const layoutName = "Title Description Metrics Chart";
export const layoutDescription = "A slide featuring a main title, description, metric cards grid on the left, and a chart panel on the right. Supports bar, grouped bar, stacked bar, clustered bar, diverging bar, horizontal bar, line, area, pie, donut, and scatter chart types.";

const CHART_COLORS = ['#244CD9', '#6B89E6', '#4169E1', '#7B9FFF', '#EC4899', '#10B981'];

// Custom tooltip matching TitleWithFullWidthChart style
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

// Helper function for graph colors
const graphColors = (index: number, fallbackColor?: string) => {
    const fallback = fallbackColor || CHART_COLORS[index % CHART_COLORS.length];
    return `var(--graph-${index}, ${fallback})`;
};

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const {
        title,
        description,
        metricCards,
        chartTitle,
        chartCategory,
        chartFooterLabel,
        chartData,
        chartType = 'bar'
    } = data;

    const renderChart = () => {
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

        const hasValue2 = (chartData?.rows?.some(row => (row.value2 ?? 0) > 0)) ?? false;

        switch (chartType) {
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={chartData?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            {chartData?.columns?.map((column, index) => (
                                <Line type="monotone" dataKey={column} name={column} stroke={graphColors(index)} strokeWidth={3} dot={{ r: 5, strokeWidth: 0 }} activeDot={{ r: 7 }} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'horizontalBar':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData?.rows} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', color: '#6B7280' }} formatter={(value, entry, index) => chartData?.columns?.[index] || value} />
                            <Bar dataKey="value1" stackId="a" fill={graphColors(0)} barSize={35} radius={hasValue2 ? undefined : [0, 4, 4, 0]} label={{ position: 'inside', fill: 'var(--primary-text, #fff)', fontSize: 12 }} />
                            {hasValue2 && <Bar dataKey="value2" stackId="a" fill={graphColors(1)} radius={[0, 4, 4, 0]} barSize={35} label={{ position: 'inside', fill: 'var(--primary-text, #fff)', fontSize: 12 }} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-vertical':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            {chartData?.columns?.map((column, index) => (
                                <Bar dataKey={column} name={column} fill={graphColors(index)} radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey={column} position="top" fill="var(--background-text, #4B5563)" style={{ fontSize: '10px', fontWeight: 600 }} />
                                </Bar>
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData?.rows} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={80} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            {chartData?.columns?.map((column, index) => (
                                <Bar dataKey={column} name={column} fill={graphColors(index)} radius={[0, 4, 4, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-vertical':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry, index) => chartData?.columns?.[index] || value} />
                            <Bar dataKey="value1" stackId="stack" fill={graphColors(0)} barSize={50} radius={hasValue2 ? undefined : [4, 4, 0, 0]} />
                            {hasValue2 && <Bar dataKey="value2" stackId="stack" fill={graphColors(1)} radius={[4, 4, 0, 0]} barSize={50} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData?.rows} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry, index) => chartData?.columns?.[index] || value} />
                            <Bar dataKey="value1" stackId="stack" fill={graphColors(0)} barSize={30} radius={hasValue2 ? undefined : [0, 4, 4, 0]} />
                            {hasValue2 && <Bar dataKey="value2" stackId="stack" fill={graphColors(1)} radius={[0, 4, 4, 0]} barSize={30} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-clustered':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData?.rows} barGap={2} barCategoryGap="20%" margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            {chartData?.columns?.map((column, index) => (
                                <Bar dataKey={column} name={column} fill={graphColors(index)} radius={[4, 4, 0, 0]} barSize={30}>
                                    <LabelList dataKey={column} position="top" fill="var(--background-text, #4B5563)" style={{ fontSize: '9px', fontWeight: 600 }} />
                                </Bar>
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-diverging': {
                const divergingData = chartData?.rows?.map(row => ({
                    label: row.label,
                    positive: row.value1,
                    negative: -(row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={divergingData} layout="vertical" stackOffset="sign" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={80} tickFormatter={formatComma} />
                            <ReferenceLine x={0} stroke="var(--background-text, #9CA3AF)" strokeWidth={1} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            {chartData?.columns?.map((column, index) => (
                                <Bar dataKey="positive" name={column} fill={graphColors(index)} stackId="stack" radius={[0, 4, 4, 0]} />

                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );
            }

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={chartData?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <defs>
                                {chartData?.columns?.map((column, index) => (
                                    <linearGradient key={`metricsArea-${index}`} id={`metricsArea-${index}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={graphColors(index)} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={graphColors(index)} stopOpacity={0.05} />
                                    </linearGradient>
                                ))}
                            </defs>
                            {chartData?.columns?.map((column, index) => (
                                <Area type="monotone" dataKey={column} name={column} stroke={graphColors(index)} strokeWidth={2} fill={`url(#metricsArea${index})`} />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'area-stacked':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={chartData?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            {chartData?.columns?.map((column, index) => (
                                <Area type="monotone" dataKey={column} name={column} stackId="1" stroke={graphColors(index)} fill={graphColors(index)} fillOpacity={0.5} />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'pie': {
                const pieData = chartData?.rows?.map((row) => ({
                    name: row.label,
                    value: row.value1 + (row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <PieChart margin={{ top: 15, right: 15, left: 15, bottom: 15 }}>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Pie data={pieData} cx="50%" cy="50%" outerRadius={120} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {pieData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            }

            case 'donut': {
                const donutData = chartData?.rows?.map((row) => ({
                    name: row.label,
                    value: row.value1 + (row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={120} dataKey="value" paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {donutData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            }

            case 'scatter': {
                const scatterData = chartData?.rows?.map((row) => ({
                    x: row.value1,
                    y: row.value2 ?? 0,
                    name: row.label,
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <ScatterChart margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" dataKey="x" name={chartData?.columns?.[0]} {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="number" dataKey="y" name={chartData?.columns?.[1]} {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', fill: 'transparent' }} />
                            <Scatter data={scatterData} fill={graphColors(0)}>
                                {scatterData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                );
            }

            case 'bar':
            default:
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData?.rows} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', color: '#6B7280' }} formatter={(value, entry, index) => chartData?.columns?.[index] || value} />
                            <Bar dataKey="value1" stackId="a" fill={graphColors(0)} radius={hasValue2 ? [0, 0, 0, 0] : [2, 2, 0, 0]} barSize={70} label={{ position: 'inside', fill: 'var(--primary-text, #fff)', fontSize: 12 }} />
                            {hasValue2 && <Bar dataKey="value2" stackId="a" fill={graphColors(1)} radius={[2, 2, 0, 0]} barSize={70} label={{ position: 'inside', fill: 'var(--primary-text, #fff)', fontSize: 12 }} />}
                        </BarChart>
                    </ResponsiveContainer>
                );
        }
    };

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden flex font-['Montserrat'] font-normal"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >

                <div className="flex w-full h-full p-[60px] gap-[40px]">
                    {/* Left Section */}
                    <div className="flex flex-col basis-[45%] justify-center h-full">
                        <h1 className="text-[42.7px] font-bold leading-[1.1] tracking-[-1.6px] mb-[20px]"
                            style={{ color: 'var(--background-text,#002BB2)' }}
                        >
                            {title}
                        </h1>
                        <p className="text-[16px] font-normal leading-[1.6] mb-[60px]"
                            style={{ color: 'var(--background-text,#002BB2)' }}
                        >
                            {description}
                        </p>

                        <div className="grid grid-cols-2 gap-[18px]">
                            {metricCards?.map((metric, index) => {
                                const isEven = index % 2 === 0;
                                return (
                                    <div
                                        key={index}
                                        className="p-[25px] rounded-[4px] h-[152px] flex flex-col justify-between"
                                        style={{ backgroundColor: isEven ? 'var(--card-color,#6B89E6)' : 'var(--card-color,#F7F8FF)' }}
                                    >
                                        <span
                                            className="text-[17.8px] leading-[1.3]"
                                            style={{ color: isEven ? 'var(--background-text,#FFFFFF)' : 'var(--background-text,#244CD9)' }}
                                        >
                                            {metric.heading}
                                        </span>
                                        <span
                                            className="text-[39.3px] font-bold leading-[1.1]"
                                            style={{ color: isEven ? 'var(--background-text,#FFFFFF)' : 'var(--background-text,#244CD9)' }}
                                        >
                                            {metric.value}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Section */}
                    <div className="flex flex-col basis-[55%] h-full justify-center">
                        <div className="flex justify-between items-end mb-[20px] px-[20px]">
                            <h2 className="text-[28.4px] font-bold"
                                style={{ color: 'var(--background-text,#244CD9)' }}
                            >
                                {chartTitle}
                            </h2>
                            <span className="text-[18.7px] font-normal opacity-70"
                                style={{ color: 'var(--background-text,#244CD9)' }}
                            >
                                {chartCategory}
                            </span>
                        </div>

                        <div className="flex-grow border rounded-[6px] p-[20px] relative"
                            style={{
                                backgroundColor: 'var(--card-color,#FFFFFF)',
                                borderColor: 'var(--stroke,#F0F0F2)',
                            }}
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                {renderChart()}
                            </ResponsiveContainer>
                            <div className="absolute bottom-[-15px] right-[20px] text-[16px] font-normal italic opacity-80"
                                style={{ color: 'var(--background-text,#244CD9)' }}
                            >
                                {chartFooterLabel}
                            </div>
                        </div>
                    </div>
                </div>
                {(data as any)?.__companyName__ || (data as any)?._logo_url__ && <div className="flex items-center gap-1 absolute top-5 left-5 z-40">
                    {(data as any)?._logo_url__ && <img src={(data as any)?._logo_url__} alt="logo" className="w-[60px] object-contain" />}
                    <span
                        style={{ backgroundColor: 'var(--stroke, #F0F0F0)' }}
                        className=' w-[2px] h-4'></span>
                    {(data as any)?.__companyName__ && <span className="text-sm  font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                        {(data as any)?.__companyName__ || 'Company Name'}
                    </span>}
                </div>}
            </div>
        </>
    );
};
export default dynamicSlideLayout;
