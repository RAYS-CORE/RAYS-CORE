import React from 'react'
import * as z from "zod";

export const layoutId = 'headline-text-with-stats-layout'
export const layoutName = 'Numbered List With Side Metrics'
export const layoutDescription = 'A two-column layout with bold title, accent bar, and numbered bullet point list on the left, paired with 3 large vertical metrics on the right. Each metric shows value with label and accent dot.'

export const Schema = z.object({
    title: z.string().max(30).describe('The main heading of the slide').default('Executive Summary'),
    bulletPoints: z.array(z.string().max(160)).max(6).describe('List of bullet point text items').default([
        'Exceeded revenue target by 12% ($2.4M vs $2.1M target), driven by strong performance in paid search and email campaigns',
        'Marketing influenced 68% of total pipeline value, up from 52% last quarter',
        'Paid Search ROI improved to 5.8x (from 4.1x), making it our most efficient channel',
        'Marketing influenced 68% of total pipeline value, up from 52% last quarter',
        'Paid Search ROI improved to 5.8x (from 4.1x), making it our most efficient channel',
        'Marketing influenced 68% of total pipeline value, up from 52% last quarter',
        'Paid Search ROI improved to 5.8x (from 4.1x), making it our most efficient channel',
    ]),
    metrics: z.array(z.object({
        value: z.string().max(8).describe('Value displayed for the metric'),
        label: z.string().max(10).describe('Label text for the metric')
    })).describe('Metric items displayed on the right side').default([
        { value: '8,450', label: 'Leads' },
        { value: '2,680', label: 'MQLS' },
        { value: '$2400', label: 'Revenue' }
    ])
});

export type HeadlineTextWithBulletsAndStatsData = z.infer<typeof Schema>

interface HeadlineTextWithBulletsAndStatsLayoutProps {
    data: Partial<HeadlineTextWithBulletsAndStatsData>
}

const HeadlineTextWithBulletsAndStatsLayout: React.FC<HeadlineTextWithBulletsAndStatsLayoutProps> = ({ data }) => {


    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden  gap-10 flex flex-row items-center justify-between px-[90px] py-[80px] "

                style={{
                    fontFamily: 'var(--heading-font-family,Poppins)',
                    background: "var(--background-color,#ffffff)"
                }}
            >
                {((data as any)?.__companyName__ || (data as any)?._logo_url__) && (
                    <div className="absolute top-0 left-0 right-0 px-8  pt-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                {(data as any)?._logo_url__ && <img src={(data as any)?._logo_url__} alt="logo" className="w-[60px] object-contain" />}
                                <span
                                    style={{ backgroundColor: 'var(--stroke, #F0F0F0)' }}
                                    className=' w-[2px] h-4'></span>
                                {(data as any)?.__companyName__ && <span className="text-sm  font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                                    {(data as any)?.__companyName__ || 'Company Name'}
                                </span>}
                            </div>
                        </div>
                    </div>
                )}
                {/* Left Content Column */}
                <div className="flex-[1.5]  flex flex-col justify-center">
                    <div className="flex flex-col ">
                        <h1 className="text-[42.7px]  font-bold leading-[1.1] tracking-[-2px]"

                            style={{
                                color: 'var(--background-text,#101828)'
                            }}
                        >
                            {data.title}
                        </h1>
                        <div className="w-[116.6px] h-[5.7px] mt-4"

                            style={{
                                backgroundColor: 'var(--primary-color,#9234EB)'
                            }}
                        />
                    </div>

                    <div className="flex flex-col gap-[20px] mt-10">
                        {data.bulletPoints?.map((point, index) => (
                            <div key={index} className="flex items-start gap-[8px]">
                                <span className="text-[16px]  font-normal leading-[1.8] shrink-0"

                                    style={{
                                        color: 'var(--background-text,#000000)'
                                    }}
                                >
                                    {index + 1}.
                                </span>
                                <p className="text-[16px]  font-normal leading-[1.8]"

                                    style={{
                                        color: 'var(--background-text,#4D5463)'
                                    }}
                                >
                                    {point}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Metrics Column */}
                <div className="w-[340px] space-y-[40px] pl-[60px]">
                    {data.metrics?.map((metric, index) => (
                        <div key={index} className="flex flex-col">
                            <span className="text-[70.1px] font-normal leading-none tracking-tight"

                                style={{
                                    color: 'var(--background-text,#4D5463)'
                                }}
                            >
                                {metric.value}
                            </span>
                            <div className="flex items-center gap-[12px] mt-[10px]">
                                <div className="w-[15.8px] h-[15.8px] rounded-full shrink-0"
                                    style={{
                                        backgroundColor: 'var(--primary-color,#9134EB)'
                                    }}
                                />
                                <span className="text-[17.4px] font-normal uppercase tracking-wide"

                                    style={{
                                        color: 'var(--background-text,#4D5463)'
                                    }}
                                >
                                    {metric.label}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

export default HeadlineTextWithBulletsAndStatsLayout;