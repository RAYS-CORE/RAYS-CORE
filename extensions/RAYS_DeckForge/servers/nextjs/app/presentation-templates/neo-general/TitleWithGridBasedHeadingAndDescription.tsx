import * as z from "zod";
import React from "react";
export const Schema = z.object({
    title: z.string().max(25).describe('The main heading of the slide').default('Key Insights & Learnings'),

    cards: z.array(z.object({
        heading: z.string().max(56).describe('Heading text for the card'),
        description: z.string().max(46).describe('Description text for the card'),
    })).describe('Array of cards with heading and description').default([
        {
            heading: 'ENTERPRISE ABM DELIVERS 3.2X HIGHER CONVERSION RATES',
            description: 'Account-based campaigns targeting enterprises.',
        },
        {
            heading: 'CONTENT + PAID SOCIAL COMBINATION DRIVES HIGHEST',
            description: 'Leads from integrated campaigns had 47% faster.',
        },
        {
            heading: 'MOBILE OPTIMIZATION INCREASED MOBILE',
            description: 'Landing page redesign focused on mobile.',
        },
        {
            heading: 'ENTERPRISE ABM DELIVERS 3.2X HIGHER CONVERSION RATES',
            description: 'Account-based campaigns targeting enterprises.',
        },
        {
            heading: 'CONTENT + PAID SOCIAL COMBINATION DRIVES HIGHEST',
            description: 'Leads from integrated campaigns had 47% faster.',
        },
        {
            heading: 'MOBILE OPTIMIZATION INCREASED MOBILE',
            description: 'Landing page redesign focused on mobile.',
        },
    ]),
});

export const layoutId = 'title-six-card-grid-slide-layout';
export const layoutName = 'Title With Six Text Cards Grid';
export const layoutDescription = 'A layout featuring left-aligned bold title with accent bar, followed by a 3x2 grid of up to 6 cards. Each card contains an accent-colored heading and description text.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, cards } = data;



    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden p-16 font-['Poppins']"
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
                {/* Main Title */}
                <div className=" w-[761.6px]  overflow-visible mb-10">
                    <div className="text-left" style={{ lineHeight: '45.2px' }}>
                        <span className="text-[42.7px]  font-bold" style={{ letterSpacing: '-1.6px', color: 'var(--background-text,#101828)' }}>
                            {title}
                        </span>
                    </div>
                    <div
                        className=" w-[116.6px] h-[5.7px] overflow-visible mt-4"
                        style={{ backgroundColor: 'var(--primary-color,#9234EB)' }}
                    ></div>
                </div>

                {/* Decorative Underline */}

                <div className="grid grid-cols-3 gap-2">

                    {/* Grid of Insight Cards */}
                    {cards?.slice(0, 6).map((card, index) => {


                        return (
                            <div key={index} className="px-4 py-6">
                                {/* Card Heading */}
                                <div
                                    className=" overflow-visible"

                                >
                                    <div className="text-left" >
                                        <span className="text-[21.3px]  font-bold" style={{ color: 'var(--background-text,#9234EC)' }}>
                                            {card.heading}
                                        </span>
                                    </div>
                                </div>

                                {/* Card Description */}
                                <div
                                    className=" overflow-visible mt-2"

                                >
                                    <div className="text-left" >
                                        <span className="text-[23.1px] font-normal" style={{ color: 'var(--background-text,#000000)' }}>
                                            {card.description}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default dynamicSlideLayout;  