import * as z from "zod";
import React from "react";

export const Schema = z.object({
    title: z.string().max(25).describe('The main heading of the slide').default('Key Insights & Learnings'),
    insightTitle: z.string().max(63).describe('Heading for the highlighted card').default('CONTENT + PAID SOCIAL COMBINATION DRIVES HIGHEST QUALITY LEADS'),
    insightDescription: z.string().max(99).describe('Description text for the highlighted card').default('Leads from integrated campaigns had 47% faster time-to-close and 28% higher average contract value.')
});

export const layoutId = 'title-side-insight-slide';
export const layoutName = 'Split Title With Text Card';
export const layoutDescription = 'A balanced two-section layout with bold title and accent bar on the left, paired with a white card on the right containing accent-colored heading and description text.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, insightTitle, insightDescription } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex items-center px-16 "

                style={{
                    fontFamily: 'var(--heading-font-family,Poppins)',
                    background: "var(--background-color,#ffffff)"
                }}
            >
                {((data as any)?.__companyName__ || (data as any)?._logo_url__) && (
                    <div className="absolute top-0 left-0 right-0 px-8  pt-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                {(data as any)?._logo_url__ && <img src={(data as any)?._logo_url__} alt="logo" className="w-[40px] object-contain" />}
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



                {/* Main Title */}
                <div className="  w-1/2 ">
                    <div
                        className="text-left min-h-[1.2em] max-w-[429.1px]"
                        style={{
                            lineHeight: '45.2px',
                            letterSpacing: '-1.6px',

                            fontSize: '42.7px',
                            color: 'var(--background-text,#101828)',
                            fontWeight: 700
                        }}
                    >
                        {title}
                    </div>
                    <div
                        className=" w-[116.6px] h-[5.7px] overflow-visible mt-4"
                        style={{ backgroundColor: 'var(--primary-color,#9234EB)' }}
                    ></div>
                </div>



                <div className="w-1/2"
                >
                    <div className="  p-12">
                        <div className="p-10 py-24 bg-card shadow-md rounded-lg"

                            style={{
                                background: 'var(--card-color,#ffffff)'
                            }}
                        >

                            {/* Insight Title */}
                            <div className=" overflow-visible">
                                <div
                                    className="text-left min-h-[1.2em]"
                                    style={{
                                        lineHeight: '29.9px',

                                        fontSize: '21.3px',
                                        color: 'var(--background-text,#9234EC)',
                                        fontWeight: 700
                                    }}
                                >
                                    {insightTitle}
                                </div>
                            </div>

                            {/* Insight Description */}
                            <div className="overflow-visible mt-6">
                                <div
                                    className="text-left min-h-[1.2em]"
                                    style={{
                                        lineHeight: '32.3px',

                                        fontSize: '23.1px',
                                        color: 'var(--background-text,#000000)'
                                    }}
                                >
                                    {insightDescription}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default dynamicSlideLayout;