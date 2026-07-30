import * as z from "zod";
import React from "react";
export const Schema = z.object({
    title: z.string().max(30).describe('The main heading of the slide').default('Campaign Performance Snapshot'),

    cards: z.array(z.object({
        metric: z.string().describe('Primary value or statistic displayed').max(20),
        label: z.string().describe('Title or name of the card item').max(30),
        subtext: z.string().describe('Secondary text or additional data').max(30),
        isHighlighted: z.boolean().describe('Whether the card uses highlighted styling').default(false),
    })).max(8).min(3)
        .describe('Array of metric cards for the grid').default([
            { metric: '342 SQLs', label: 'Enterprise ABM Launch', subtext: '28% CONVERSION RATE', isHighlighted: false },
            { metric: '$1.8M pipeline', label: 'Product Feature Release', subtext: '4.7X ROAS', isHighlighted: false },
            { metric: '156 Deals', label: 'Industry Summit Sponsorship', subtext: '42% MEETING RATE', isHighlighted: true },
            { metric: '156 Deals', label: 'Industry Summit Sponsorship', subtext: '42% MEETING RATE', isHighlighted: false },
            { metric: '342 SQLs', label: 'Enterprise ABM Launch', subtext: '28% CONVERSION RATE', isHighlighted: false },
            { metric: '$1.8M pipeline', label: 'Product Feature Release', subtext: '4.7X ROAS', isHighlighted: false },
            // { metric: '156 Deals', label: 'Industry Summit Sponsorship', subtext: '42% MEETING RATE', isHighlighted: false },
            // { metric: '156 Deals', label: 'Industry Summit Sponsorship', subtext: '42% MEETING RATE', isHighlighted: false },
        ]),
});

type CardProps = {
    metric: string;
    label: string;
    subtext: string;
    isHighlighted?: boolean;


};

const Card: React.FC<CardProps> = ({ metric, label, subtext, isHighlighted }) => {


    const boxShadow = isHighlighted
        ? '0 0px 0px var(--background-text,#8600cd)'
        : 'none';
    const borderRadius = isHighlighted ? '16px' : '0px';

    return (
        <div
            style={{
                width: '282px',
                backgroundColor: isHighlighted ? 'var(--card-color,#9810FA)' : 'transparent',
                borderRadius,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                padding: isHighlighted ? '24px' : '10px',
                boxShadow,
                boxSizing: 'border-box',
                paddingBottom: "70px"

            }}
        >
            <div
                className="font-normal"
                style={{
                    fontSize: '29.5px',
                    color: isHighlighted ? 'var(--background-text,#FFFFFF)' : 'var(--background-text,#101828)',
                    lineHeight: '29.5px',
                    marginBottom: '15px',
                }}
            >
                {metric}
            </div>
            <div
                className=" font-normal"
                style={{
                    fontSize: '17.7px',
                    color: isHighlighted ? 'var(--background-text,#FFFFFF)' : 'var(--background-text,#101828)',
                    lineHeight: '20.4px',
                    marginBottom: '35px',
                    minHeight: '42px',
                }}
            >
                {label}
            </div>
            <div
                className=" font-normal"
                style={{
                    fontSize: '13.3px',
                    color: isHighlighted ? 'var(--background-text,#FFFFFF)' : 'var(--background-text,#101828)',
                    lineHeight: '18.6px',
                    textTransform: 'uppercase',
                }}
            >
                {subtext}
            </div>
        </div>
    );
};

export const layoutId = 'performance-grid-snapshot-slide';
export const layoutName = 'Metric Cards Grid';
export const layoutDescription = 'A centered layout with bold title and accent bar, followed by a 4x2 grid of up to 8 metric cards. Each card displays a value, label, and subtext. Cards can optionally be highlighted with colored background.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {


    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video    mx-auto overflow-hidden font-['Poppins'] flex flex-col items-center justify-center font-bold  px-[64px] py-[40px]"

                style={{
                    fontFamily: 'var(--heading-font-family,Poppins)',
                    background: "var(--background-color,#fefefd)"
                }}>


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
                {/* Title Section */}
                <div
                    className=" text-center"

                >
                    <h1 className="text-center" style={{
                        fontSize: '42.7px',
                        color: 'var(--background-text,#101828)',
                        lineHeight: '56.5px',
                        letterSpacing: '-2.0px',

                    }}>

                        {data.title}
                    </h1>
                    <div
                        className=" w-[116.6px] h-[5.7px] mx-auto mt-4"
                        style={{ backgroundColor: 'var(--primary-color,#9234EB)' }}
                    />
                </div>



                <div className=" w-full  mt-14 flex flex-wrap justify-center gap-x-2 gap-y-12">

                    {data && data.cards && data.cards.map((card, index) =>

                        <Card
                            key={index}
                            metric={card.metric || ''}
                            label={card.label || ''}
                            subtext={card.subtext || ''}
                            isHighlighted={card.isHighlighted || false}

                        />

                    )
                    }


                </div>
            </div>
        </>
    );
};
export default dynamicSlideLayout;