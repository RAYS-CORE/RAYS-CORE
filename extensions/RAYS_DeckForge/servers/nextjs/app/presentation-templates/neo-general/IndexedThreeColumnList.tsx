import * as z from "zod";
import React from "react";


export const Schema = z.object({
    title: z.string().max(30).describe('The main heading of the slide').default('Target Audience Breakdown'),
    columns: z.array(z.object({
        index: z.string().max(2).describe('Display number or index for the column').default('01'),
        heading: z.string().max(20).describe('Primary heading of the column').default('C-Suite Executives'),
        labelOne: z.string().max(12).describe('Label for the first content block').default('KEY NEED'),
        contentOne: z.string().max(50).describe('Content for the first block').default('Strategic growth & competitive advantage'),
        labelTwo: z.string().max(12).describe('Label for the second content block').default('PRIMARY CHANNEL'),
        contentTwo: z.string().max(50).describe('Content for the second block').default('LinkedIn, executive events'),
    })).max(3).describe('Array of columns with indexed content').default([
        {
            index: '01',
            heading: 'C-Suite Executives',
            labelOne: 'KEY NEED',
            contentOne: 'Strategic growth & competitive advantage',
            labelTwo: 'PRIMARY CHANNEL',
            contentTwo: 'LinkedIn, executive events',
        },
        {
            index: '02',
            heading: 'VP of Operations',
            labelOne: 'KEY NEED',
            contentOne: 'Efficiency & cost optimization',
            labelTwo: 'PRIMARY CHANNEL',
            contentTwo: 'Industry publications, webinars',
        },
        {
            index: '03',
            heading: 'Technical Leaders',
            labelOne: 'KEY NEED',
            contentOne: 'Integration capabilities & security',
            labelTwo: 'PRIMARY CHANNEL',
            contentTwo: 'Technical content, product demos',
        },
    ]),
});

type DataType = z.infer<typeof Schema>;

export const layoutId = 'title-three-columns-with-labels';
export const layoutName = 'Three Columns With Index Numbers';
export const layoutDescription = 'A layout featuring bold title with accent bar, followed by three indexed columns each containing large index number, heading, and two labeled content sections.';

const dynamicSlideLayout: React.FC<{ data: Partial<DataType> }> = ({ data }) => {
    const { title, columns } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden flex flex-col p-[60px] pl-[72px] pr-[72px] "

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
                <div className="flex flex-col mb-[50px]">
                    <h1 className="text-[42.7px]  font-bold leading-[1.05] tracking-[-2.0px]  mb-4"

                        style={{
                            color: 'var(--background-text,#101828)'
                        }}
                    >
                        {title}
                    </h1>
                    <div className="w-[116.6px] h-[5.7px]"

                        style={{
                            backgroundColor: 'var(--primary-color,#9234EB)'
                        }}
                    />
                </div>

                <div className="flex flex-row justify-between items-start gap-[80px] flex-1">
                    {columns?.map((column, index) => (
                        <div key={index} className="flex-1 flex flex-col">
                            <div className="text-[85.3px] font-normal leading-none mb-[12px]"

                                style={{
                                    color: 'var(--background-text,#9134EB)'
                                }}
                            >
                                {column?.index}
                            </div>
                            <div className="text-[28.4px] font-normal leading-tight mb-[5px] min-h-[70px]"

                                style={{
                                    color: 'var(--background-text,#000000)'
                                }}
                            >
                                {column?.heading}
                            </div>

                            <div className="flex flex-col gap-8">
                                <div className="flex flex-col gap-[6px]">
                                    <div className="text-[21.3px] font-normal uppercase tracking-[1px]"

                                        style={{
                                            color: 'var(--background-text,#737373)'
                                        }}
                                    >
                                        {column?.labelOne}
                                    </div>
                                    <div className="text-[23.1px] font-normal leading-[1.4]"

                                        style={{
                                            color: 'var(--background-text,#000000)'
                                        }}
                                    >
                                        {column?.contentOne}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-[6px]">
                                    <div className="text-[21.3px] font-normal uppercase tracking-[1px]"

                                        style={{
                                            color: 'var(--background-text,#737373)'
                                        }}
                                    >
                                        {column?.labelTwo}
                                    </div>
                                    <div className="text-[23.1px] font-normal leading-[1.4]"

                                        style={{
                                            color: 'var(--background-text,#000000)'
                                        }}
                                    >
                                        {column?.contentTwo}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default dynamicSlideLayout;