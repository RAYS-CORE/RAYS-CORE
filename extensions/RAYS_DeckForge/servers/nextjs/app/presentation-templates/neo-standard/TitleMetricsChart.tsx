/**
 * Enhanced TitleMetricsChart with multiple chart type support
 */
import * as z from 'zod';
import React from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar, LabelList, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area, ScatterChart, Scatter, ReferenceLine, Tooltip } from 'recharts';

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
    title: z.string().max(40).describe("The main title of the slide").default("Barchart with Description & metrix"),
    description: z.string().max(250).describe("The description of the slide").default("Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies."),
    metrics: z.array(z.object({
        value: z.string().max(5).describe("The numerical value or percentage"),
        label: z.string().max(40).describe("The label describing the metric")
    })).max(4).describe("Four metric boxes displayed in a grid").default([
        { value: "85%", label: "Main Challenge: Delayed Client" },
        { value: "85%", label: "Main Challenge: Delayed Client" },
        { value: "85%", label: "Main Challenge: Delayed Client" },
        { value: "85%", label: "Main Challenge: Delayed Client" }
    ]),
    chart: z.object({
        title: z.string().max(20).describe("The text in the green highlight box above the chart"),
        topLabel: z.string().max(20).describe("Secondary label at the top right of the chart area"),
        bottomLabel: z.string().max(20).describe("Secondary label at the bottom right of the chart area"),
        chartType: chartTypeEnum.describe('Type of chart to display'),
        seriesNames: z.array(z.string()).max(2).describe("The names of the two data series for the legend"),
        data: z.array(z.object({
            label: z.string().max(20).describe("Category label on the X-axis"),
            value1: z.number().describe("Value for the first series"),
            value2: z.number().optional().describe("Value for the second series (optional for single-series charts)")
        })).max(4).describe("Data points for the chart")
    }).describe("Configuration for the chart").default({
        title: "Campaign A",
        topLabel: "Top Campaign",
        bottomLabel: "Engangment Rate",
        chartType: "bar",
        seriesNames: ["Planned_Budget_K", "Actual_Budget_K"],
        data: [
            { label: "Paid Social", value1: 520, value2: 485 },
            { label: "Content Marketing", value1: 380, value2: 412 },
            { label: "Events & Sponsorships", value1: 450, value2: 468 },
            { label: "SEO & Organic", value1: 280, value2: 276 }
        ]
    })
});

export const layoutId = "title-metrics-chart";
export const layoutName = "Title Metrics Chart";
export const layoutDescription = "A two-column slide with a title, description, and 2x2 metric grid on the left, and a chart panel on the right supporting bar, grouped bar, stacked bar, clustered bar, diverging bar, horizontal bar, line, area, pie, donut, and scatter chart types.";

