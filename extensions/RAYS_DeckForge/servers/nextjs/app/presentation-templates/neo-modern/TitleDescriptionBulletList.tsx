import * as z from 'zod';
import React from 'react';

export const Schema = z.object({
    title: z.string().max(30).describe('The main title of the slide').default('Key Takeaways'),
    description: z.string().max(300).describe('The main paragraph description on the slide').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    bullets: z.array(z.object({
        heading: z.string().max(40).describe('The heading for this bullet point'),
        description: z.string().max(120).describe('The description for this bullet point'),
    })).max(5).describe('A list of up to 5 bullet points, each with a heading and description').default([
        { heading: 'Market expansion', description: 'Prioritize high-growth verticals and geographic regions with strong demand.' },
        { heading: 'Customer retention', description: 'Reduce churn through proactive support and tailored success programs.' },
        { heading: 'Product innovation', description: 'Ship features that align with top customer requests and usage data.' },
        { heading: 'Operational efficiency', description: 'Automate repetitive workflows to free capacity for strategic work.' },
        { heading: 'Team enablement', description: 'Invest in training and tools so teams can execute at scale.' },
    ]),
});

export const layoutId = 'title-description-bullet-list';
export const layoutName = 'Title Description Bullet List';
export const layoutDescription = 'A clean two-column layout with a main title and description on the left, and up to 5 bullet points on the right. Each bullet has a heading and a short description. Ideal for key takeaways, feature highlights, or structured lists with context.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, bullets } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <div
                className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >
                <div className="flex h-full w-full items-center justify-between px-[115px] gap-20">
                    {/* Left Section: Title + Description */}
                    <div className="flex flex-col flex-[1.2] justify-center">
                        {title && (
                            <h1
                                className="text-[42.7px] font-bold mb-6 leading-tight"
                                style={{ letterSpacing: '-1.6px', color: 'var(--background-text,#002BB2)' }}
                            >
                                {title}
                            </h1>
                        )}
                        {description && (
                            <p
                                className="text-[16px] leading-[28.5px] max-w-[475px]"
                                style={{ color: 'var(--background-text,#002BB2)' }}
                            >
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Right Section: Bullet list */}
                    <div className="flex flex-col flex-1 justify-center gap-5">
                        {bullets?.map((item, index) => (
                            <div
                                key={index}
                                className="flex flex-col justify-center px-5 py-4 rounded-[3.4px] border-l-4"
                                style={{
                                    backgroundColor: 'var(--card-color,#F7F8FF)',
                                    borderLeftColor: 'var(--stroke,#4C68DF)',
                                }}
                            >
                                <h3
                                    className="text-[17.5px] font-bold leading-[21px]"
                                    style={{ color: 'var(--background-text,#002BB2)' }}
                                >
                                    {item.heading}
                                </h3>
                                <p
                                    className="text-[15.3px] leading-[18.4px] mt-1"
                                    style={{ color: 'var(--background-text,#002BB2)' }}
                                >
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default dynamicSlideLayout;
