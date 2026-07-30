
import * as z from 'zod';
import {
    Text,
    PieChart,
    Pie,
    Cell,
    BarChart,
    LineChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Bar,
    Line,
    LabelList,
    Legend,
    AreaChart,
    Area,
    ScatterChart,
    Scatter,
    ResponsiveContainer,
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
    title: z.string().max(20).describe("The main title of the slide").default("Spend & ROI"),
    chartType: chartTypeEnum.describe('Type of chart to display').default('horizontalBar'),
    graph: z.object({
        columns: z.array(z.string().max(10)).max(2).describe("Columns for the chart data"),
        rows: z.array(z.object({
            label: z.string().max(10).describe("Label for the data segment"),
            value: z.number().describe("Numerical value for the data segment"),
        })).max(5).describe("Rows of data for the chart")
    }).describe("Chart data").default({
        columns: ["Label", "Value"],
        rows: [
            { label: "Jan", value: 24 },
            { label: "Feb", value: 30.9 },
            { label: "Mar", value: 45.2 },
        ]
    }),

});

export const layoutId = "title-centered-chart";
export const layoutName = "Title Centered Chart";
export const layoutDescription = "A clean slide layout with a large centered title and a prominent chart (bar, grouped bar, stacked bar, clustered bar, diverging bar, horizontal bar, line, area, pie, donut, or scatter) within a grey container. Ideal for showcasing distribution data, single-metric trends, or category breakdowns in a visually impactful way.";

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
    const { title, chartType = 'bar', graph } = data;

    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, label }: any) => {
        const RADIAN = Math.PI / 180;
        const radius = outerRadius + 30;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <Text
                x={x}
                y={y}
                fill="var(--background-text, #000000)"
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                style={{ fontFamily: 'Albert Sans', fontWeight: 400, fontSize: '18px' }}
            >
                {`${graph?.rows?.[index]?.label}\n${(percent * 100).toFixed(1)}%`}
            </Text>
        );
    };
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
                        <LineChart data={graph?.rows} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Line type="monotone" dataKey="value" stroke="var(--graph-0, #9CE0EE)" strokeWidth={3} dot={{ r: 5, fill: 'var(--graph-0, #9CE0EE)' }} activeDot={{ r: 7 }} />
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'horizontalBar':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={graph?.rows} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={80} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" name={graph?.columns?.[0]} radius={[0, 6, 6, 0]} >
                                {graph?.rows?.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} />
                                ))}
                                <LabelList dataKey="value" position="right" fill="var(--background-text, #101828)" style={{ fontSize: '11px', fontWeight: 600 }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-vertical':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart height={400} data={graph?.rows} margin={{ top: 20, right: 20, left: 20, bottom: 20 }} barGap={2}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" fill="var(--graph-0, #9CE0EE)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart height={400} data={graph?.rows} layout="vertical" margin={{ top: 20, right: 40, left: 60, bottom: 20 }} barGap={2}>
                            <CartesianGrid horizontal={true} vertical={false} stroke="var(--background-text, #7f8491)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={50} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" fill="var(--graph-0, #9CE0EE)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-vertical':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart height={400} data={graph?.rows} margin={{ top: 20, right: 20, left: 20, bottom: 20 }} barGap={0}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" stackId="stack" fill="var(--graph-0, #9CE0EE)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart height={400} data={graph?.rows} layout="vertical" margin={{ top: 20, right: 40, left: 60, bottom: 20 }} barGap={0}>
                            <CartesianGrid horizontal={true} vertical={false} stroke="var(--background-text, #7f8491)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} width={50} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" stackId="stack" fill="var(--graph-0, #9CE0EE)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-clustered':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart height={400} data={graph?.rows} margin={{ top: 20, right: 20, left: 20, bottom: 20 }} barGap={1} barCategoryGap="20%">
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" fill="var(--graph-0, #9CE0EE)" radius={[4, 4, 0, 0]} >
                                <LabelList dataKey="value" position="top" fill="var(--background-text, #7f8491)" fontSize={11} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-diverging': {
                const divergingData = graph?.rows?.map(row => ({
                    label: row.label,
                    positive: row.value,
                    negative: 0,
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
                            <Bar dataKey="positive" name={graph?.columns?.[0] || 'Positive'} fill={graphColors(0)} stackId="stack" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="negative" name={graph?.columns?.[1] || 'Negative'} fill={graphColors(3)} stackId="stack" radius={[4, 0, 0, 4]} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            }

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart height={400} data={graph?.rows} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <defs>
                                <linearGradient id="centeredArea1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--graph-0, #9CE0EE)" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="var(--graph-0, #9CE0EE)" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value" stroke="var(--graph-0, #9CE0EE)" strokeWidth={2} fill="url(#centeredArea1)" />
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'area-stacked':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart height={400} data={graph?.rows} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Area type="monotone" dataKey="value" stackId="1" stroke="var(--graph-0, #9CE0EE)" fill="var(--graph-0, #9CE0EE)" fillOpacity={0.6} />
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <PieChart margin={{ top: 15, right: 15, left: 15, bottom: 15 }}>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            {/* <Legend /> */}
                            <Pie
                                data={graph?.rows}
                                cx="50%"
                                cy="50%"
                                outerRadius={120}
                                dataKey="value"
                                label={renderCustomLabel}
                                labelLine={false}
                            >
                                {graph?.rows?.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );

            case 'donut':
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Pie
                                data={graph?.rows}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={120}
                                paddingAngle={2}
                                dataKey="value"
                                label={renderCustomLabel}
                                labelLine={false}
                            >
                                {graph?.rows?.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );

            case 'scatter': {
                const scatterData = graph?.rows?.map((row) => ({
                    x: row.value,
                    y: 0,
                    name: row.label,
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={350}>
                        <ScatterChart margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" dataKey="x" name={graph?.columns?.[0]} {...axisProps} />
                            <YAxis type="number" dataKey="y" name={graph?.columns?.[1]} {...axisProps} />
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
                        <BarChart data={graph?.rows} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" name={graph?.columns?.[0]} radius={[6, 6, 0, 0]} >
                                {graph?.rows?.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={graphColors(index)} />
                                ))}
                                <LabelList dataKey="value" position="top" fill="var(--background-text, #101828)" style={{ fontSize: '11px', fontWeight: 600 }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );
        }
    };

    const showLegend = chartType !== 'pie' && chartType !== 'donut';

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col font-['Albert_Sans'] pb-[72px]"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Albert Sans)',
                }}
            >
                {/* Title Section */}
                <div className="pt-[68px] pb-[40px] text-center w-full">
                    <h1
                        className="text-[42.7px] font-bold text-[#000000]"
                        style={{ fontFamily: 'Albert Sans', fontWeight: 700, letterSpacing: '-1.6px', color: 'var(--background-text,#000000)' }}
                    >
                        {title}
                    </h1>
                </div>

                {/* Main Content Area */}
                <div className=" flex items-center justify-center px-[115px]">
                    <div className="w-full h-full bg-[#EBEBEB] rounded-[4.7px] border-[1.3px] border-[#F0F0F2] flex flex-col items-center justify-center p-5"

                        style={{ borderColor: 'var(--stroke,#F0F0F2)', backgroundColor: 'var(--card-color,#EBEBEB)' }}
                    >

                        {/* Legend - show for non-pie/donut charts */}
                        {showLegend && (
                            <div className="flex gap-8 mb-4">
                                {graph?.rows?.map((entry, index) => (
                                    <div key={`legend-${index}`} className="flex items-center gap-2">
                                        <div
                                            className="w-[18px] h-[18px] rounded-full"
                                            style={{ backgroundColor: `var(--graph-${index}, ${COLORS[index % COLORS.length]})` }}
                                        />
                                        <span style={{ fontFamily: 'Albert Sans', fontWeight: 400, fontSize: '18px', color: 'var(--background-text, #7f8491)' }}>{entry.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Chart Container */}
                        <div className="max-w-[1050px] mx-auto w-full h-full ">

                            {renderChart()}

                        </div>
                    </div>
                </div>

                {/* Footer Section */}
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
