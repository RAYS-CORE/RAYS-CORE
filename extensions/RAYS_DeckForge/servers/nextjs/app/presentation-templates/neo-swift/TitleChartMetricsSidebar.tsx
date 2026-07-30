/**
 * Enhanced TitleChartMetricsSidebar with multiple chart type support
 */
import * as z from 'zod';
import {
    ResponsiveContainer,
    LineChart,
    BarChart,
    PieChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Line,
    Bar,
    Pie,
    Cell,
    LabelList,
    Legend,
    AreaChart,
    Area,
    ScatterChart,
    Scatter,
    ReferenceLine
} from 'recharts';
import React from 'react';

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
]).default('pie');

export const Schema = z.object({
    title: z.string().max(15).describe("The main title of the slide").default("Spend & ROI"),
    chartType: chartTypeEnum.describe('Type of chart to display').default('bar'),
    chart: z.object({
        columns: z.array(z.string()).max(2).describe("The labels for the data series, e.g., Revenue and Spend").default(["Revenue", "Spend"]),
        rows: z.array(z.object({
            label: z.string().max(3).describe("The X-axis label, e.g., Month names").default("Jan"),
            value: z.number().describe("The primary metric value for this label").default(520),
            value2: z.number().optional().describe("The secondary metric value for this label"),
        })).max(3).describe("The data points for the graph"),
    }).default({
        columns: ["Revenue", "Spend"],
        rows: [
            { label: "Jan", value: 520, value2: 140 },
            { label: "Feb", value: 670, value2: 250 },
            { label: "Mar", value: 980, value2: 400 },
        ],
    }).describe("Configuration and data for the chart"),
    metrics: z.array(z.object({
        heading: z.string().max(15).describe("Top label of the metric card"),
        value: z.string().max(10).describe("Main numerical value of the metric").default("8,450"),
        description: z.string().max(35).describe("Bottom description or challenge text").default("Main Challenge: Delayed Client"),
    })).max(4).describe("List of metric cards shown on the right side").default([
        { heading: "Research", value: "8,450", description: "Main Challenge: Delayed Client" },
        { heading: "Research", value: "8,450", description: "Main Challenge: Delayed Client" },
        { heading: "Research", value: "8,450", description: "Main Challenge: Delayed Client" },
        { heading: "Research", value: "8,450", description: "Main Challenge: Delayed Client" },
    ]),

});

export const layoutId = "title-chart-metrics-sidebar";
export const layoutName = "Title Chart Metrics Sidebar";
export const layoutDescription = "A professional slide featuring a prominent chart (bar, grouped bar, stacked bar, clustered bar, diverging bar, horizontal bar, line, area, pie, donut, or scatter) on the left displaying trend data, and a vertical stack of metric cards on the right. Ideal for presenting performance metrics, financial trends, or KPI comparisons with supporting data points.";

