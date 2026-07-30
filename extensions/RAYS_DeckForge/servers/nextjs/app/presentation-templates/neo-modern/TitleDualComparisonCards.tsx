/**
 * Zod Schema for the slide content.
 */
import * as z from 'zod'

export const Schema = z.object({
    mainTitle: z.string().max(30).describe("The main heading of the slide").default("Text Comparison"),
    comparisonSections: z.array(
        z.object({
            heading: z.string().max(20).describe("The title for the item"),
            description: z.string().max(200).describe("The detailed text description for the item"),
        })
    ).max(2).describe("A list of up to 2 items").default([
        {
            heading: "Problem",
            description: "Presentation are communication tools that can be used as demontrations, lectures, reports, and more. it is mostly presented before an audience."
        },
        {
            heading: "Solution",
            description: "Presentation are communication tools that can be used as demontrations, lectures, reports, and more. it is mostly presented before an audience."
        }
    ])
});

type DataType = z.infer<typeof Schema>;

export const layoutId = "title-dual-comparison-cards";
export const layoutName = "Title Dual Comparison Cards";
export const layoutDescription = "A comparison slide with a centered title and two equal-sized cards below. Each card contains a heading, decorative accent line, and detailed description. The symmetrical layout emphasizes balanced evaluation of two items.";

/**
 * Dynamic Slide Layout Component
 */
const dynamicSlideLayout: React.FC<{ data: Partial<DataType> }> = ({ data }) => {
    const { mainTitle, comparisonSections } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden flex flex-col items-center"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >
                {/* Header Section */}
                <div className="mt-[69px] w-full flex justify-center">
                    <h1
                        className="text-[42.7px]  text-[#002BB2] font-['Montserrat'] font-bold"
                        style={{ color: 'var(--background-text,#002BB2)' }}
                    >
                        {mainTitle}
                    </h1>
                </div>

                {/* Comparison Sections Container */}
                <div className="mt-[60px] flex gap-[36.5px] px-[108.5px] w-full justify-center">
                    {comparisonSections?.map((section, index) => (
                        <div
                            key={index}
                            className="flex flex-col p-[41.5px] w-[531.5px] h-[363.5px] bg-[#F7F8FF]"
                            style={{ borderRadius: '3.4px', backgroundColor: 'var(--card-color,#F7F8FF)', borderColor: 'var(--stroke,#F7F8FF)' }}
                        >
                            {/* Section Heading */}
                            <div className="mb-[6px]">
                                <h2
                                    className="text-[28.4px]  font-bold"
                                    style={{ fontFamily: 'Montserrat', letterSpacing: '-1.0px', color: 'var(--background-text,#002BB2)' }}
                                >
                                    {section?.heading}
                                </h2>
                            </div>

                            {/* Decorative Line */}
                            <div
                                className="w-[116.6px] h-[3.9px] bg-[#1F4CD9] mb-[20px]"
                                style={{ borderRadius: '2px', backgroundColor: 'var(--primary-color,#1F4CD9)' }}
                            />

                            {/* Section Description */}
                            <div className="w-[423.5px]">
                                <p
                                    className="text-[19.5px]  leading-[31.3px]"
                                    style={{ color: 'var(--background-text,#002BB2)' }}
                                >
                                    {section?.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
                {(data as any)?.__companyName__ || (data as any)?._logo_url__ && <div className="flex items-center gap-1 absolute top-5 left-5 z-40">
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

