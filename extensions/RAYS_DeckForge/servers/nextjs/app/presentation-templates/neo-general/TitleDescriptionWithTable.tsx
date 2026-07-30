
// Zod Schema for the content elements
import * as z from "zod";
import React from "react";



export const Schema = z.object({
    title: z.string().max(50).describe('The main heading of the slide').default('Go-to-Market Strategy'),
    description: z.string().max(400).describe('Supporting description text for the slide').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    sections: z.array(z.object({
        heading: z.string().max(15).describe('Heading for the column section'),
        bulletPoints: z.array(z.object({
            title: z.string().max(10).describe('Title label for the bullet point'),
            description: z.string().max(20).describe('Description text for the bullet point'),
        })).max(5).describe('List of bullet points in the section')
    })).max(3).describe('Column sections containing bullet points').default([
        {
            heading: 'Paid Channels',
            bulletPoints: [
                { title: 'LinkedIn Ads:', description: ' ABM Retargeting' },
                { title: 'Google Ads:', description: ' Intent Capture' },
                { title: 'Display:', description: ' Brand Awareness' }
            ]
        },
        {
            heading: 'Organic Channels',
            bulletPoints: [
                { title: 'SEO:', description: ' Thought Leadership' },
                { title: 'Content:', description: ' Education' },
                { title: 'Social:', description: ' Community' }
            ]
        },
        {
            heading: 'Partnerships',
            bulletPoints: [
                { title: 'Events:', description: ' Network Building' },
                { title: 'Co-Marketing:', description: ' Reach Extension' },
                { title: 'Referrals:', description: ' Trust Building' },
                { title: 'Referrals:', description: ' Trust Building' },
                { title: 'Referrals:', description: ' Trust Building' },
                { title: 'Referrals:', description: ' Trust Building' },
            ]
        }
    ])
});

export const layoutId = 'title-description-three-columns-table';
export const layoutName = 'Title Description With Three Column Table';
export const layoutDescription = 'A layout featuring split title and description at the top, followed by a three-column table with colored headers and vertical bullet point sections below each.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, sections } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col px-[60px] py-[60px] font-['Poppins']"

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

                <div className="flex justify-between items-start mb-[100px] w-full">
                    <div className="flex flex-col basis-1/2">
                        <h1 className="text-[42.7px]  font-bold leading-[1.05] tracking-[-2.0px]" style={{ color: 'var(--background-text,#101828)' }}>
                            {title}
                        </h1>
                        <div className="w-[116.6px] h-[5.7px] mt-4" style={{ backgroundColor: 'var(--primary-color,#9234EB)' }} />
                    </div>
                    <div className="basis-1/2 flex justify-end">
                        <p className="max-w-[510px] text-[16px] font-normal leading-[1.6] text-left" style={{ color: 'var(--background-text,#000000)' }}>
                            {description}
                        </p>
                    </div>
                </div>


                <div className="w-full flex flex-col mx-auto"
                    style={{ width: sections?.length === 1 ? '60%' : '100%' }}
                >

                    <div className="grid  rounded-t-[28px]" style={{ backgroundColor: 'var(--primary-color,#9234EC)', gridTemplateColumns: `repeat(${sections?.length ?? 0}, minmax(0, 1fr))` }}>
                        {sections?.map((section, idx) => (
                            <div
                                key={`header-${idx}`}
                                className={`py-[20px] px-[15px]  flex items-center justify-center ${idx !== sections.length - 1 ? 'border-r-[1.3px] ' : ''}`}
                                style={{ borderColor: 'var(--stroke,#9134EB)' }}
                            >
                                <h2 className="text-[21.3px]  font-bold text-center" style={{ color: 'var(--primary-text,#FFFFFF)' }}>
                                    {section?.heading}
                                </h2>
                            </div>
                        ))}
                    </div>


                    <div className="grid  w-full items-center "
                        style={{ gridTemplateColumns: `repeat(${sections?.length ?? 0}, minmax(0, 1fr))` }}
                    >
                        {sections?.map((section, colIdx) => (
                            <div
                                key={`col-${colIdx}`}
                                className={`flex flex-col pt-[20px] pb-[30px] px-[15px] gap-y-[25px] ${colIdx !== sections.length - 1 ? 'border-r-[1.3px]' : ''}`}

                                style={{ backgroundColor: 'var(--card-color,#FCFCFC)', borderColor: 'var(--stroke,#F8F9FA)' }}
                            >
                                {section?.bulletPoints?.map((point, pointIdx) => (
                                    <div key={`point-${colIdx}-${pointIdx}`} className="text-center min-h-[1.2em]">
                                        <span className="text-[18.7px]  font-bold" style={{ color: 'var(--background-text,#000000)' }}>
                                            {point?.title}
                                        </span>
                                        <span className="text-[18.7px] font-normal" style={{ color: 'var(--background-text,#000000)' }}>
                                            {point?.description}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>


                <div className="absolute right-[320px] bottom-[362px] w-[15.8px] h-[15.8px] rounded-full opacity-10" style={{ backgroundColor: 'var(--primary-color,#9134EB)' }} />
            </div>
        </>
    );
};

export default dynamicSlideLayout;