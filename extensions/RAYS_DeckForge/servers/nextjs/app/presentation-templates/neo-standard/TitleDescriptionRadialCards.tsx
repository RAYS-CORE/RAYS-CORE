import * as z from 'zod';
import React from 'react';

/**
 * Lightweight radial progress component using SVG
 */
const RadialProgress = ({ value, size = 120, strokeWidth = 14 }: { value: number; size?: number; strokeWidth?: number }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(Math.max(value, 0), 100);
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            {/* Background track */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--graph-1, #DDE1E6)"
                strokeWidth={strokeWidth}
            />
            {/* Progress arc */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--graph-0, #1F8A2E)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
            />
        </svg>
    );
};

export const Schema = z.object({
    title: z.string().describe("The main title of the slide").default("Executive Summary"),
    description: z.string().describe("A brief overview or summary description").default("Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies."),
    cards: z.array(z.object({
        heading: z.string().describe("Heading for the card item").max(20),
        graph: z.object({

            value: z.number().describe("The numerical percentage value for the chart"),
        }),
        footerText: z.string().describe("The descriptive text at the bottom of the card").max(50),
    })).max(8).default([
        { heading: "Research", graph: { value: 1 }, footerText: "Main Challenge: Delayed Client" },
        { heading: "Research", graph: { value: 40 }, footerText: "Main Challenge: Delayed Client" },
        { heading: "Research", graph: { value: 60 }, footerText: "Main Challenge: Delayed Client" },
        { heading: "Research", graph: { value: 80 }, footerText: "Main Challenge: Delayed Client" },
        { heading: "Research", graph: { value: 30 }, footerText: "Main Challenge: Delayed Client" },
        { heading: "Research", graph: { value: 99 }, footerText: "Main Challenge: Delayed Client" },
    ]),
});

type SlideData = z.infer<typeof Schema>;

export const layoutId = "title-description-radial-cards";
export const layoutName = "Title Description Radial Cards";
export const layoutDescription = "A centered slide featuring a title and description at the top, followed by a flexible grid of up to 8 cards with radial progress charts.";

const dynamicSlideLayout: React.FC<{ data: Partial<SlideData> }> = ({ data }) => {
    const { title, description, cards } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col items-center py-12 px-14"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Playfair Display)',
                }}
            >


                {/* Header Section */}
                <div className="text-center mb-6">
                    <div className="w-[116.6px] mx-auto h-[3.3px] bg-[#1F8A2E] mb-[6px]"

                        style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                    />
                    <h1 className="text-[42.7px] text-[#101828]  font-bold tracking-[-1.6px] leading-[1.1] mb-4"
                        style={{ color: 'var(--background-text,#000000)' }}
                    >
                        {title}
                    </h1>
                    <p className="text-[16px] text-[#000000]  leading-[1.8] max-w-[820px] mx-auto"
                        style={{ color: 'var(--background-text,#000000)' }}
                    >
                        {description}
                    </p>
                </div>

                {/* Flex with wrap Content */}
                <div className="w-full flex justify-center mt-4">
                    <div className="flex flex-wrap gap-x-5 gap-y-3 w-full max-w-[1100px] justify-center items-center"
                    >
                        {cards?.map((card, index) => (
                            <div
                                key={index}
                                className="bg-[#FEFEFE] border-[0.7px] border-[#EBEBEB] min-w-[260px]   rounded-[7px] p-4 flex flex-col items-center justify-between min-h-[212px]"
                                style={{ borderColor: 'var(--stroke,#EBEBEB)', backgroundColor: 'var(--card-color,#FEFEFE)' }}
                            >
                                <span className="text-[16px] text-[#000000]  text-center"
                                    style={{ color: 'var(--background-text,#000000)' }}
                                >
                                    {card.heading}
                                </span>

                                <div className="relative w-[128px] h-[128px] flex items-center justify-center my-1">
                                    <RadialProgress value={card.graph?.value || 0} size={120} strokeWidth={14} />
                                    {/* Center label */}
                                    <div className="absolute inset-0 flex items-center justify-center ">
                                        <span className="text-[18px] text-[#101828] font-bold"
                                            style={{ color: 'var(--background-text,#000000)' }}
                                        >
                                            {card.graph?.value}%
                                        </span>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <p className="text-[12.6px] text-[#000000]  leading-[1.4] whitespace-pre-line"

                                        style={{ color: 'var(--background-text,#000000)' }}
                                    >
                                        {card.footerText?.split(':').map((part, i) => (
                                            <React.Fragment key={i}>
                                                {part}{i === 0 && card.footerText.includes(':') ? ':' : ''}
                                                {i === 0 && card.footerText.includes(':') && <br />}
                                            </React.Fragment>
                                        ))}
                                    </p>
                                </div>
                            </div>
                        ))}
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