const CHART_COLORS = ['#1F8A2E', '#A8D9A8', '#4CAF50', '#81C784', '#EC4899', '#10B981'];

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
    const { title, description, metrics, chart } = data;
    const chartType = chart?.chartType || 'bar';

    const renderChart = () => {
        const hasValue2 = (chart?.data?.some(row => (row.value2 ?? 0) > 0)) ?? false;

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
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={chart?.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={10} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Line type="monotone" dataKey="value1" stroke="var(--graph-0, #1F8A2E)" strokeWidth={3} dot={{ fill: 'var(--graph-0, #1F8A2E)', r: 5 }} />
                            {hasValue2 && <Line type="monotone" dataKey="value2" stroke="var(--graph-1, #A8D9A8)" strokeWidth={3} dot={{ fill: 'var(--graph-1, #A8D9A8)', r: 5 }} />}
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'horizontalBar':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chart?.data} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 20 }} barGap={0}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #E0E0E0)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" stackId="a" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [0, 4, 4, 0]}>
                                <LabelList dataKey="value1" position="center" fill="var(--primary-text, #FFFFFF)" style={{ fontSize: '14px', fontFamily: 'Open Sans Regular' }} />
                            </Bar>
                            {hasValue2 && (
                                <Bar dataKey="value2" stackId="a" fill="var(--graph-1, #A8D9A8)" radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="value2" position="center" fill="var(--background-text, #000000)" style={{ fontSize: '14px', fontFamily: 'Open Sans Regular' }} />
                                </Bar>
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-vertical':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chart?.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }} barGap={2}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={10} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" fill="var(--graph-0, #1F8A2E)" radius={[4, 4, 0, 0]} />
                            {hasValue2 && <Bar dataKey="value2" fill="var(--graph-1, #A8D9A8)" radius={[4, 4, 0, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chart?.data} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 20 }} barGap={2}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #E0E0E0)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" fill="var(--graph-0, #1F8A2E)" radius={[0, 4, 4, 0]} />
                            {hasValue2 && <Bar dataKey="value2" fill="var(--graph-1, #A8D9A8)" radius={[0, 4, 4, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-vertical':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chart?.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }} barGap={0}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={10} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" stackId="stack" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [4, 4, 0, 0]} />
                            {hasValue2 && <Bar dataKey="value2" stackId="stack" fill="var(--graph-1, #A8D9A8)" radius={[4, 4, 0, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chart?.data} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 20 }} barGap={0}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #E0E0E0)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" stackId="stack" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [0, 4, 4, 0]} />
                            {hasValue2 && <Bar dataKey="value2" stackId="stack" fill="var(--graph-1, #A8D9A8)" radius={[0, 4, 4, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-clustered':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chart?.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }} barGap={1} barCategoryGap="20%">
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={10} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" fill="var(--graph-0, #1F8A2E)" radius={[4, 4, 0, 0]} >
                                <LabelList dataKey="value1" position="top" fill="var(--background-text, #000)" style={{ fontSize: '11px', fontFamily: 'Open Sans Regular' }} />
                            </Bar>
                            {hasValue2 && (
                                <Bar dataKey="value2" fill="var(--graph-1, #A8D9A8)" radius={[4, 4, 0, 0]} >
                                    <LabelList dataKey="value2" position="top" fill="var(--background-text, #000)" style={{ fontSize: '11px', fontFamily: 'Open Sans Regular' }} />
                                </Bar>
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-diverging': {
                const divergingData = chart?.data?.map(row => ({
                    label: row.label,
                    positive: row.value1,
                    negative: -(row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={400}>

                        <BarChart data={divergingData} layout="vertical" stackOffset="sign" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={80} tickFormatter={formatComma} />
                            <ReferenceLine x={0} stroke="var(--background-text, #9CA3AF)" strokeWidth={1} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Bar dataKey="positive" name={chart?.seriesNames?.[0] || 'Positive'} stackId="stack" fill={graphColors(0)} radius={[0, 4, 4, 0]} />
                            <Bar dataKey="negative" name={chart?.seriesNames?.[1] || 'Negative'} stackId="stack" fill={graphColors(3)} radius={[4, 0, 0, 4]} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            }

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={chart?.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={10} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <defs>
                                <linearGradient id="metricsArea1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--graph-0, #1F8A2E)" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="var(--graph-0, #1F8A2E)" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="metricsArea2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--graph-1, #A8D9A8)" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="var(--graph-1, #A8D9A8)" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value1" stroke="var(--graph-0, #1F8A2E)" strokeWidth={2} fill="url(#metricsArea1)" />
                            {hasValue2 && <Area type="monotone" dataKey="value2" stroke="var(--graph-1, #A8D9A8)" strokeWidth={2} fill="url(#metricsArea2)" />}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'area-stacked':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={chart?.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={10} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Area type="monotone" dataKey="value1" stackId="1" stroke="var(--graph-0, #1F8A2E)" fill="var(--graph-0, #1F8A2E)" fillOpacity={0.6} />
                            {hasValue2 && <Area type="monotone" dataKey="value2" stackId="1" stroke="var(--graph-1, #A8D9A8)" fill="var(--graph-1, #A8D9A8)" fillOpacity={0.6} />}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'pie': {
                const pieData = chart?.data?.map((row) => ({
                    name: row.label,
                    value: row.value1 + (row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={400}>

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
                const donutData = chart?.data?.map((row) => ({
                    name: row.label,
                    value: row.value1 + (row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={400}>

                        <PieChart>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={120} dataKey="value" paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {donutData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            }

            case 'scatter': {
                const scatterData = chart?.data?.map((row) => ({
                    x: row.value1,
                    y: row.value2 ?? 0,
                    name: row.label,
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={400}>

                        <ScatterChart margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" dataKey="x" name={chart?.seriesNames?.[0]} {...axisProps} />
                            <YAxis type="number" dataKey="y" name={chart?.seriesNames?.[1]} {...axisProps} />
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
                        <BarChart data={chart?.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={10} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value1" stackId="a" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [4, 4, 0, 0]}>
                                <LabelList dataKey="value1" position="center" fill="var(--primary-text, #FFFFFF)" style={{ fontSize: '14px', fontFamily: 'Open Sans Regular' }} />
                            </Bar>
                            {hasValue2 && (
                                <Bar dataKey="value2" stackId="a" fill="var(--graph-1, #A8D9A8)" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="value2" position="center" fill="var(--background-text, #000000)" style={{ fontSize: '14px', fontFamily: 'Open Sans Regular' }} />
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
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden flex flex-row p-[60px] gap-[40px]"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Playfair Display)',
                }}
            >

                {/* Left Column */}
                <div className="flex flex-col basis-[42%] justify-start">
                    <h1 className="text-[42.7px] text-foreground  font-bold leading-[1.1] mb-[20px] tracking-[-1.6px]"
                        style={{ color: 'var(--background-text,#000000)' }}
                    >
                        {title}
                    </h1>
                    <p className="text-[16px] text-foreground  leading-[1.6] mb-[40px]"
                        style={{ color: 'var(--background-text,#000000)' }}
                    >
                        {description}
                    </p>
                    <div className="grid grid-cols-2 gap-[25px]">
                        {metrics?.map((metric, index) => (
                            <div key={index} className="bg-[#1F8A2E] rounded-[8px] p-[20px] flex flex-col items-center justify-center text-foreground text-center shadow-md min-h-[150px]"

                                style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                            >
                                <div className="text-[39px]  leading-[1]"
                                    style={{ color: 'var(--primary-text,#FFFFFF)' }}
                                >
                                    {metric.value}
                                </div>
                                <div className="text-[17.8px]  mt-[5px] leading-[1.2]"
                                    style={{ color: 'var(--primary-text,#FFFFFF)' }}
                                >
                                    {metric.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column */}
                <div className="flex flex-col basis-[58%] bg-card border-[1.3px] border-[#F0F0F2] rounded-[6px] p-[20px]"

                    style={{ borderColor: 'var(--stroke,#F0F0F2)', backgroundColor: 'var(--card-color,#FFFFFF)' }}
                >
                    <div className="flex justify-between items-end mb-[20px]">
                        <div className="bg-[#1F8A2E] px-[20px] py-[8px]"

                            style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                        >
                            <span className="text-foreground  font-bold text-[28.4px]"
                                style={{ color: 'var(--primary-text,#FFFFFF)' }}
                            >
                                {chart?.title}
                            </span>
                        </div>
                        <div className="text-foreground  text-[18.7px]"
                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {chart?.topLabel}
                        </div>
                    </div>

                    <div className="flex-grow relative">
                        {chartType !== 'pie' && chartType !== 'donut' && (
                            <div className="flex justify-center gap-[30px] mb-[20px]">
                                {chart?.seriesNames?.slice(0, chart?.data?.some(row => (row.value2 ?? 0) > 0) ? 2 : 1)?.map((name, i) => (
                                    <div key={i} className="flex items-center gap-[8px]">
                                        <div className={`w-[12px] h-[12px] rounded-full ${i === 0 ? 'bg-[#1F8A2E]' : 'bg-[#A8D9A8]'}`}
                                            style={{ backgroundColor: i === 0 ? 'var(--graph-0, #1F8A2E)' : 'var(--graph-1, #A8D9A8)' }}
                                        />
                                        <span className="text-[12px] text-foreground font-['Open_Sans_Regular']"
                                            style={{ color: 'var(--background-text,#000000)' }}
                                        >{name}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="w-full h-[400px]">

                            {renderChart()}

                        </div>

                        <div className="absolute bottom-[0px] right-[20px] text-foreground font-['Playfair_Display_Regular'] text-[16px]"
                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {chart?.bottomLabel}
                        </div>
                    </div>
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
