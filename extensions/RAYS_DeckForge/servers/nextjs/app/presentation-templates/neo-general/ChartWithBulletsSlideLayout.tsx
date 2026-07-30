/**
 * Chart with Bullets Slide Layout - Enhanced with multiple chart variations
 */

import React from 'react'
import * as z from "zod";
import { IconSchema } from '../defaultSchemes';
import { RemoteSvgIcon } from '@/app/hooks/useRemoteSvgIcon';

import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, Tooltip, Legend, LabelList, ReferenceLine
} from "recharts";

export const layoutId = 'chart-with-bullets-slide'
export const layoutName = 'Chart With Bullet Cards'
export const layoutDescription = 'A split layout with title, description, and a versatile chart on the left, paired with 1-3 colored icon bullet cards on the right. Supports bar, grouped, stacked, clustered, diverging, line, area, pie, and scatter charts.'

// Color palettes
const DEFAULT_CHART_COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899']


const formatComma = (value: number) => {
    return value.toLocaleString('en-US');
};

// Simple data for single series charts
const simpleDataSchema = z.object({
    name: z.string().meta({ description: "Data point name" }),
    value: z.number().meta({ description: "Data point value" }),
});

// Multi-series data
const multiSeriesDataSchema = z.object({
    name: z.string().meta({ description: "Category name" }),
    values: z.any().meta({ description: "Key-value pairs for each series (object with series names as keys and numbers as values)" }),
});

// Diverging data
const divergingDataSchema = z.object({
    name: z.string().meta({ description: "Category name" }),
    positive: z.number().meta({ description: "Positive value" }),
    negative: z.number().meta({ description: "Negative value" }),
});

// Scatter data
const scatterDataSchema = z.object({
    x: z.number().meta({ description: "X coordinate" }),
    y: z.number().meta({ description: "Y coordinate" }),
});

const chartWithBulletsSlideSchema = z.object({
    title: z.string().min(3).max(40).default('Market Size').meta({
        description: "Main title of the slide",
    }),
    description: z.string().min(10).max(150).default('Businesses face challenges with outdated technology and rising costs, limiting efficiency and growth in competitive markets.').meta({
        description: "Description text below the title",
    }),
    chartData: z.object({
        type: z.enum([
            'bar',
            'bar-horizontal',
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
        ]).default('bar'),
        data: z.union([
            z.array(simpleDataSchema),
            z.array(multiSeriesDataSchema),
            z.array(divergingDataSchema),
            z.array(scatterDataSchema),
        ]).default([
            { name: 'Q1', value: 45 },
            { name: 'Q2', value: 72 },
            { name: 'Q3', value: 58 },
            { name: 'Q4', value: 89 },
        ]),
        series: z.array(z.string()).optional().meta({ description: "Series names for grouped/stacked charts" }),
        divergingLabels: z.tuple([z.string(), z.string()]).optional(),
        colorPalette: z.enum(['vibrant', 'ocean', 'professional']).default('vibrant'),
    }).default({
        type: 'bar',
        data: [
            { name: 'Q1', value: 45 },
            { name: 'Q2', value: 72 },
            { name: 'Q3', value: 58 },
            { name: 'Q4', value: 89 },
        ],
        colorPalette: 'vibrant',
    }),
    showLegend: z.boolean().default(false).meta({
        description: "Whether to show chart legend",
    }),
    showTooltip: z.boolean().default(true).meta({
        description: "Whether to show chart tooltip",
    }),
    bulletPoints: z.array(z.object({
        title: z.string().min(2).max(80).meta({
            description: "Bullet point title",
        }),
        description: z.string().min(10).max(150).meta({
            description: "Bullet point description",
        }),
        icon: IconSchema,
    })).min(1).max(3).default([
        {
            title: 'Total Addressable Market',
            description: 'Companies can use TAM to plan future expansion and investment.',
            icon: {
                __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/chart-line-up-bold.svg',
                __icon_query__: 'target market scope'
            }
        },
        {
            title: 'Serviceable Available Market',
            description: 'Indicates more measurable market segments for sales efforts.',
            icon: {
                __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/chart-line-up-bold.svg',
                __icon_query__: 'pie chart analysis'
            }
        },
        {
            title: 'Serviceable Obtainable Market',
            description: 'Help companies plan development strategies according to the market.',
            icon: {
                __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/chart-line-up-bold.svg',
                __icon_query__: 'trending up growth'
            }
        }
    ]).meta({
        description: "List of bullet points with colored boxes and icons",
    })
})

