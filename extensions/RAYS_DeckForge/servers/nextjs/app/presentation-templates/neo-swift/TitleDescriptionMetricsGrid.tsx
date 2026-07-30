import * as z from 'zod';

export const Schema = z.object({
    title: z.string().describe("The main heading of the slide").default("Executive Summary"),
    description: z.string().describe("A brief summary or descriptive paragraph").default("Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies."),
    metrics: z.array(z.object({
        label: z.string().describe("The label for the metric").max(20),
        value: z.string().describe("The primary numerical or text value").max(15),
        description: z.string().describe("A supporting detail or challenge description").max(50),
    })).max(8).describe("A list of up to 8 cards showing key metrics").default(Array(8).fill({
        label: "Research",
        value: "8,450",
        description: "Main Challenge: Delayed Client"
    })),
});

export const layoutId = "title-description-eight-metrics-grid";
export const layoutName = "Title Description Eight Metrics Grid";
export const layoutDescription = "A data-centric slide with a centered title and description at the top, followed by a 4x2 grid of metric cards. Each card displays a label, a prominent value, and a supporting description. Ideal for presenting KPIs, dashboards, performance snapshots, or comparative statistics in a clean, scannable format.";

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, metrics } = data;


    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col font-['Albert_Sans']"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Albert Sans)',
                }}
            >
                {/* Header Section */}
                <div className="pt-16 px-20 flex flex-col items-center">
                    <div className="flex items-center gap-4 mb-4">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M9 0L18 9L9 18L0 9L9 0Z" fill="#4D5463" style={{ fill: 'var(--background-color,#4D5463)' }} />
                        </svg>
                        <h1 className="text-[42.7px] text-[#101828]  font-bold leading-tight tracking-[-1.6px]"

                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {title}
                        </h1>
                    </div>
                    <p className="text-[16px] text-foreground text-center max-w-[850px] leading-[1.8]"

                        style={{ color: 'var(--background-text,#000000)' }}
                    >
                        {description}
                    </p>
                </div>

                {/* Grid Section */}
                <div className="flex-grow flex items-center justify-center px-16">
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-4 w-full">
                        {metrics?.map((item, index) => (
                            <div
                                key={index}
                                className="bg-[#BEF4FE] w-[259.3px] border-[0.7px] border-[#EBEBEB] rounded-[10.5px] p-6 flex flex-col items-center justify-center min-h-[144px]"

                                style={{
                                    backgroundColor: 'var(--primary-color,#BEF4FE)',
                                    borderColor: 'var(--stroke,#EBEBEB)',
                                }}
                            >
                                <span className="text-[15.8px] text-foreground mb-1" style={{ color: 'var(--primary-text,#000000)' }}>{item.label}</span>
                                <span className="text-[36.3px] text-foreground mb-3" style={{ color: 'var(--primary-text,#000000)' }}>{item.value}</span>
                                <span className="text-[12.6px] text-[#4D5463] text-center leading-tight" style={{ color: 'var(--primary-text,#4D5463)' }}>
                                    {item.description}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Section */}
                <div className="flex items-center px-[72px] w-full absolute bottom-4 ">
                    {((data as any)?.__companyName__ || (data as any)?._logo_url__) && <div className="flex items-center gap-1 mr-1">
                        {(data as any)?._logo_url__ && <img src={(data as any)?._logo_url__} alt="logo" className="w-[60px] object-contain" />}
                        <span
                            style={{ backgroundColor: 'var(--stroke, #F0F0F0)' }}
                            className=' w-[2px] h-4'></span>
                        {(data as any)?.__companyName__ && <span className="text-sm  font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                            {(data as any)?.__companyName__ || 'Company Name'}
                        </span>}
                    </div>}
                    <div className="flex-1 h-[3.6px] bg-[#55626E]"

                        style={{ backgroundColor: 'var(--background-text,#55626E)' }}
                    />
                    <div className="relative ml-[-4px] w-[58px] h-[58px] flex items-center justify-center">
                        <div className="w-[41px] h-[41px] bg-[#4D5463] rotate-45"

                            style={{ backgroundColor: 'var(--background-text,#4D5463)' }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};
export default dynamicSlideLayout;

