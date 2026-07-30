import * as z from 'zod';
import React from 'react';

export const Schema = z.object({
    title: z.string().max(30).describe('The main heading of the slide').default('Funnel Performance'),
    metricValue: z.string().max(10).describe('Primary metric value displayed').default('0.24%'),
    metricLabel: z.string().max(100).describe('Label describing the metric').default('Overall\nVisit → Customer'),
    funnelStages: z.array(z.object({
        label: z.string().max(30).describe('Label for the stage'),
        value: z.string().max(15).describe('Value displayed for this stage'),
        conversionRate: z.string().max(10).describe('Rate value shown for the stage').optional(),
    })).max(5).describe('Data points for the funnel visualization').default([
        { label: 'Visitors', value: '124,500', conversionRate: '10%' },
        { label: 'Leads', value: '12,450', conversionRate: '10%' },
        { label: 'Marketing Qualified', value: '4,356', conversionRate: '35%' },

    ]),
});

export const layoutId = 'title-metricValue-metricLabel-funnelStages';
export const layoutName = 'Metric With Funnel Bars';
export const layoutDescription = 'A layout featuring title with accent bar, left-side key metric with label, and horizontal funnel visualization on the right. Each funnel stage shows labeled pill, connector line, and colored bar with value and rate.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, metricValue, metricLabel, funnelStages } = data;


    const barWidths = ['100%', '89.7%', '77.2%', '68.0%', '60.8%'];

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden px-[64px] py-[40px] font-['Poppins']"

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

                <div>
                    <h1 className="text-[42.7px] font-bold leading-[1.1] tracking-[-2px] mb-4 whitespace-pre-line" style={{ color: 'var(--background-text,#101828)' }}>
                        {title || 'Funnel Performance'}
                    </h1>
                    <div className="w-[116px] h-[6px]" style={{ backgroundColor: 'var(--primary-color,#9234EB)' }} />
                </div>
                <div className="flex flex-row justify-between h-full items-center">
                    <div className="basis-[35%] flex flex-col justify-between ">

                        <div className="mb-16">
                            <div className="text-[70.1px] font-normal leading-none" style={{ color: 'var(--background-text,#4D5463)' }}>
                                {metricValue || '0.00%'}
                            </div>
                            <div className="text-[17.4px] font-normal mt-4 whitespace-pre-line leading-relaxed" style={{ color: 'var(--background-text,#4D5463)' }}>
                                {metricLabel || 'Overall\nMetric Description'}
                            </div>
                        </div>
                    </div>

                    {/* Right Content Column - Funnel Infographic */}
                    <div className="flex-1 flex flex-col justify-center  gap-[12px] h-full">
                        {funnelStages?.map((stage, index) => (
                            <div key={index} className="flex items-center">
                                {/* Stage Title Pill */}
                                <div className="flex-shrink-0 w-[127px] h-[60px] border-[1.3px] rounded-full flex items-center justify-center px-4  z-10 shadow-sm" style={{ borderColor: 'var(--primary-color,#9134EB)', backgroundColor: 'var(--card-color,#FFFFFF)' }}>
                                    <span className="text-[16px]   font-normal text-center leading-[1.2]"
                                        style={{ color: 'var(--background-text,#000000)' }}
                                    >
                                        {stage.label}
                                    </span>
                                </div>

                                {/* Connector Line Shape */}
                                <div className="flex-shrink-0 w-[45px] h-[2.7px]" style={{ backgroundColor: 'var(--primary-color,#9134EB)' }} />

                                {/* Funnel Data Bar */}
                                <div
                                    className="h-[94px] flex items-center px-8 justify-between text-foreground"
                                    style={{
                                        backgroundColor: `var(--primary-color,#9134EB)`,
                                        width: barWidths[index % barWidths.length],
                                        color: 'var(--primary-text,#FFFFFF)'
                                    }}
                                >
                                    <div className="text-[22.5px] font-bold" style={{ color: 'var(--primary-text,#FFFFFF)' }}>
                                        {stage.value}
                                    </div>

                                    {stage.conversionRate && (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[14.2px]   font-bold opacity-90 leading-none"

                                                style={{ color: 'var(--primary-text,#FFFFFF)' }}
                                            >
                                                Conversion
                                            </span>
                                            <span className="text-[22.5px]   font-bold mt-1 leading-none"

                                                style={{ color: 'var(--primary-text,#FFFFFF)' }}
                                            >
                                                {stage.conversionRate}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};
export default dynamicSlideLayout;