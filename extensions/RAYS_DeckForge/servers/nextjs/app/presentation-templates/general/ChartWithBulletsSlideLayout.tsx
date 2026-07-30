import React from 'react'
import * as z from "zod";
import { IconSchema } from '../defaultSchemes';
import { RemoteSvgIcon } from '@/app/hooks/useRemoteSvgIcon';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export const layoutId = 'chart-with-bullets-slide'
export const layoutName = 'Chart with Bullet Boxes'
export const layoutDescription = 'A slide layout with title, description, chart on the left and colored bullet boxes with icons on the right. Only choose this if data is available.'

const barPieLineAreaChartDataSchema = z.object({
    type: z.union([z.literal('bar'), z.literal('pie'), z.literal('line'), z.literal('area')]),
    data: z.array(z.object({
        name: z.string().meta({ description: "Data point name" }),
        value: z.number().meta({ description: "Data point value" }),
    })).min(2).max(5)
})

const scatterChartDataSchema = z.object({
    type: z.literal('scatter'),
    data: z.array(z.object({
        x: z.number().meta({ description: "X coordinate" }),
        y: z.number().meta({ description: "Y coordinate" }),
    })).min(2).max(20)
})

const chartWithBulletsSlideSchema = z.object({
    title: z.string().min(3).max(40).default('Market Size').meta({
        description: "Main title of the slide",
    }),
    description: z.string().min(10).max(150).default('Businesses face challenges with outdated technology and rising costs, limiting efficiency and growth in competitive markets.').meta({
        description: "Description text below the title",
    }),
    chartData: z.union([barPieLineAreaChartDataSchema, scatterChartDataSchema]).default({
        type: 'bar',
        data: [
            { name: 'Q1', value: 5 },
            { name: 'Q1', value: 5 },
            { name: 'Q1', value: 5 },
        ]
    }
    ),

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

const CHART_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
];



const ChartWithBulletsSlideLayout: React.FC<ChartWithBulletsSlideLayoutProps> = ({ data: slideData }) => {
    const chartData = slideData?.chartData?.data || [];
    const chartType = slideData?.chartData?.type;
    const color = 'var(--background-text, #9333ea)';
    const xAxis = chartType === 'scatter' ? 'x' : 'name';
    const yAxis = chartType === 'scatter' ? 'y' : 'value';
    const showLegend = slideData?.showLegend || false;
    const showTooltip = slideData?.showTooltip || true;
    const bulletPoints = slideData?.bulletPoints || []

    const renderChart = () => {
        const renderPieLabel = (props: any) => {
            const { name, percent, x, y, textAnchor } = props;
            return (
                <text x={x} y={y} textAnchor={textAnchor} fill="var(--background-text, #4b5563)" fontSize={12}>
                    {`${name} ${(percent * 100).toFixed(0)}%`}
                </text>
            );
        };
        const commonProps = {
            data: chartData,
            margin: { top: 20, right: 30, left: 0, bottom: 0 },
        };
        const axisProps = {
            tick: { fill: 'var(--background-text, #7f8491)', fontSize: 12, fontWeight: 600 },
            axisLine: { stroke: 'var(--background-text, #7f8491)' },
            tickLine: { stroke: 'var(--background-text, #7f8491)' },
        };


        switch (chartType) {
            case 'bar':
                return (
                    <BarChart {...commonProps} >
                        <CartesianGrid strokeDasharray="3 3" stroke={`var(--background-text, ${color})`} />
                        <XAxis dataKey={xAxis} {...axisProps} />
                        <YAxis {...axisProps} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Bar dataKey={yAxis} barSize={70} radius={[8, 8, 0, 0]} >
                            {chartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={`var(--graph-${index}, ${CHART_COLORS[index % CHART_COLORS.length]})`} />
                            ))}
                        </Bar>
                    </BarChart>
                );

            case 'line':
                return (
                    <LineChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`var(--background-text, ${color})`} />
                        <XAxis dataKey={xAxis} {...axisProps} />
                        <YAxis {...axisProps} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Line
                            type="monotone"
                            dataKey={yAxis}
                            strokeWidth={3}
                            dot={{ fill: `var(--graph-0, ${CHART_COLORS[0]})`, strokeWidth: 2, r: 4 }}
                        >
                            {chartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={`var(--graph-${index}, ${CHART_COLORS[index % CHART_COLORS.length]})`} />
                            ))}
                        </Line>
                    </LineChart>
                );

            case 'area':
                return (
                    <AreaChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`var(--background-text, ${color})`} />
                        <XAxis dataKey={xAxis} {...axisProps} />
                        <YAxis {...axisProps} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Area
                            type="monotone"
                            dataKey={yAxis}
                            fillOpacity={0.6}
                        >
                            {chartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={`var(--graph-${index}, ${CHART_COLORS[index % CHART_COLORS.length]})`} />
                            ))}
                        </Area>
                    </AreaChart>
                );

            case 'pie':
                return (
                    <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        {showTooltip && <Tooltip content={<CustomTooltip />} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Pie
                            data={chartData}
                            outerRadius={70}
                            fill={`var(--background-text, ${color})`}
                            dataKey={yAxis}
                            label={renderPieLabel}
                        >
                            {chartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={`var(--graph-${index}, ${CHART_COLORS[index % CHART_COLORS.length]})`} />
                            ))}
                        </Pie>
                    </PieChart>
                );

            case 'scatter':
                return (
                    <ScatterChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`var(--background-text, ${color})`} />
                        <XAxis dataKey={xAxis} type="number" {...axisProps} />
                        <YAxis dataKey={yAxis} type="number" {...axisProps} />
                        {showTooltip && <Tooltip content={<CustomTooltip />} />}
                        {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                        <Scatter dataKey="value" >
                            {chartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={`var(--graph-${index}, ${CHART_COLORS[index % CHART_COLORS.length]})`} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                );

            default:
                return <div>Unsupported chart type</div>;
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
                    <div className="absolute top-0 left-0 right-0 px-8 sm:px-12 lg:px-20 pt-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">

                                {(slideData as any)?._logo_url__ && <img src={(slideData as any)?._logo_url__} alt="logo" className="w-6 h-6" />}
                                {(slideData as any)?.__companyName__ && <span className="text-sm sm:text-base font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
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
                        <h1 style={{ color: "var(--background-text, #111827)" }} className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4">
                            {slideData?.title || 'Market Size'}
                        </h1>

                        {/* Description */}
                        <p style={{ color: "var(--background-text, #4b5563)" }} className="text-base text-foreground leading-relaxed mb-8">
                            {slideData?.description || 'Businesses face challenges with outdated technology and rising costs, limiting efficiency and growth in competitive markets.'}
                        </p>

                        {/* Chart Container */}
                        <div className="flex-1 rounded-lg shadow-sm border border-border p-4"
                            style={{
                                borderColor: 'var(--stroke, #F8F9FA)',
                            }}
                        >
                            {/* <ChartContainer config={chartConfig} className="h-full w-full"> */}
                            <ResponsiveContainer maxHeight={460} height='100%' className="">

                                {renderChart()}
                            </ResponsiveContainer>
                            {/* </ChartContainer> */}
                        </div>
                    </div>

                    {/* Right Section - Bullet Point Boxes */}
                    <div className="flex-shrink-0 w-80 flex flex-col justify-center space-y-4">
                        {bulletPoints.map((bullet, index) => (
                            <div
                                key={index}
                                className="rounded-2xl p-6 text-foreground"
                                style={{
                                    backgroundColor: 'var(--primary-color,#9333ea)'
                                }}
                            >
                                {/* Icon and Title */}
                                <div className="flex items-center space-x-3 mb-3">
                                    <div style={{ background: "var(--primary-color,#9333ea)" }} className="w-8 h-8 rounded-lg flex items-center justify-center">
                                        <RemoteSvgIcon
                                            url={bullet.icon.__icon_url__}
                                            strokeColor={"currentColor"}
                                            className="w-5 h-5"
                                            color="var(--primary-text, #ffffff)"
                                            title={bullet.icon.__icon_query__}
                                        />
                                    </div>
                                    <h3 style={{ color: "var(--primary-text, #ffffff)" }} className="text-lg font-semibold">
                                        {bullet.title}
                                    </h3>
                                </div>

                                {/* Description */}
                                <p style={{ color: "var(--primary-text, #ffffff)" }} className="text-sm leading-relaxed opacity-90">
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