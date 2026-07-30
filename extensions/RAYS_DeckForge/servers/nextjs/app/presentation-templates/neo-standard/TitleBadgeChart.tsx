/**
 * Enhanced TitleBadgeChart with multiple chart type support
 */
import * as z from 'zod';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar, LabelList, Legend, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ScatterChart, Scatter, ReferenceLine, Tooltip } from 'recharts';

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
    title: z.string().max(10).describe('The main heading of the slide').default('Barchart'),
    badgeText: z.string().max(12).describe('The text displayed within the colored box').default('Campaign A'),
    topDescription: z.string().max(20).describe('The textual label at the top right of the chart').default('Top Campaign'),
    bottomDescription: z.string().max(25).describe('The textual label at the bottom right of the chart').default('Engangment Rate'),
    chartType: chartTypeEnum.describe('Type of chart to display'),
    graphData: z.object({
        columns: z.array(z.string()).max(3).describe('Labels for the data categories and legend items'),
        rows: z.array(z.object({
            label: z.string().max(12).describe('The name of the category shown on the X-axis'),
            value1: z.number().describe('Value for the first series (bottom part of stack)'),
            value2: z.number().optional().describe('Value for the second series (optional for single-series charts)')
        })).max(4).describe('Array of data points for the chart')
    }).default({
        columns: ["Category", "Planned Budget",],
        rows: [
            { label: "Paid Social", value1: 520, },
            { label: "Content Marketing", value1: 380, },
            { label: "Events & Sponsorships", value1: 450, },
            { label: "SEO & Organic", value1: 280, }
        ]
    })
});

export const layoutId = 'title-badge-chart';
export const layoutName = 'Title Badge Chart';
export const layoutDescription = 'A slide featuring a centered title, a category badge, and a chart with supplementary labels, supporting bar, grouped bar, stacked bar, clustered bar, diverging bar, horizontal bar, line, area, pie, donut, and scatter chart types.';

