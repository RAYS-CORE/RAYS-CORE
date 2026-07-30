/**
 * Enhanced TitleSubtitlesChart with multiple chart type support
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
    title: z.string().max(8).describe("The main heading of the slide").default("Barchart"),
    subtitleLeft: z.string().max(10).describe("Left subtitle text").default("Campaign A"),
    subtitleRight: z.string().max(12).describe("Right subtitle text").default("Top Campaign"),
    footerLabel: z.string().max(15).describe("Footer label text").default("Engangment Rate"),
    chartType: chartTypeEnum.describe('Type of chart to display'),
    graphData: z.object({
        columns: z.array(z.string().max(16)).max(2).describe("Names of the data series"),
        rows: z.array(z.object({
            label: z.string().max(12).describe("The category label for the bar"),
            value: z.number().describe("The value for the first series"),
            value2: z.number().optional().describe("The value for the second series (optional for single-series charts)"),
        })).max(4).describe("The data rows for the chart")
    }).describe("The data for the chart").default({
        columns: ["Planned Budget", "Actual Budget"],
        rows: [
            { label: "Paid Social", value: 520, value2: 485 },
            { label: "Content Marketing", value: 380, value2: 412 },
            { label: "Events & Sponsorships", value: 450, value2: 468 },
            { label: "SEO & Organic", value: 280, value2: 276 }
        ]
    })
});

export const layoutId = "title-subtitles-chart";
export const layoutName = "Title Subtitles Chart";
export const layoutDescription = "A slide with a centered title, two subtitles, and a chart within a bordered content area. Supports bar, grouped bar, stacked bar, clustered bar, diverging bar, horizontal bar, line, area, pie, donut, and scatter chart types.";

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

// Helper function to get the correct dataKey based on index
// The data rows have 'value' and 'value2' properties, not the column names
const getDataKey = (index: number) => index === 0 ? 'value' : 'value2';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, subtitleLeft, subtitleRight, footerLabel, graphData, chartType = 'bar' } = data;

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

        const hasValue2 = (graphData?.rows?.some(row => (row.value2 ?? 0) > 0)) ?? false;

        switch (chartType) {
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={graphData?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            {graphData?.columns?.map((column, index) => (
                                <Line
                                    key={`line-${index}`}
                                    type="monotone"
                                    dataKey={getDataKey(index)}
                                    name={column}
                                    stroke={graphColors(index)}
                                    strokeWidth={3}
                                    dot={{ r: 5, strokeWidth: 0 }}
                                    activeDot={{ r: 7 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'horizontalBar':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={graphData?.rows} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 20 }} barGap={0}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--background-text, #7f8491)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontFamily: 'Montserrat Regular', fontSize: '14px' }} />
                            <Bar dataKey="value" name={graphData?.columns?.[0] || "Series 1"} stackId="a" fill={graphColors(0)} barSize={40} radius={hasValue2 ? undefined : [0, 4, 4, 0]}>
                                <LabelList dataKey="value" position="center" fill="var(--primary-text, #FFFFFF)" style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'Montserrat Bold' }} />
                            </Bar>
                            {hasValue2 && (
                                <Bar dataKey="value2" name={graphData?.columns?.[1] || "Series 2"} stackId="a" fill={graphColors(1)} barSize={40} radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="value2" position="center" fill="var(--primary-text, #FFFFFF)" style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'Montserrat Bold' }} />
                                </Bar>
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-vertical':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={graphData?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            {graphData?.columns?.map((column, index) => (
                                <Bar
                                    key={`gvbar-${index}`}
                                    dataKey={getDataKey(index)}
                                    name={column}
                                    fill={graphColors(index)}
                                    radius={[4, 4, 0, 0]}
                                >
                                    <LabelList dataKey={getDataKey(index)} position="top" fill="var(--background-text, #4B5563)" style={{ fontSize: '10px', fontWeight: 600 }} />
                                </Bar>
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={graphData?.rows} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={80} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            {graphData?.columns?.map((column, index) => (
                                <Bar
                                    key={`ghbar-${index}`}
                                    dataKey={getDataKey(index)}
                                    name={column}
                                    fill={graphColors(index)}
                                    radius={[0, 4, 4, 0]}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-vertical':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={graphData?.rows} margin={{ top: 20, right: 30, left: 20, bottom: 20 }} barGap={0}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={10} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontFamily: 'Montserrat Regular', fontSize: '14px' }} />
                            <Bar dataKey="value" name={graphData?.columns?.[0] || "Series 1"} stackId="stack" fill={graphColors(0)} barSize={80} radius={hasValue2 ? undefined : [4, 4, 0, 0]} />
                            {hasValue2 && <Bar dataKey="value2" name={graphData?.columns?.[1] || "Series 2"} stackId="stack" fill={graphColors(1)} radius={[4, 4, 0, 0]} barSize={80} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={graphData?.rows} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 20 }} barGap={0}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--background-text, #7f8491)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontFamily: 'Montserrat Regular', fontSize: '14px' }} />
                            <Bar dataKey="value" name={graphData?.columns?.[0] || "Series 1"} stackId="stack" fill={graphColors(0)} barSize={35} radius={hasValue2 ? undefined : [0, 4, 4, 0]} />
                            {hasValue2 && <Bar dataKey="value2" name={graphData?.columns?.[1] || "Series 2"} stackId="stack" fill={graphColors(1)} radius={[0, 4, 4, 0]} barSize={35} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-clustered':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={graphData?.rows} barGap={2} barCategoryGap="20%" margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            {graphData?.columns?.map((column, index) => (
                                <Bar
                                    key={`cbar-${index}`}
                                    dataKey={getDataKey(index)}
                                    name={column}
                                    fill={graphColors(index)}
                                    radius={[4, 4, 0, 0]}
                                    barSize={Math.max(20, 60 / (graphData?.columns?.length ?? 1))}
                                >
                                    <LabelList dataKey={getDataKey(index)} position="top" fill="var(--background-text, #4B5563)" style={{ fontSize: '9px', fontWeight: 600 }} />
                                </Bar>
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-diverging': {
                const divergingData = graphData?.rows?.map(row => ({
                    label: row.label,
                    positive: row.value,
                    negative: -(row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={400}>

                        <BarChart data={divergingData} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 20 }} stackOffset="sign">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--background-text, #7f8491)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <ReferenceLine x={0} stroke="var(--background-text, #9CA3AF)" strokeWidth={1} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontFamily: 'Montserrat Regular', fontSize: '14px' }} />
                            <Bar dataKey="positive" name={graphData?.columns?.[0] || 'Positive'} fill={graphColors(0)} stackId="stack" radius={hasValue2 ? [0, 4, 4, 0] : [4, 4, 4, 4]} barSize={30} />
                            {hasValue2 && <Bar dataKey="negative" name={graphData?.columns?.[1] || 'Negative'} fill={graphColors(1)} stackId="stack" radius={[4, 0, 0, 4]} barSize={30} />}
                        </BarChart>
                    </ResponsiveContainer>
                );
            }

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={graphData?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <defs>
                                {graphData?.columns?.map((column, index) => (
                                    <linearGradient key={`gradient-${column}`} id={`gradient-area-${index}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={graphColors(index)} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={graphColors(index)} stopOpacity={0.05} />
                                    </linearGradient>
                                ))}
                            </defs>
                            {graphData?.columns?.map((column, index) => (
                                <Area
                                    key={`area-${index}`}
                                    type="monotone"
                                    dataKey={getDataKey(index)}
                                    name={column}
                                    stroke={graphColors(index)}
                                    strokeWidth={2}
                                    fill={`url(#gradient-area-${index})`}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'area-stacked':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={graphData?.rows} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            {graphData?.columns?.map((column, index) => (
                                <Area
                                    key={`stacked-area-${index}`}
                                    type="monotone"
                                    dataKey={getDataKey(index)}
                                    name={column}
                                    stackId="1"
                                    stroke={graphColors(index)}
                                    fill={graphColors(index)}
                                    fillOpacity={0.5}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'pie': {
                const pieData = graphData?.rows?.map((row) => ({
                    name: row.label,
                    value: row.value + (row.value2 ?? 0),
                })) || [];
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
                const donutData = graphData?.rows?.map((row) => ({
                    name: row.label,
                    value: row.value + (row.value2 ?? 0),
                })) || [];
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

            case 'scatter': {
                const scatterData = graphData?.rows?.map((row) => ({
                    x: row.value,
                    y: row.value2 ?? 0,
                    name: row.label,
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <ScatterChart margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" dataKey="x" name={graphData?.columns?.[0]} {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="number" dataKey="y" name={graphData?.columns?.[1]} {...axisProps} tickFormatter={formatComma} />
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

                        <BarChart data={graphData?.rows} margin={{ top: 20, right: 30, left: 20, bottom: 20 }} barGap={0}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={10} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontFamily: 'Montserrat Regular', fontSize: '14px' }} />
                            <Bar dataKey="value" name={graphData?.columns?.[0] || "Series 1"} stackId="a" fill={graphColors(0)} barSize={180} radius={hasValue2 ? undefined : [4, 4, 0, 0]}>
                                <LabelList dataKey="value" position="center" fill="var(--primary-text, #FFFFFF)" style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'Montserrat Bold' }} />
                            </Bar>
                            {hasValue2 && (
                                <Bar dataKey="value2" name={graphData?.columns?.[1] || "Series 2"} stackId="a" fill={graphColors(1)} radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="value2" position="center" fill="var(--primary-text, #FFFFFF)" style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'Montserrat Bold' }} />
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
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >
                <div className="flex flex-col h-full w-full py-0">

                    {/* Header Section */}
                    <div className="flex items-center justify-center px-[52px] pt-[30px] min-h-[100px]">

                        <h1 style={{ fontWeight: 700, fontSize: '42.7px', color: 'var(--background-text,#002BB2)', letterSpacing: '-1.6px', textAlign: 'center' }}>
                            {title}
                        </h1>


                    </div>

                    {/* Content Box with Border */}
                    <div className="mx-[72px] relative mb-[50px] border border-[#F0F0F2] rounded-[4px] flex flex-col flex-grow bg-[#FFFFFE]"

                        style={{
                            backgroundColor: 'var(--card-color,#FFFFFE)',
                            borderColor: 'var(--stroke,#F0F0F2)',
                        }}
                    >

                        {/* Subtitles Row */}
                        <div className="flex justify-between items-center px-[65px] pt-[45px]">
                            <h2 style={{ fontWeight: 700, fontSize: '33.8px', color: 'var(--background-text,#244CD9)' }}>
                                {subtitleLeft}
                            </h2>
                            <h3 style={{ fontWeight: 700, fontSize: '22.2px', color: 'var(--background-text,#244CD9)' }}>
                                {subtitleRight}
                            </h3>
                        </div>

                        {/* Graph Section */}
                        <div className="px-[65px] py-6">

                            {renderChart()}

                        </div>

                        {/* Footer Label Section */}
                        <div className="absolute bottom-4 right-8 flex justify-end ">
                            <span style={{ fontWeight: 700, fontSize: '19.0px', color: 'var(--background-text,#244CD9)' }}>
                                {footerLabel}
                            </span>
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