export const Schema = chartWithBulletsSlideSchema

export type ChartWithBulletsSlideData = z.infer<typeof chartWithBulletsSlideSchema>

interface ChartWithBulletsSlideLayoutProps {
    data?: Partial<ChartWithBulletsSlideData>
}



// Transform multi-series data
const transformMultiSeriesData = (data: any[], series: string[]) => {
    return data.map(item => {
        const result: Record<string, any> = { name: item.name };
        series.forEach(s => {
            result[s] = item.values?.[s] ?? 0;
        });
        return result;
    });
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
                <p className="text-xs font-semibold text-foreground mb-1" style={{ color: 'var(--background-text, #111827)' }}  >{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-[10px]" style={{ color: 'var(--background-text, #111827)' }}>
                        {entry.name}: <span className="font-medium">{entry.value?.toLocaleString()}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const ChartWithBulletsSlideLayout: React.FC<ChartWithBulletsSlideLayoutProps> = ({ data: slideData }) => {
    const chartData = slideData?.chartData?.data || [];
    const chartType = slideData?.chartData?.type || 'bar';
    const series = slideData?.chartData?.series || [];

    const showLegend = slideData?.showLegend || false;
    const showTooltip = slideData?.showTooltip !== false;
    const bulletPoints = slideData?.bulletPoints || [];
    const divergingLabels = slideData?.chartData?.divergingLabels || ['Positive', 'Negative'];

    const axisProps = {
        tick: { fill: 'var(--background-text, #7f8491)', fontSize: 10, fontWeight: 500 },
        axisLine: { stroke: 'var(--background-text, #7f8491)' },
        tickLine: { stroke: 'var(--background-text, #7f8491)' },
    };

    const gridProps = {
        strokeDasharray: "3 3",
        stroke: "var(--background-text, #7f8491)",
        opacity: 0.7,
    };


    const graphColors = (index: number, serieColor?: string) => {

        const fallback = serieColor || DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
        return `var(--graph-${index}, ${fallback})`;
    };

    const renderChart = () => {
        const renderPieLabel = (props: any) => {
            const { name, percent, x, y, textAnchor } = props;
            if (percent < 0.08) return null;
            return (
                <text x={x} y={y} textAnchor={textAnchor} fill="var(--text-body-color,#4b5563)" fontSize={10}>
                    {`${name} ${(percent * 100).toFixed(0)}%`}
                </text>
            );
        };

        const commonProps = {
            margin: { top: 15, right: 20, left: 0, bottom: 5 },
        };

        switch (chartType) {
            case 'bar':
                return (
                    <BarChart data={chartData as any[]} {...commonProps} height={460}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {(chartData as any[]).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={graphColors(index)} />
                            ))}
                        </Bar>
                    </BarChart>
                );

            case 'bar-horizontal':
                return (
                    <BarChart data={chartData as any[]} layout="vertical" {...commonProps} height={400}>
                        <CartesianGrid {...gridProps} />
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={60} tickFormatter={formatComma} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                            {(chartData as any[]).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={graphColors(index)} />
                            ))}
                        </Bar>
                    </BarChart>
                );

            case 'bar-grouped-vertical': {
                const transformedData = transformMultiSeriesData(chartData as any[], series);
                return (
                    <BarChart data={transformedData} {...commonProps} height={460}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        {series.map((s: string, index: number) => (
                            <Bar key={s} dataKey={s} fill={graphColors(index)} radius={[4, 4, 0, 0]} />
                        ))}
                    </BarChart>
                );
            }

            case 'bar-grouped-horizontal': {
                const transformedData = transformMultiSeriesData(chartData as any[], series);
                return (
                    <BarChart data={transformedData} layout="vertical" {...commonProps} height={460}>
                        <CartesianGrid {...gridProps} />
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={60} tickFormatter={formatComma} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        {series.map((s: string, index: number) => (
                            <Bar key={s} dataKey={s} fill={graphColors(index)} radius={[0, 4, 4, 0]} />
                        ))}
                    </BarChart>
                );
            }

            case 'bar-stacked-vertical': {
                const transformedData = transformMultiSeriesData(chartData as any[], series);
                return (
                    <BarChart data={transformedData} {...commonProps} height={460}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        {series.map((s: string, index: number) => (
                            <Bar key={s} dataKey={s} stackId="stack" fill={graphColors(index)} radius={index === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                    </BarChart>
                );
            }

            case 'bar-stacked-horizontal': {
                const transformedData = transformMultiSeriesData(chartData as any[], series);
                return (
                    <BarChart data={transformedData} layout="vertical" {...commonProps} height={460}>
                        <CartesianGrid {...gridProps} />
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={60} tickFormatter={formatComma} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        {series.map((s: string, index: number) => (
                            <Bar key={s} dataKey={s} stackId="stack" fill={graphColors(index)} radius={index === series.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                        ))}
                    </BarChart>
                );
            }

            case 'bar-clustered': {
                const transformedData = transformMultiSeriesData(chartData as any[], series);
                return (
                    <BarChart data={transformedData} barGap={1} barCategoryGap="15%" {...commonProps} height={460}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        {series.map((s: string, index: number) => (
                            <Bar key={s} dataKey={s} fill={graphColors(index)} radius={[3, 3, 0, 0]} barSize={Math.max(15, 50 / series.length)} />
                        ))}
                    </BarChart>
                );
            }

            case 'bar-diverging': {
                const transformedData = transformDivergingData(chartData as any[]);
                return (
                    <BarChart data={transformedData} layout="vertical" stackOffset="sign" {...commonProps} height={460}>
                        <CartesianGrid {...gridProps} />
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={60} tickFormatter={formatComma} />
                        <ReferenceLine x={0} stroke="#9CA3AF" strokeWidth={1} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Bar dataKey="positive" name={divergingLabels[0]} fill={graphColors(0)} stackId="stack" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="negative" name={divergingLabels[1]} fill={graphColors(3)} stackId="stack" radius={[4, 0, 0, 4]} />
                    </BarChart>
                );
            }

            case 'line':
                return (
                    <LineChart data={chartData as any[]} {...commonProps} height={460}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={graphColors(0)}
                            strokeWidth={3}
                            dot={{ fill: graphColors(0), strokeWidth: 2, r: 4 }}
                        />
                    </LineChart>
                );

            case 'area':
                return (
                    <AreaChart data={chartData as any[]} {...commonProps} height={460}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <defs>
                            <linearGradient id="bullets-area-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={graphColors(0)} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={graphColors(0)} stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={graphColors(0)}
                            strokeWidth={2}
                            fill="url(#bullets-area-gradient)"
                        />
                    </AreaChart>
                );

            case 'area-stacked': {
                const transformedData = transformMultiSeriesData(chartData as any[], series);
                return (
                    <AreaChart data={transformedData} {...commonProps} height={460}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        {series.map((s: string, index: number) => (
                            <Area key={s} type="monotone" dataKey={s} stackId="1" stroke={graphColors(index)} fill={graphColors(index)} fillOpacity={0.4} />
                        ))}
                    </AreaChart>
                );
            }

            case 'pie':
                return (
                    <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }} height={460}>
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Pie
                            data={chartData as any[]}
                            outerRadius={80}
                            dataKey="value"
                            label={renderPieLabel}
                        >
                            {(chartData as any[]).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                            ))}
                        </Pie>
                    </PieChart>
                );

            case 'donut':
                return (
                    <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }} height={460}>
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Pie
                            data={chartData as any[]}
                            innerRadius={40}
                            outerRadius={80}
                            dataKey="value"
                            label={renderPieLabel}
                            paddingAngle={2}
                        >
                            {(chartData as any[]).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                            ))}
                        </Pie>
                    </PieChart>
                );

            case 'scatter':
                return (
                    <ScatterChart {...commonProps} height={460}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="x" type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis dataKey="y" type="number" {...axisProps} tickFormatter={formatComma} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Scatter data={chartData as any[]}>
                            {(chartData as any[]).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={graphColors(index)} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                );

            default:
                return <div className="flex items-center justify-center h-full text-muted-foreground">Unsupported chart type</div>;
        }
    };

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div
                className="w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card relative z-20 mx-auto overflow-hidden"
                style={{
                    fontFamily: 'var(--heading-font-family,Poppins)',
                    background: "var(--background-color,#ffffff)"
                }}
            >
                {((slideData as any)?.__companyName__ || (slideData as any)?._logo_url__) && (
                    <div className="absolute top-0 left-0 right-0 px-8  pt-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                {(slideData as any)?._logo_url__ && <img src={(slideData as any)?._logo_url__} alt="logo" className="w-[60px] object-contain" />}
                                <span
                                    style={{ backgroundColor: 'var(--stroke, #F0F0F0)' }}
                                    className=' w-[2px] h-4'></span>
                                {(slideData as any)?.__companyName__ && <span className="text-sm  font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                                    {(slideData as any)?.__companyName__ || 'Company Name'}
                                </span>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="flex h-full px-8 sm:px-12 lg:px-20 pt-8 pb-8">
                    {/* Left Section - Title, Description, Chart */}
                    <div className="flex-1 flex flex-col pr-8">
                        {/* Title */}
                        <h1 style={{ color: "var(--background-text,#111827)" }} className="text-[42.7px] font-bold text-foreground mb-4">
                            {slideData?.title || 'Market Size'}
                        </h1>

                        {/* Description */}
                        <p style={{ color: "var(--background-text,#4b5563)" }} className="text-base text-foreground leading-relaxed mb-4">
                            {slideData?.description || 'Businesses face challenges with outdated technology and rising costs, limiting efficiency and growth in competitive markets.'}
                        </p>

                        {/* Chart Container */}
                        <div className="flex-1 rounded-lg shadow-sm border  p-2 max-h-[460px]"

                            style={{
                                borderColor: 'var(--stroke,#F8F9FA)',
                                backgroundColor: 'var(--card-color,#FFFFFF)'
                            }}
                        >
                            <ResponsiveContainer maxHeight={460} height='100%' className="">
                                {renderChart()}
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Right Section - Bullet Point Boxes */}
                    <div className="flex-shrink-0 w-80 flex flex-col justify-center space-y-4">
                        {bulletPoints.map((bullet, index) => (
                            <div
                                key={index}
                                className="rounded-2xl p-6 text-foreground"
                                style={{
                                    backgroundColor: 'var(--card-color,#9333ea)'
                                }}
                            >
                                {/* Icon and Title */}
                                <div className="flex items-center space-x-3 mb-3">
                                    <div style={{ background: "var(--primary-color,#9333ea)" }} className="w-8 h-8 rounded-lg flex items-center justify-center">
                                        <RemoteSvgIcon
                                            url={bullet.icon.__icon_url__}
                                            strokeColor={"currentColor"}
                                            className="w-5 h-5"
                                            color="var(--primary-text,#ffffff)"
                                            title={bullet.icon.__icon_query__}
                                        />
                                    </div>
                                    <h3 style={{ color: "var(--background-text,#ffffff)" }} className="text-lg font-semibold">
                                        {bullet.title}
                                    </h3>
                                </div>

                                {/* Description */}
                                <p style={{ color: "var(--background-text,#ffffff)" }} className="text-sm leading-relaxed opacity-90">
                                    {bullet.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}

export default ChartWithBulletsSlideLayout