const CHART_COLORS = ['#1F8A2E', '#A7DBA8', '#4CAF50', '#81C784', '#EC4899', '#10B981'];

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, badgeText, topDescription, bottomDescription, graphData, chartType = 'bar' } = data;

    const renderChart = () => {
        const hasValue2 = (graphData?.rows?.some(row => (row.value2 ?? 0) > 0)) ?? false;

        const formatComma = (value: number) => {
            return value.toLocaleString('en-US');
        };
        const axisProps = {
            axisLine: false,
            tickLine: false,
            tick: { fill: 'var(--background-text, #333333)', fontSize: 16, fontFamily: 'Open Sans Regular' }
        };

        const gridProps = {
            vertical: false,
            stroke: "var(--background-text, #F0F0F2)"
        };

        switch (chartType) {
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart height={300} data={graphData?.rows} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={15} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} formatter={(value, entry, index) => graphData?.columns?.[index + 1] || value} />
                            <Line type="monotone" dataKey="value1" stroke="var(--graph-0, #1F8A2E)" strokeWidth={3} dot={{ fill: 'var(--graph-0, #1F8A2E)', r: 6 }} />
                            {hasValue2 && <Line type="monotone" dataKey="value2" stroke="var(--graph-1, #A7DBA8)" strokeWidth={3} dot={{ fill: 'var(--graph-1, #A7DBA8)', r: 6 }} />}
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'horizontalBar':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart height={300} data={graphData?.rows} layout="vertical" margin={{ top: 20, right: 40, left: 80, bottom: 20 }} barGap={0}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #F0F0F2)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} formatter={(value, entry, index) => graphData?.columns?.[index + 1] || value} />
                            <Bar dataKey="value1" stackId="a" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [0, 4, 4, 0]}>
                                <LabelList dataKey="value1" position="center" fill="var(--background-text, #FFFFFF)" fontSize={14} fontFamily="Open Sans Regular" />
                            </Bar>
                            {hasValue2 && (
                                <Bar dataKey="value2" stackId="a" fill="var(--graph-1, #A7DBA8)" radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="value2" position="center" fill="var(--background-text, #333333)" fontSize={14} fontFamily="Open Sans Regular" />
                                </Bar>
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-vertical':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart height={300} data={graphData?.rows} margin={{ top: 20, right: 20, left: 10, bottom: 20 }} barGap={2}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={15} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} formatter={(value, entry, index) => graphData?.columns?.[index + 1] || value} />
                            <Bar dataKey="value1" fill="var(--graph-0, #1F8A2E)" radius={[4, 4, 0, 0]} />
                            {hasValue2 && <Bar dataKey="value2" fill="var(--graph-1, #A7DBA8)" radius={[4, 4, 0, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-grouped-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart height={300} data={graphData?.rows} layout="vertical" margin={{ top: 20, right: 40, left: 80, bottom: 20 }} barGap={2}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #F0F0F2)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} formatter={(value, entry, index) => graphData?.columns?.[index + 1] || value} />
                            <Bar dataKey="value1" fill="var(--graph-0, #1F8A2E)" radius={[0, 4, 4, 0]} />
                            {hasValue2 && <Bar dataKey="value2" fill="var(--graph-1, #A7DBA8)" radius={[0, 4, 4, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-vertical':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart height={300} data={graphData?.rows} margin={{ top: 20, right: 20, left: 10, bottom: 20 }} barGap={0}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={15} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} formatter={(value, entry, index) => graphData?.columns?.[index + 1] || value} />
                            <Bar dataKey="value1" stackId="stack" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [4, 4, 0, 0]} />
                            {hasValue2 && <Bar dataKey="value2" stackId="stack" fill="var(--graph-1, #A7DBA8)" radius={[4, 4, 0, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-stacked-horizontal':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart height={300} data={graphData?.rows} layout="vertical" margin={{ top: 20, right: 40, left: 80, bottom: 20 }} barGap={0}>
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #F0F0F2)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} formatter={(value, entry, index) => graphData?.columns?.[index + 1] || value} />
                            <Bar dataKey="value1" stackId="stack" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [0, 4, 4, 0]} />
                            {hasValue2 && <Bar dataKey="value2" stackId="stack" fill="var(--graph-1, #A7DBA8)" radius={[0, 4, 4, 0]} />}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-clustered':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart height={300} data={graphData?.rows} margin={{ top: 20, right: 20, left: 10, bottom: 20 }} barGap={1} barCategoryGap="20%">
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={15} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} formatter={(value, entry, index) => graphData?.columns?.[index + 1] || value} />
                            <Bar dataKey="value1" fill="var(--graph-0, #1F8A2E)" radius={[4, 4, 0, 0]} >
                                <LabelList dataKey="value1" position="top" fill="var(--background-text, #333333)" fontSize={12} fontFamily="Open Sans Regular" />
                            </Bar>
                            {hasValue2 && (
                                <Bar dataKey="value2" fill="var(--graph-1, #A7DBA8)" radius={[4, 4, 0, 0]} >
                                    <LabelList dataKey="value2" position="top" fill="var(--background-text, #333333)" fontSize={12} fontFamily="Open Sans Regular" />
                                </Bar>
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'bar-diverging': {
                const divergingData = graphData?.rows?.map(row => ({
                    label: row.label,
                    positive: row.value1,
                    negative: -(row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={400}>

                        <BarChart data={divergingData} layout="vertical" margin={{ top: 20, right: 40, left: 80, bottom: 20 }} stackOffset="sign">
                            <CartesianGrid horizontal={false} stroke="var(--background-text, #F0F0F2)" />
                            <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                            <YAxis type="category" dataKey="label" {...axisProps} tickFormatter={formatComma} />
                            <ReferenceLine x={0} stroke="var(--background-text, #9CA3AF)" strokeWidth={1} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} />
                            <Bar dataKey="positive" name={graphData?.columns?.[1] || 'Positive'} stackId="stack" fill={`var(--graph-0, ${CHART_COLORS[0]})`} radius={[0, 4, 4, 0]} />
                            <Bar dataKey="negative" name={graphData?.columns?.[2] || 'Negative'} stackId="stack" fill={`var(--graph-1, ${CHART_COLORS[1]})`} radius={[4, 0, 0, 4]} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            }

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart height={300} data={graphData?.rows} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={15} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} formatter={(value, entry, index) => graphData?.columns?.[index + 1] || value} />
                            <defs>
                                <linearGradient id="badgeArea1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--graph-0, #1F8A2E)" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="var(--graph-0, #1F8A2E)" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="badgeArea2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--graph-1, #A7DBA8)" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="var(--graph-1, #A7DBA8)" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value1" stroke="var(--graph-0, #1F8A2E)" strokeWidth={2} fill="url(#badgeArea1)" />
                            {hasValue2 && <Area type="monotone" dataKey="value2" stroke="var(--graph-1, #A7DBA8)" strokeWidth={2} fill="url(#badgeArea2)" />}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'area-stacked':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart height={300} data={graphData?.rows} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={15} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} formatter={(value, entry, index) => graphData?.columns?.[index + 1] || value} />
                            <Area type="monotone" dataKey="value1" stackId="1" stroke="var(--graph-0, #1F8A2E)" fill="var(--graph-0, #1F8A2E)" fillOpacity={0.6} />
                            {hasValue2 && <Area type="monotone" dataKey="value2" stackId="1" stroke="var(--graph-1, #A7DBA8)" fill="var(--graph-1, #A7DBA8)" fillOpacity={0.6} />}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'pie':
                const pieData = graphData?.rows?.map((row, index) => ({
                    name: row.label,
                    value: row.value1 + (row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={400}>

                        <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                            <Pie data={pieData} cx="50%" cy="50%" outerRadius={150} innerRadius={0} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: 'var(--background-text, #333333)', strokeWidth: 1 }}>
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`var(--graph-${index}, ${CHART_COLORS[index % CHART_COLORS.length]})`} />
                                ))}
                            </Pie>
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} />
                        </PieChart>
                    </ResponsiveContainer>
                );

            case 'donut':
                const donutData = graphData?.rows?.map((row, index) => ({
                    name: row.label,
                    value: row.value1 + (row.value2 ?? 0),
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={400}>

                        <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                            <Pie data={donutData} cx="50%" cy="50%" outerRadius={150} innerRadius={60} dataKey="value" paddingAngle={2} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: 'var(--background-text, #333333)', strokeWidth: 1 }}>
                                {donutData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`var(--graph-${index}, ${CHART_COLORS[index % CHART_COLORS.length]})`} stroke="white" strokeWidth={2} />
                                ))}
                            </Pie>
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} />
                        </PieChart>
                    </ResponsiveContainer>
                );

            case 'scatter':
                const scatterData = graphData?.rows?.map((row) => ({
                    x: row.value1,
                    y: row.value2 ?? 0,
                    name: row.label,
                })) || [];
                return (
                    <ResponsiveContainer width="100%" height={400}>

                        <ScatterChart margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis type="number" dataKey="x" name={graphData?.columns?.[1]} {...axisProps} />
                            <YAxis type="number" dataKey="y" name={graphData?.columns?.[2]} {...axisProps} />
                            <Tooltip cursor={{ strokeDasharray: '3 3', fill: 'transparent' }} />
                            <Scatter data={scatterData} fill="var(--graph-0, #1F8A2E)">
                                {scatterData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`var(--graph-${index}, ${CHART_COLORS[index % CHART_COLORS.length]})`} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                );

            case 'bar':
            default:
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart height={300} data={graphData?.rows} margin={{ top: 20, right: 20, left: 10, bottom: 20 }} barGap={0}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} dy={15} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '0px', paddingBottom: '30px', fontSize: '14px', fontFamily: 'Open Sans Regular' }} formatter={(value, entry, index) => graphData?.columns?.[index + 1] || value} />
                            <Bar dataKey="value1" stackId="a" fill="var(--graph-0, #1F8A2E)" radius={hasValue2 ? undefined : [4, 4, 0, 0]}>
                                <LabelList dataKey="value1" position="center" fill="var(--background-text, #FFFFFF)" fontSize={14} fontFamily="Open Sans Regular" />
                            </Bar>
                            {hasValue2 && (
                                <Bar dataKey="value2" stackId="a" fill="var(--graph-1, #A7DBA8)" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="value2" position="center" fill="var(--background-text, #333333)" fontSize={14} fontFamily="Open Sans Regular" />
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
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden  p-8 box-border "

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Playfair Display)',
                }}
            >

                {/* Header Section */}
                <div className="flex justify-between items-start mb-4 relative z-10 px-8 pb-8">
                    <div className="flex-1 text-center">
                        <h1 className="text-[44px] text-foreground  font-bold -ml-16"
                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {title}
                        </h1>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className=" flex-grow flex flex-col relative z-10 border-[1.3px] border-[#F0F0F2] rounded-[10px] p-6 pb-8 "
                    style={{ borderColor: 'var(--stroke,#F0F0F2)' }}
                >
                    {/* Badge and Top Label Row */}
                    <div className="flex justify-between items-end mb-4">
                        <div className="bg-[#1F8A2E] px-8 py-3"
                            style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                        >
                            <span className="text-[34px] text-foreground  font-bold leading-none"
                                style={{ color: 'var(--primary-text,#FFFFFF)' }}
                            >
                                {badgeText}
                            </span>
                        </div>
                        <div className="text-[22px] text-foreground  italic pb-1"

                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {topDescription}
                        </div>
                    </div>

                    {/* Chart Area */}
                    <div className=" flex-grow w-full min-h-0 ">

                        {renderChart()}

                    </div>

                    {/* Footer Description Row */}
                    <div className=" absolute bottom-1 right-2 ">
                        <div className="text-[20px] text-foreground  pr-4"

                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {bottomDescription}
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
