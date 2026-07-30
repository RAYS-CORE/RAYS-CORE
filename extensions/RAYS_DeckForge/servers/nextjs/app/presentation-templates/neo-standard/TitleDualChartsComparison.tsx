/**
 * Enhanced TitleDualChartsComparison with multiple chart type support
 */
import * as z from 'zod';
import React from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area, ScatterChart, Scatter, ReferenceLine, Tooltip, LabelList } from 'recharts';

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
    title: z.string().describe("The main heading of the slide").default("Competitive Comparison"),
    comparisonSections: z.array(z.object({
        heading: z.string().max(10).describe("The heading for this comparison section"),
        tagline: z.string().max(10).optional().describe("An optional tagline or status text for the section"),
        footerLabel: z.string().max(15).describe("Label displayed at the bottom of the chart area"),
        chartType: chartTypeEnum.describe('Type of chart to display'),
        legendItems: z.array(z.string().max(10)).max(2).describe("Labels for the two data series in the legend"),
        graph: z.object({
            rows: z.array(z.object({
                label: z.string().describe("The label for the individual category"),
                value1: z.number().describe("The first value"),
                value2: z.number().optional().describe("The second value (optional for single-series charts)")
            })).max(4).describe("Data rows for the chart")
        }).describe("Data for the graph in this section")
    })).max(2).default([
        {
            heading: "Campaign A",
            tagline: "Top Campaign",
            footerLabel: "Engangment Rate",
            chartType: "bar",
            legendItems: ["Planned Budget", "Actual Budget"],
            graph: {
                rows: [
                    { label: "Paid Social", value1: 520, value2: 485 },
                    { label: "Content Marketing", value1: 380, value2: 412 },
                    { label: "Events & Sponsorships", value1: 450, value2: 468 },
                    { label: "SEO & Organic", value1: 280, value2: 276 }
                ]
            }
        },
        {
            heading: "Campaign B",
            footerLabel: "Engangment Rate",
            chartType: "bar",
            legendItems: ["Planned Budget", "Actual Budget"],
            graph: {
                rows: [
                    { label: "Paid Social", value1: 520, value2: 485 },
                    { label: "Content Marketing", value1: 380, value2: 412 },
                    { label: "Events & Sponsorships", value1: 450, value2: 468 },
                    { label: "SEO & Organic", value1: 280, value2: 276 }
                ]
            }
        }
    ])
});

export const layoutId = "title-dual-charts-comparison";
export const layoutName = "Title Dual Charts Comparison";
export const layoutDescription = "A comparison slide with a centered title and two side-by-side chart panels, each supporting bar, grouped bar, stacked bar, clustered bar, diverging bar, horizontal bar, line, area, pie, donut, and scatter chart types for data visualization.";

