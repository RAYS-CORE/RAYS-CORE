/**
 * Enhanced Comparison Slide with multiple chart type support
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
    title: z.string().max(50).describe("The main title of the slide").default("Competitive Comparison"),
    comparisonCards: z.array(z.object({
        heading: z.string().max(20).describe("The title of the item"),
        subHeading: z.string().max(20).optional().describe("An optional badge or subtitle"),
        footerText: z.string().max(25).describe("The text displayed at the bottom of the chart area"),
        chartType: chartTypeEnum.describe('Type of chart to display'),
        chart: z.object({
            columns: z.array(z.string()).max(5).describe("The labels for the X-axis categories"),
            rows: z.array(
                z.array(
                    z.object({
                        label: z.string().max(30).describe("The name of the data series"),
                        value: z.number().describe("The numerical value for this series segment")
                    })
                ).min(1).max(2).describe("1 or 2 series per category; second series is optional for single-series charts")
            ).max(5).describe("Data for the chart. Each inner array represents a category on the X-axis with multiple series.")
        })
    })).max(2).describe("A list of up to 2 items").default([
        {
            heading: "Campaign A",
            subHeading: "Top Campaign",
            footerText: "Engagement Rate",
            chartType: "bar",
            chart: {
                columns: ["Paid Social", "Content Marketing", "Events & Sponsorships", "SEO & Organic"],
                rows: [
                    [{ label: "Planned", value: 520 }, { label: "Actual", value: 485 }],
                    [{ label: "Planned", value: 380 }, { label: "Actual", value: 412 }],
                    [{ label: "Planned", value: 400 }, { label: "Actual", value: 468 }],
                    [{ label: "Planned", value: 280 }, { label: "Actual", value: 276 }]
                ]
            }
        },
        {
            heading: "Campaign B",
            footerText: "Engagement Rate",
            chartType: "bar",
            chart: {
                columns: ["Paid Social", "Content Marketing", "Events & Sponsorships", "SEO & Organic"],
                rows: [
                    [{ label: "Planned", value: 520 }, { label: "Actual", value: 485 }],
                    [{ label: "Planned", value: 380 }, { label: "Actual", value: 412 }],
                    [{ label: "Planned", value: 400 }, { label: "Actual", value: 468 }],
                    [{ label: "Planned", value: 280 }, { label: "Actual", value: 276 }]
                ]
            }
        }
    ])
});

export const layoutId = "title-dual-comparison-charts";
export const layoutName = "Title Dual Comparison Charts";
export const layoutDescription = "A comparison slide with a main title and two side-by-side chart panels, each supporting bar, grouped bar, stacked bar, clustered bar, diverging bar, horizontal bar, line, area, pie, donut, and scatter chart types.";

const CHART_COLORS = ['#244CD9', '#6A89E6', '#4169E1', '#7B9FFF', '#EC4899', '#10B981'];

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
    const { title, comparisonCards } = data;

    const renderChart = (card: NonNullable<typeof comparisonCards>[number]) => {
        const chartType = card.chartType || 'bar';
        const formatComma = (value: number) => {
            return value.toLocaleString('en-US');
        };
        // Transform schema data to Recharts format
        const chartData = card.chart?.columns?.map((col, cIdx) => ({
            name: col,
            series1: card.chart?.rows?.[cIdx]?.[0]?.value ?? 0,
            series2: card.chart?.rows?.[cIdx]?.[1]?.value ?? 0,
            series1Name: card.chart?.rows?.[cIdx]?.[0]?.label || "Series 1",
            series2Name: card.chart?.rows?.[cIdx]?.[1]?.label || "Series 2",
        })) || [];

        const hasSeries2 = chartData.some(item => (item.series2 ?? 0) > 0);

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

        switch (chartType) {
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={chartData} margin={{ top: 40, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry: any) => { if (entry.dataKey === 'series1') return chartData[0]?.series1Name; if (entry.dataKey === 'series2') return chartData[0]?.series2Name; return value; }} />
                            <Line type="monotone" dataKey="series1" stroke={graphColors(0)} strokeWidth={3} dot={{ fill: graphColors(0), r: 5 }} />
                            <Line type="monotone" dataKey="series2" stroke={graphColors(1)} strokeWidth={3} dot={{ fill: graphColors(1), r: 5 }} />
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'horizontalBar':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 40, right: 10, left: 60, bottom: 20 }} barGap={0}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #7f8491)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="name" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry: any) => { if (entry.dataKey === 'series1') return chartData[0]?.series1Name; if (entry.dataKey === 'series2') return chartData[0]?.series2Name; return value; }} />
                            <Bar dataKey="series1" stackId="a" fill={graphColors(0)} barSize={30} radius={hasSeries2 ? undefined : [0, 4, 4, 0]}>
                                <LabelList dataKey="series1" position="center" fill="var(--primary-text, #FFFFFF)" fontSize={12} />
                            </Bar>
                            {hasSeries2 && (
                                <Bar dataKey="series2" stackId="a" fill={graphColors(1)} barSize={30} radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="series2" position="center" fill="var(--primary-text, #FFFFFF)" fontSize={12} />
                                </Bar>
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-vertical':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chartData} margin={{ top: 40, right: 10, left: -20, bottom: 20 }} barGap={2}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry: any) => { if (entry.dataKey === 'series1') return chartData[0]?.series1Name; if (entry.dataKey === 'series2') return chartData[0]?.series2Name; return value; }} />
                            <Bar dataKey="series1" fill={graphColors(0)} radius={[4, 4, 0, 0]} barSize={30} />
                            <Bar dataKey="series2" fill={graphColors(1)} radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>

                    </ResponsiveContainer>
                );

            case 'bar-grouped-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 40, right: 10, left: 60, bottom: 20 }} barGap={2}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #7f8491)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="name" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry: any) => { if (entry.dataKey === 'series1') return chartData[0]?.series1Name; if (entry.dataKey === 'series2') return chartData[0]?.series2Name; return value; }} />
                            <Bar dataKey="series1" fill={graphColors(0)} radius={[0, 4, 4, 0]} barSize={15} />
                            <Bar dataKey="series2" fill={graphColors(1)} radius={[0, 4, 4, 0]} barSize={15} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-vertical':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chartData} margin={{ top: 40, right: 10, left: -20, bottom: 20 }} barGap={0}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry: any) => { if (entry.dataKey === 'series1') return chartData[0]?.series1Name; if (entry.dataKey === 'series2') return chartData[0]?.series2Name; return value; }} />
                            <Bar dataKey="series1" stackId="stack" fill={graphColors(0)} barSize={50} radius={hasSeries2 ? undefined : [4, 4, 0, 0]} />
                            {hasSeries2 && <Bar dataKey="series2" stackId="stack" fill={graphColors(1)} radius={[4, 4, 0, 0]} barSize={50} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 40, right: 10, left: 60, bottom: 20 }} barGap={0}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #7f8491)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="name" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry: any) => { if (entry.dataKey === 'series1') return chartData[0]?.series1Name; if (entry.dataKey === 'series2') return chartData[0]?.series2Name; return value; }} />
                            <Bar dataKey="series1" stackId="stack" fill={graphColors(0)} barSize={25} radius={hasSeries2 ? undefined : [0, 4, 4, 0]} />
                            {hasSeries2 && <Bar dataKey="series2" stackId="stack" fill={graphColors(1)} radius={[0, 4, 4, 0]} barSize={25} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-clustered':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chartData} margin={{ top: 40, right: 10, left: -20, bottom: 20 }} barGap={1} barCategoryGap="20%">
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry: any) => { if (entry.dataKey === 'series1') return chartData[0]?.series1Name; if (entry.dataKey === 'series2') return chartData[0]?.series2Name; return value; }} />
                            <Bar dataKey="series1" fill={graphColors(0)} radius={[4, 4, 0, 0]} barSize={25}>
                                <LabelList dataKey="series1" position="top" fill="var(--background-text, #333)" fontSize={10} />
                            </Bar>
                            <Bar dataKey="series2" fill={graphColors(1)} radius={[4, 4, 0, 0]} barSize={25}>
                                <LabelList dataKey="series2" position="top" fill="var(--background-text, #333)" fontSize={10} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-diverging': {
                const divergingData = chartData.map(item => ({
                    name: item.name,
                    positive: item.series1,
                    negative: -(item.series2 ?? 0),
                }));
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={divergingData} layout="vertical" margin={{ top: 40, right: 10, left: 60, bottom: 20 }} stackOffset="sign">
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #7f8491)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="name" {...axisProps} tickFormatter={formatComma} />
                            <ReferenceLine x={0} stroke="var(--background-text, #9CA3AF)" strokeWidth={1} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} />
                            <Bar dataKey="positive" name={chartData[0]?.series1Name || 'Positive'} fill={graphColors(0)} stackId="stack" radius={hasSeries2 ? [0, 4, 4, 0] : [4, 4, 4, 4]} barSize={20} />
                            {hasSeries2 && <Bar dataKey="negative" name={chartData[0]?.series2Name || 'Negative'} fill={graphColors(1)} stackId="stack" radius={[4, 0, 0, 4]} barSize={20} />}
                        </BarChart>
                    </ResponsiveContainer>
                );
            }

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={chartData} margin={{ top: 40, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry: any) => { if (entry.dataKey === 'series1') return chartData[0]?.series1Name; if (entry.dataKey === 'series2') return chartData[0]?.series2Name; return value; }} />
                            <defs>
                                <linearGradient id="dualArea1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={graphColors(0)} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={graphColors(0)} stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="dualArea2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={graphColors(1)} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={graphColors(1)} stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="series1" stroke={graphColors(0)} strokeWidth={2} fill="url(#dualArea1)" />
                            <Area type="monotone" dataKey="series2" stroke={graphColors(1)} strokeWidth={2} fill="url(#dualArea2)" />
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'area-stacked':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={chartData} margin={{ top: 40, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry: any) => { if (entry.dataKey === 'series1') return chartData[0]?.series1Name; if (entry.dataKey === 'series2') return chartData[0]?.series2Name; return value; }} />
                            <Area type="monotone" dataKey="series1" stackId="1" stroke={graphColors(0)} fill={graphColors(0)} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="series2" stackId="1" stroke={graphColors(1)} fill={graphColors(1)} fillOpacity={0.6} />
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'pie': {
                const pieData = chartData.map((item) => ({
                    name: item.name,
                    value: item.series1 + item.series2,
                }));
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <PieChart margin={{ top: 15, right: 15, left: 15, bottom: 15 }}>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {pieData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            }

            case 'donut': {
                const donutData = chartData.map((item) => ({
                    name: item.name,
                    value: item.series1 + item.series2,
                }));
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <PieChart>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={100} dataKey="value" paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {donutData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            }

            case 'scatter': {
                const scatterData = chartData.map((item) => ({
                    x: item.series1,
                    y: item.series2,
                    name: item.name,
                }));
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <ScatterChart margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" dataKey="x" name={chartData[0]?.series1Name} {...axisProps} />
                            <YAxis type="number" dataKey="y" name={chartData[0]?.series2Name} {...axisProps} />
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
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chartData} margin={{ top: 40, right: 10, left: -20, bottom: 20 }} barGap={0}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} formatter={(value, entry: any) => { if (entry.dataKey === 'series1') return chartData[0]?.series1Name; if (entry.dataKey === 'series2') return chartData[0]?.series2Name; return value; }} />
                            <Bar dataKey="series1" stackId="a" fill={graphColors(0)} barSize={70} radius={hasSeries2 ? undefined : [4, 4, 0, 0]}>
                                <LabelList dataKey="series1" position="center" fill="var(--primary-text, #FFFFFF)" fontSize={12} />
                            </Bar>
                            {hasSeries2 && (
                                <Bar dataKey="series2" stackId="a" fill={graphColors(1)} barSize={70} radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="series2" position="center" fill="var(--primary-text, #FFFFFF)" fontSize={12} />
                                </Bar>
                            )}
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
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden flex flex-col p-10 "
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >

                {/* Main Title */}
                <div className="w-full text-center mb-10">
                    <h1 className="text-[42.7px]  font-bold tracking-[-1.5px]"
                        style={{ color: 'var(--background-text,#002BB2)' }}
                    >
                        {title}
                    </h1>
                </div>

                {/* Comparison Sections */}
                <div className=" flex-1 flex gap-8 justify-center  px-4">
                    {comparisonCards?.map((card, idx) => {
                        return (
                            <div key={idx} className="flex-1  bg-card border border-[#F0F0F2] rounded-lg p-4 flex flex-col relative"
                                style={{ backgroundColor: 'var(--card-color,#FFFFFF)', borderColor: 'var(--stroke,#F0F0F2)' }}
                            >

                                {/* Card Header */}
                                <div className="flex justify-between items-center mb-2">
                                    <h2 className="text-[28px]  font-bold"
                                        style={{ color: 'var(--background-text,#002BB2)' }}
                                    >
                                        {card.heading}
                                    </h2>
                                    {card.subHeading && (
                                        <span className="text-[18px]  font-normal"
                                            style={{ color: 'var(--background-text,#002BB2)' }}
                                        >
                                            {card.subHeading}
                                        </span>
                                    )}
                                </div>

                                {/* Chart Container */}
                                <div className=" w-full min-h-0">

                                    {renderChart(card)}

                                </div>

                                {/* Footer Text */}
                                <div className=" absolute bottom-4 right-6 text-right ">
                                    <p className="text-[16px]  font-normal"
                                        style={{ color: 'var(--background-text,#002BB2)' }}
                                    >
                                        {card.footerText}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
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
