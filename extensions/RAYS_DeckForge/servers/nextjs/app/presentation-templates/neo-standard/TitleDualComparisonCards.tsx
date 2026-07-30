import * as z from 'zod';

export const Schema = z.object({
    title: z.string().describe('The main title of the slide').default('Text Comparison'),
    comparisonSections: z.array(z.object({
        number: z.string().describe('The numeric index or step number').max(2),
        heading: z.string().describe('The heading or title of the section').max(15),
        description: z.string().describe('The detailed text content of the section').max(200),
    })).max(2).default([
        {
            number: '1',
            heading: 'Problem',
            description: 'Presentation are communication tools that can be used as demontrations, lectures, reports, and more. it is mostly presented before an audience.'
        },
        {
            number: '2',
            heading: 'Solution',
            description: 'Presentation are communication tools that can be used as demontrations, lectures, reports, and more. it is mostly presented before an audience.'
        }
    ])
});

export const layoutId = 'title-dual-comparison-cards';
export const layoutName = 'Title Dual Comparison Cards';
export const layoutDescription = 'A comparison slide with a centered title and two side-by-side cards featuring numbered headings and descriptions, ideal for problem/solution or before/after comparisons.';

const SectionCard = ({
    number,
    heading,
    description,
    isAlternativeBg
}: {
    number?: string;
    heading?: string;
    description?: string;
    isAlternativeBg?: boolean;
}) => (
    <div
        className={`relative flex-1 flex flex-col p-[60px] max-w-[520px] h-[441px] rounded-lg overflow-hidden`}
        style={{ borderColor: 'var(--stroke,#EBEBEB)', backgroundColor: isAlternativeBg ? 'var(--card-color,#F0F0F2)' : 'var(--background-color,#FFFFFF)' }}
    >


        <div className="relative z-10 flex flex-col h-full">
            {/* Number Circle */}
            <div className="flex items-center justify-center w-[53.7px] h-[53.1px] rounded-full border-[1.5px] border-[#1F8A2E] bg-card mb-8"

                style={{ borderColor: 'var(--stroke,#1F8A2E)', backgroundColor: 'var(--primary-color,#FFFFFF)' }}
            >
                <span className="text-[20.6px] text-foreground "
                    style={{ color: 'var(--primary-text,#000000)' }}
                >
                    {number}
                </span>
            </div>

            {/* Heading */}
            <div className="mb-2">
                <h2 className="text-[28.4px] text-foreground  font-bold tracking-[-1.0px]"
                    style={{ color: 'var(--background-text,#000000)' }}
                >
                    {heading}
                </h2>
            </div>

            {/* Underline */}
            <div className="w-[116.6px] h-[3.9px] bg-[#1F8A2E] rounded-full mb-8"
                style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
            />

            {/* Description */}
            <p className="text-[19.5px] leading-[31.3px] text-foreground "
                style={{ color: 'var(--background-text,#000000)' }}
            >
                {description}
            </p>
        </div>
    </div>
);

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, comparisonSections } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col items-center pt-[46px] px-[107px] pb-[107px]"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Playfair Display)',
                }}
            >
                {/* Decorative top green line */}
                <div className="w-[116.6px] h-[3.3px] bg-[#1F8A2E] mb-[18px]"

                    style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                />

                {/* Main Title */}
                <div className="mb-[56px] w-full text-center">
                    <h1 className="text-[42.7px] text-foreground  font-bold tracking-[-1.6px]"
                        style={{ color: 'var(--background-text,#000000)' }}
                    >
                        {title}
                    </h1>
                </div>

                {/* Comparison Cards Container */}
                <div className="flex w-full gap-[35.4px] items-center justify-center">
                    {comparisonSections?.map((section, index) => (
                        <SectionCard
                            key={index}
                            number={section.number}
                            heading={section.heading}
                            description={section.description}
                            isAlternativeBg={index === 1}
                        />
                    ))}
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