const CHART_COLORS = ['#1F8A2E', '#A9D9B1', '#4CAF50', '#81C784', '#EC4899', '#10B981'];

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
    const { title, comparisonSections } = data;

    const renderChart = (section: typeof comparisonSections extends (infer T)[] | undefined ? T : never) => {
        const chartType = section?.chartType || 'bar';
        const chartData = section?.graph?.rows;
        const hasValue2 = (chartData?.some(row => (row.value2 ?? 0) > 0)) ?? false;


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

        switch (chartType) {
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={380}>
                        <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Line type="monotone" dataKey="value1" stroke="var(--graph-0, #1F8A2E)" strokeWidth={3} dot={{ fill: 'var(--graph-0, #1F8A2E)', r: 5 }} />
                            {hasValue2 && <Line type="monotone" dataKey="value2" stroke="var(--graph-1, #A9D9B1)" strokeWidth={3} dot={{ fill: 'var(--graph-1, #A9D9B1)', r: 5 }} />}
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'horizontalBar':
                return (
                    <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 20, left: 80, bottom: 20 }} barGap={0}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #E5E5E5)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" stackId="a" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [0, 4, 4, 0]} label={{ position: 'center', fill: 'var(--primary-text, #fff)', fontSize: 14, fontFamily: 'Playfair Display Regular' }} />
                            {hasValue2 && <Bar dataKey="value2" stackId="a" fill="var(--graph-1, #A9D9B1)" radius={[0, 4, 4, 0]} label={{ position: 'center', fill: 'var(--background-text, #000)', fontSize: 14, fontFamily: 'Playfair Display Regular' }} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-vertical':
                return (
                    <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }} barGap={2}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" fill="var(--graph-0, #1F8A2E)" radius={[4, 4, 0, 0]} />
                            {hasValue2 && <Bar dataKey="value2" fill="var(--graph-1, #A9D9B1)" radius={[4, 4, 0, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 20, left: 80, bottom: 20 }} barGap={2}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #E5E5E5)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" fill="var(--graph-0, #1F8A2E)" radius={[0, 4, 4, 0]} />
                            {hasValue2 && <Bar dataKey="value2" fill="var(--graph-1, #A9D9B1)" radius={[0, 4, 4, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-vertical':
                return (
                    <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }} barGap={0}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" stackId="stack" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [4, 4, 0, 0]} />
                            {hasValue2 && <Bar dataKey="value2" stackId="stack" fill="var(--graph-1, #A9D9B1)" radius={[4, 4, 0, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 20, left: 80, bottom: 20 }} barGap={0}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #E5E5E5)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" stackId="stack" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [0, 4, 4, 0]} />
                            {hasValue2 && <Bar dataKey="value2" stackId="stack" fill="var(--graph-1, #A9D9B1)" radius={[0, 4, 4, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-clustered':
                return (
                    <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }} barGap={1} barCategoryGap="20%">
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" fill="var(--graph-0, #1F8A2E)" radius={[4, 4, 0, 0]} >
                                <LabelList dataKey="value1" position="top" fill="var(--background-text, #333)" fontSize={10} />
                            </Bar>
                            {hasValue2 && (
                                <Bar dataKey="value2" fill="var(--graph-1, #A9D9B1)" radius={[4, 4, 0, 0]} >
                                    <LabelList dataKey="value2" position="top" fill="var(--background-text, #333)" fontSize={10} />
                                </Bar>
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-diverging': {
                const divergingData = chartData?.map(row => ({
                    label: row.label,
                    positive: row.value1,
                    negative: -(row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={380}>

                        <BarChart data={divergingData} layout="vertical" stackOffset="sign" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={80} tickFormatter={formatComma} />
                            <ReferenceLine x={0} stroke="#9CA3AF" strokeWidth={1} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Bar dataKey="positive" name={section?.legendItems?.[0] || 'Positive'} stackId="stack" fill={graphColors(0)} radius={[0, 4, 4, 0]} />
                            <Bar dataKey="negative" name={section?.legendItems?.[1] || 'Negative'} stackId="stack" fill={graphColors(3)} radius={[4, 0, 0, 4]} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            }

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={380}>
                        <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <defs>
                                <linearGradient id="compArea1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--graph-0, #1F8A2E)" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="var(--graph-0, #1F8A2E)" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="compArea2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--graph-1, #A9D9B1)" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="var(--graph-1, #A9D9B1)" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value1" stroke="var(--graph-0, #1F8A2E)" strokeWidth={2} fill="url(#compArea1)" />
                            {hasValue2 && <Area type="monotone" dataKey="value2" stroke="var(--graph-1, #A9D9B1)" strokeWidth={2} fill="url(#compArea2)" />}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'area-stacked':
                return (
                    <ResponsiveContainer width="100%" height={380}>
                        <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Area type="monotone" dataKey="value1" stackId="1" stroke="var(--graph-0, #1F8A2E)" fill="var(--graph-0, #1F8A2E)" fillOpacity={0.6} />
                            {hasValue2 && <Area type="monotone" dataKey="value2" stackId="1" stroke="var(--graph-1, #A9D9B1)" fill="var(--graph-1, #A9D9B1)" fillOpacity={0.6} />}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'pie': {
                const pieData = chartData?.map((row) => ({
                    name: row.label,
                    value: row.value1 + (row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={380}>

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
                const donutData = chartData?.map((row) => ({
                    name: row.label,
                    value: row.value1 + (row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <PieChart>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent', }} />
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
                const scatterData = chartData?.map((row) => ({
                    x: row.value1,
                    y: row.value2 ?? 0,
                    name: row.label,
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={350}>

                        <ScatterChart margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" dataKey="x" name={section?.legendItems?.[0]} {...axisProps} />
                            <YAxis type="number" dataKey="y" name={section?.legendItems?.[1]} {...axisProps} />
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
                    <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }} barGap={0}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" stackId="a" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [4, 4, 0, 0]} label={{ position: 'center', fill: 'var(--background-text, #fff)', fontSize: 14, fontFamily: 'Playfair Display Regular' }} />
                            {hasValue2 && <Bar dataKey="value2" stackId="a" fill="var(--graph-1, #A9D9B1)" radius={[4, 4, 0, 0]} label={{ position: 'center', fill: 'var(--background-text, #000)', fontSize: 14, fontFamily: 'Playfair Display Regular' }} />}
                        </BarChart>
                    </ResponsiveContainer>
                );
        }
    };

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@380;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Playfair Display)',
                }}
            >

                {/* Main Title */}
                <div className="w-full flex justify-center mt-[60px] mb-[40px]">
                    <h1 className="text-[42.7px] text-[#000000]  font-bold" style={{ letterSpacing: '-1.6px', color: 'var(--background-text,#000000)' }}>
                        {title}
                    </h1>
                </div>

                {/* Comparison Container */}
                <div className="flex justify-center gap-[25px] px-[36px]">
                    {comparisonSections?.map((section, idx) => (
                        <div key={idx} className="relative flex flex-col w-[590px] min-h-[500px] border-[1.3px]  rounded-[6px] p-6"
                            style={{ borderColor: 'var(--stroke,#F0F0F2)' }}
                        >
                            {/* Heading with background */}
                            <div className="absolute left-[15px] top-[-10px] bg-[#1F8A2E] px-4 py-2"

                                style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                            >
                                <span className="text-[28px] text-foreground  font-bold"
                                    style={{ color: 'var(--primary-text,#FFFFFF)' }}
                                >
                                    {section?.heading}
                                </span>
                            </div>

                            {/* Tagline */}
                            {section?.tagline && (
                                <div className="text-right w-full mb-4">
                                    <span className="text-[19px] text-[#1F8A2E] "
                                        style={{ color: 'var(--primary-color,#1F8A2E)' }}
                                    >
                                        {section?.tagline}
                                    </span>
                                </div>
                            )}

                            {/* Legend - Hide for pie/donut charts as they have their own legend */}
                            {section?.chartType !== 'pie' && section?.chartType !== 'donut' && (
                                <div className={`flex justify-center items-center gap-6 mb-4 ${!section?.tagline ? 'mt-8' : ''}`}>
                                    {section?.legendItems?.slice(0, section?.graph?.rows?.some(row => (row.value2 ?? 0) > 0) ? 2 : 1)?.map((item, lIdx) => (
                                        <div key={lIdx} className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${lIdx === 0 ? 'bg-var(--graph-0, #1F8A2E)' : 'bg-var(--graph-1, #A9D9B1)'}`} />
                                            <span className="text-[14px] text-[#555] "
                                                style={{ color: 'var(--background-text, #555)' }}
                                            >{item}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Chart Area */}
                            <div className={`flex-grow w-full h-[300px] ${(section?.chartType === 'pie' || section?.chartType === 'donut') && !section?.tagline ? 'mt-8' : ''}`}>

                                {renderChart(section)}

                            </div>

                            {/* Footer Label */}
                            <div className="absolute right-[20px] bottom-[5px]">
                                <span className="text-[16px] text-[#1F8A2E] "
                                    style={{ color: 'var(--primary-color,#1F8A2E)' }}
                                >
                                    {section?.footerLabel}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                {(data as any)?.__companyName__ || (data as any)?._logo_url__ && <div className="flex items-center gap-1 absolute bottom-5 left-5 z-40">
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