const COLORS = ['#4169E1', '#1D8CF8', '#7B9FFF', '#4ECDC4', '#45B7D1', '#10B981', '#244CD9', '#6B89E6', '#4169E1', '#7B9FFF', '#EC4899', '#10B981'];

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
    const fallback = fallbackColor || COLORS[index % COLORS.length];
    return `var(--graph-${index}, ${fallback})`;
};

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const {
        title,
        chartType,
        chart,
        metrics,

    } = data;

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

    const renderChart = () => {
        switch (chartType) {
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <LineChart data={chart?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Line type="monotone" dataKey="value" name={chart?.columns?.[0]} stroke={graphColors(0)} strokeWidth={3} dot={{ r: 5, strokeWidth: 0 }} activeDot={{ r: 7 }} />
                            {chart?.rows?.some(r => r.value2 !== undefined) && (
                                <Line type="monotone" dataKey="value2" name={chart?.columns?.[1]} stroke={graphColors(1)} strokeWidth={3} dot={{ r: 5, strokeWidth: 0 }} activeDot={{ r: 7 }} />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'horizontalBar':
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <BarChart data={chart?.rows} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={80} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" name={chart?.columns?.[0]} radius={[0, 6, 6, 0]} >
                                {chart?.rows?.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} />
                                ))}
                                <LabelList dataKey="value" position="right" fill="#101828" style={{ fontSize: '11px', fontWeight: 600 }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-vertical':
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <BarChart data={chart?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Bar dataKey="value" name={chart?.columns?.[0]} fill={graphColors(0)} radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="value" position="top" fill="#4B5563" style={{ fontSize: '10px', fontWeight: 600 }} />
                            </Bar>
                            {chart?.rows?.some(r => r.value2 !== undefined) && (
                                <Bar dataKey="value2" name={chart?.columns?.[1]} fill={graphColors(1)} radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="value2" position="top" fill="#4B5563" style={{ fontSize: '10px', fontWeight: 600 }} />
                                </Bar>
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <BarChart data={chart?.rows} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={80} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Bar dataKey="value" name={chart?.columns?.[0]} fill={graphColors(0)} radius={[0, 4, 4, 0]} />
                            {chart?.rows?.some(r => r.value2 !== undefined) && (
                                <Bar dataKey="value2" name={chart?.columns?.[1]} fill={graphColors(1)} radius={[0, 4, 4, 0]} />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-vertical':
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <BarChart data={chart?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Bar dataKey="value" name={chart?.columns?.[0]} stackId="stack" fill={graphColors(0)} />
                            {chart?.rows?.some(r => r.value2 !== undefined) && (
                                <Bar dataKey="value2" name={chart?.columns?.[1]} stackId="stack" fill={graphColors(1)} />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <BarChart data={chart?.rows} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={80} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Bar dataKey="value" name={chart?.columns?.[0]} stackId="stack" fill={graphColors(0)} radius={[0, 4, 4, 0]} />
                            {chart?.rows?.some(r => r.value2 !== undefined) && (
                                <Bar dataKey="value2" name={chart?.columns?.[1]} stackId="stack" fill={graphColors(1)} radius={[0, 4, 4, 0]} />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-clustered':
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <BarChart data={chart?.rows} barGap={2} barCategoryGap="20%" margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Bar dataKey="value" name={chart?.columns?.[0]} fill={graphColors(0)} radius={[4, 4, 0, 0]} barSize={30}>
                                <LabelList dataKey="value" position="top" fill="#4B5563" style={{ fontSize: '9px', fontWeight: 600 }} />
                            </Bar>
                            {chart?.rows?.some(r => r.value2 !== undefined) && (
                                <Bar dataKey="value2" name={chart?.columns?.[1]} fill={graphColors(1)} radius={[4, 4, 0, 0]} barSize={30}>
                                    <LabelList dataKey="value2" position="top" fill="#4B5563" style={{ fontSize: '9px', fontWeight: 600 }} />
                                </Bar>
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-diverging': {
                const divergingData = chart?.rows?.map(row => ({
                    label: row.label,
                    positive: row.value,
                    negative: -(row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <BarChart data={divergingData} layout="vertical" stackOffset="sign" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={80} tickFormatter={formatComma} />
                            <ReferenceLine x={0} stroke="#9CA3AF" strokeWidth={1} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Bar dataKey="positive" name={chart?.columns?.[0] || 'Positive'} fill={graphColors(0)} stackId="stack" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="negative" name={chart?.columns?.[1] || 'Negative'} fill={graphColors(3)} stackId="stack" radius={[4, 0, 0, 4]} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            }

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <AreaChart data={chart?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <defs>
                                <linearGradient id="swiftSidebarArea-0" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={graphColors(0)} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={graphColors(0)} stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="swiftSidebarArea-1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={graphColors(1)} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={graphColors(1)} stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value" name={chart?.columns?.[0]} stroke={graphColors(0)} strokeWidth={2} fill="url(#swiftSidebarArea-0)" />
                            {chart?.rows?.some(r => r.value2 !== undefined) && (
                                <Area type="monotone" dataKey="value2" name={chart?.columns?.[1]} stroke={graphColors(1)} strokeWidth={2} fill="url(#swiftSidebarArea-1)" />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'area-stacked':
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <AreaChart data={chart?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <defs>
                                <linearGradient id="swiftSidebarAreaStacked-0" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={graphColors(0)} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={graphColors(0)} stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="swiftSidebarAreaStacked-1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={graphColors(1)} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={graphColors(1)} stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value" name={chart?.columns?.[0]} stackId="1" stroke={graphColors(0)} strokeWidth={2} fill="url(#swiftSidebarAreaStacked-0)" />
                            {chart?.rows?.some(r => r.value2 !== undefined) && (
                                <Area type="monotone" dataKey="value2" name={chart?.columns?.[1]} stackId="1" stroke={graphColors(1)} strokeWidth={2} fill="url(#swiftSidebarAreaStacked-1)" />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'pie': {
                const pieData = chart?.rows?.map((row) => ({
                    name: row.label,
                    value: row.value + (row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <PieChart margin={{ top: 15, right: 15, left: 15, bottom: 15 }}>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            {/* <Legend /> */}
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
                const donutData = chart?.rows?.map((row) => ({
                    name: row.label,
                    value: row.value + (row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <PieChart>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            {/* <Legend /> */}
                            <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {donutData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            }

            case 'scatter': {
                const scatterData = chart?.rows?.map((row) => ({
                    x: row.value,
                    y: row.value2 ?? 0,
                    name: row.label,
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <ScatterChart margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" dataKey="x" name={chart?.columns?.[0]} {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="number" dataKey="y" name={chart?.columns?.[1]} {...axisProps} tickFormatter={formatComma} />
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

                        <BarChart data={chart?.rows} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" name={chart?.columns?.[0]} radius={[6, 6, 0, 0]} >
                                {chart?.rows?.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} />
                                ))}
                                <LabelList dataKey="value" position="top" fill="#101828" style={{ fontSize: '11px', fontWeight: 600 }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );
        }
    };

    const showCustomLegend = chartType !== 'pie' && chartType !== 'donut' && chartType !== 'bar-diverging';

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden flex flex-col p-0 font-['Albert_Sans']"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Albert Sans)',
                }}
            >

                <div className=" flex flex-row  mt-[60px] px-[75px]">

                    {/* Left Content Area: Title + Chart */}
                    <div className="flex-[0.65] flex flex-col mr-[40px]">
                        <h1 className="text-[42.7px] text-foreground mb-[40px] tracking-[-1.6px]  font-bold"

                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {title}
                        </h1>

                        <div className="bg-[#EBEBEB] rounded-lg p-5 flex-1 relative flex flex-col"

                            style={{ backgroundColor: 'var(--card-color,#EBEBEB)' }}
                        >
                            {/* Custom Legend - hide for pie/donut charts since they have built-in legend */}
                            {showCustomLegend && (
                                <div className="flex justify-center gap-8 mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: 'var(--graph-0, #98E1F0)' }}
                                        ></div>
                                        <span className="text-[18px] "
                                            style={{ color: 'var(--background-text, #7f8491)' }}
                                        >{chart?.columns?.[0]}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: 'var(--graph-1, #1D8CF8)' }}
                                        ></div>
                                        <span className="text-[18px] "
                                            style={{ color: 'var(--background-text, #7f8491)' }}
                                        >{chart?.columns?.[1]}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 w-full max-h-[400px]">

                                {renderChart()}

                            </div>
                        </div>
                    </div>

                    {/* Right Content Area: Metrics Sidebar */}
                    <div className="flex-[0.35] flex flex-col justify-end">
                        {metrics?.map((item, index) => (
                            <React.Fragment key={index}>
                                <div className="flex flex-col items-center py-6">
                                    <span className="text-[16px] text-foreground mb-1"

                                        style={{ color: 'var(--background-text,#000000)' }}
                                    >{item.heading}</span>
                                    <span className="text-[36px] font-bold text-foreground leading-none mb-1"

                                        style={{ color: 'var(--background-text,#000000)' }}
                                    >{item.value}</span>
                                    <span className="text-[13px] text-[#4D5463] text-center"

                                        style={{ color: 'var(--background-text,#4D5463)' }}
                                    >{item.description}</span>
                                </div>
                                {index < (metrics.length - 1) && (
                                    <div className="w-[80%] mx-auto h-[1px] bg-[#D3CFCF]"

                                        style={{ backgroundColor: 'var(--stroke,#D3CFCF)' }}
                                    ></div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Footer Area */}
                <div className="flex items-center px-[72px] w-full absolute bottom-4 ">
                    {((data as any)?.__companyName__ || (data as any)?._logo_url__) && <div className="flex items-center gap-1 mr-1">
                        {(data as any)?._logo_url__ && <img src={(data as any)?._logo_url__} alt="logo" className="w-[60px] object-contain" />}
                        <span
                            style={{ backgroundColor: 'var(--stroke, #F0F0F0)' }}
                            className=' w-[2px] h-4'></span>
                        {(data as any)?.__companyName__ && <span className="text-sm  font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                            {(data as any)?.__companyName__ || 'Company Name'}
                        </span>}
                    </div>}
                    <div className="flex-1 h-[3.6px] bg-[#55626E]"

                        style={{ backgroundColor: 'var(--background-text,#55626E)' }}
                    />
                    <div className="relative ml-[-4px] w-[58px] h-[58px] flex items-center justify-center">
                        <div className="w-[41px] h-[41px] bg-[#4D5463] rotate-45"

                            style={{ backgroundColor: 'var(--background-text,#4D5463)' }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default dynamicSlideLayout;
