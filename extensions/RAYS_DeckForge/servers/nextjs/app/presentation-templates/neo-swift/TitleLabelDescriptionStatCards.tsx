import { z } from "zod";

export const Schema = z.object({
    title: z.string().max(17).describe("The main heading of the slide").default("Executive Summary"),
    label: z.string().max(5).describe("A short subtitle or category label").default("Leads"),
    description: z.string().max(205).describe("The primary body text explaining the summary").default("Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies."),
    stats: z.array(z.object({
        value: z.string().max(4).describe("The numerical or percentage value"),
        heading: z.string().max(21).describe("The title of the statistic"),
        content: z.string().max(45).describe("The descriptive text for the statistic")
    })).max(3).describe("A list of 3 statistics cards").default([
        { value: "10K", heading: "USERS", content: "Active users across multiple industries" },
        { value: "90%", heading: "REVENUE GROWTH", content: "Year-over-year revenue growth" },
        { value: "150%", heading: "CUSTOMER SATISFACTION", content: "Retention rate with an average rating of 4.8/5" }
    ]),
});

type DataType = z.infer<typeof Schema>;

export const layoutId = "title-label-description-cascading-stats";
export const layoutName = "Title Label Description Cascading Stats";
export const layoutDescription = "An executive summary slide featuring a bold title and descriptive paragraph on the left, paired with three cascading statistic cards on the right. The cards progressively decrease in width, creating a visually dynamic layout. Ideal for presenting key metrics, achievements, or highlights alongside context-setting narrative text.";

const dynamicSlideLayout: React.FC<{ data: Partial<DataType> }> = ({ data }) => {
    const { title, label, description, stats } = data;

    const cardWidths = ["w-[572px]", "w-[513px]", "w-[441px]"];

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col "

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Albert Sans)',
                }}
            >

                {/* Body Content */}
                <div className="flex flex-row flex-1 px-[72px]">

                    {/* Left Section: Title, Label, Description */}
                    <div className="flex flex-col basis-1/2 pt-[110px]">
                        {/* Decorative small diamond */}
                        <div className="mb-[15px] -ml-[7px]">
                            <svg width="17.6" height="17.6" viewBox="0 0 17.6 17.6">
                                <path d="M 8.8 0.0 L 17.6 8.8 L 8.8 17.6 L 0.0 8.8 L 8.8 0.0 Z" fill="#4D5463" style={{ fill: 'var(--background-color,#4D5463)' }} />
                            </svg>
                        </div>

                        <div className="mb-[40px]">
                            <h1 className="text-[42.7px]  font-bold leading-[43.9px] tracking-[-1.6px]"

                                style={{ color: 'var(--background-text,#000000)' }}
                            >
                                {title}
                            </h1>
                        </div>

                        {/* Subtitle Label with Dot */}
                        <div className="flex items-center gap-[10px] mb-[28px]">
                            <div className="w-[15.8px] h-[15.8px] bg-black rounded-full shrink-0" style={{ backgroundColor: 'var(--background-text,#000000)' }} />
                            <span className="text-[17.4px] "

                                style={{ color: 'var(--background-text,#4D5463)' }}
                            >
                                {label}
                            </span>
                        </div>

                        {/* Description Paragraph */}
                        <p className="text-[16px]  leading-[28.5px] max-w-[435px]"

                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {description}
                        </p>
                    </div>

                    {/* Right Section: Cascading Data Cards */}
                    <div className="flex flex-col gap-[12px] pt-[110px]">
                        {stats?.map((stat, index) => (
                            <div
                                key={index}
                                className={`${cardWidths[index % cardWidths.length]} h-[94px] bg-[#BEF4FE] rounded-[7px] flex items-center px-[38px]`}

                                style={{
                                    backgroundColor: 'var(--primary-color,#BEF4FE)',
                                    borderColor: 'var(--stroke,#EBEBEB)',
                                }}
                            >
                                {/* Stat Value */}
                                <div className="w-[110px] shrink-0">
                                    <span className="text-[22.5px]  font-bold"

                                        style={{ color: 'var(--primary-text,#000000)' }}
                                    >
                                        {stat?.value}
                                    </span>
                                </div>

                                {/* Stat Labels */}
                                <div className="flex flex-col justify-center">
                                    <span className="text-[10.7px]  font-bold uppercase tracking-wider mb-[2px]"

                                        style={{ color: 'var(--primary-text,#000000)' }}
                                    >
                                        {stat?.heading}
                                    </span>
                                    <p className="text-[18px]  leading-[1.2]"

                                        style={{ color: 'var(--primary-text,#55626E)' }}
                                    >
                                        {stat?.content}
                                    </p>
                                </div>
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

