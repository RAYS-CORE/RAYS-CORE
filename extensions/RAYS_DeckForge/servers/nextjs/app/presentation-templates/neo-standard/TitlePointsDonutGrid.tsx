import * as z from 'zod';

/**
 * Lightweight radial progress component using SVG
 */
const RadialProgress = ({ value, size = 110, strokeWidth = 12 }: { value: number; size?: number; strokeWidth?: number }) => {
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
    points: z.array(z.string().max(200)).max(3).describe("A list of key summary points").default([
        "Exceeded revenue target by 12% ($2.4M vs $2.1M target), driven by strong performance in paid search and email campaigns",
        "Marketing influenced 68% of total pipeline value, up from 52% last quarter",
        "Paid Search ROI improved to 5.8x (from 4.1x), making it our most efficient channel"
    ]),
    cards: z.array(z.object({
        heading: z.string().max(20).describe("The heading for each card"),
        percentageValue: z.number().describe("The percentage value to be shown in the donut chart"),
        footerHeading: z.string().max(30).describe("The descriptive label in the card footer"),
        footerDescription: z.string().max(30).describe("The specific detail in the card footer")
    })).min(2).max(6).describe("A list of up to 6 data cards").default(Array(6).fill({
        heading: "Research",
        percentageValue: 99,
        footerHeading: "Main Challenge:",
        footerDescription: "Delayed Client"
    }))
});

export const layoutId = "title-points-donut-grid";
export const layoutName = "Title Points Donut Grid";
export const layoutDescription = "A slide with a title and numbered summary points on the left, paired with a 2x3 grid of analytical cards featuring donut progress charts on the right.";

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, points, cards } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden "

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Playfair Display)',
                }}
            >
                <div className="flex h-full w-full">
                    {/* Left Section */}
                    <div className="flex flex-col justify-center w-[48%] pl-[89.6px] pr-8">
                        <div className="mb-4">
                            <div className="w-[116.6px] h-[3.3px] bg-[#1F8A2E] mb-[17px]"
                                style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                            />
                            <h1 className="text-[42.7px] text-[#101828]  font-bold leading-[1.1] tracking-[-1.6px] mb-8"

                                style={{ color: 'var(--background-text,#000000)' }}
                            >
                                {title}
                            </h1>
                        </div>
                        <div className="space-y-4">
                            {points?.map((point, index) => (
                                <div key={index} className="flex items-start text-[16px] leading-[1.8] text-[#4D5463]">
                                    <span className="text-[#000000] mr-2 flex-shrink-0"

                                        style={{ color: 'var(--background-text,#000000)' }}
                                    >{index + 1}.</span>
                                    <p className="text-[#4D5463]"

                                        style={{ color: 'var(--background-text,#000000)' }}
                                    >
                                        {point}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Section - Grid */}
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="grid grid-cols-2 gap-4"

                        >
                            {cards?.map((card, index) => (
                                <div key={index} className="w-[230px] h-[212.8px] bg-[#FEFEFE] border-[0.7px] border-[#EBEBEB] rounded-lg p-3 flex flex-col items-center justify-between"
                                    style={{ backgroundColor: 'var(--card-color,#FEFEFE)', borderColor: 'var(--stroke,#EBEBEB)' }}
                                >
                                    <div className="text-[15.8px] text-[#000000] mt-1"
                                        style={{ color: 'var(--background-text,#000000)' }}
                                    >
                                        {card.heading}
                                    </div>

                                    <div className="relative w-[110px] h-[110px] flex items-center justify-center my-1">
                                        <RadialProgress value={card.percentageValue || 0} size={110} strokeWidth={12} />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-[16px] text-[#000000]"
                                                style={{ color: 'var(--background-text,#000000)' }}
                                            >{card.percentageValue}%</span>
                                        </div>
                                    </div>

                                    <div className="text-center mb-1">
                                        <p className="text-[12.6px] text-[#000000] leading-tight"
                                            style={{ color: 'var(--background-text,#000000)' }}
                                        >{card.footerHeading}</p>
                                        <p className="text-[12.6px] text-[#000000] leading-tight"
                                            style={{ color: 'var(--background-text,#000000)' }}
                                        >{card.footerDescription}</p>
                                    </div>
                                </div>
                            ))}
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

