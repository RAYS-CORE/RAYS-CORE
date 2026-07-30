import * as z from 'zod';

export const Schema = z.object({
    title: z.string().max(10).describe("The main title of the slide").default("TABLE"),
    description: z.string().max(250).describe("The descriptive paragraph at the top right of the slide").default("Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies."),
    table: z.object({
        columns: z.array(z.string().max(15)).max(3).describe("The headers for the table columns"),
        rows: z.array(z.array(z.string().max(80)).max(3)).max(3).describe("The data rows for the table, each containing multiple lines of text")
    }).default({
        columns: ["Problem", "Description", "Solution"],
        rows: [
            [
                "Self-motivation\nReference: Book and Inspirational Videos",
                "Self-motivation\nReference: Book and Inspirational Videos",
                "Self-motivation\nReference: Book and Inspirational Videos",

            ],
            [
                "Self-motivation\nReference: Book and Inspirational Videos",
                "Self-motivation\nReference: Book and Inspirational Videos",
                "Self-motivation\nReference: Book and Inspirational Videos",
            ],
            [
                "Self-motivation\nReference: Book and Inspirational Videos",

            ],
            ["Self-motivation\nReference: Book and Inspirational Videos",

            ]
        ]
    })
});

export const layoutId = "title-description-table";
export const layoutName = "Title Description Table";
export const layoutDescription = "A slide featuring a title and description at the top, followed by a 3-column table with color-highlighted headers, ideal for comparisons, matrices, or structured data.";

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, table } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col justify-center p-[72px] pt-[65px]"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Playfair Display)',
                }}
            >
                {/* Header Section */}
                <div className="flex justify-between items-start gap-10 mb-[40px]">
                    <div className="">
                        <h1
                            className="text-[42.7px] text-foreground  font-bold leading-none uppercase"
                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {title}
                        </h1>
                    </div>
                    <div className="max-w-[510px]">
                        <p
                            style={{ fontFamily: 'Playfair Display', color: 'var(--background-text,#000000)' }}
                            className="text-[16px] text-foreground leading-[1.6]"
                        >
                            {description}
                        </p>
                    </div>
                </div>

                {/* Table Section */}
                <div className="w-full mx-auto mt-4"

                    style={{
                        width: table?.columns?.length === 1 ? '60%' : '100%'
                    }}
                >
                    {/* Header Row */}
                    <div
                        className="grid bg-[#1F8A2E] rounded-t-sm"
                        style={{
                            backgroundColor: 'var(--primary-color,#1F8A2E)',
                            gridTemplateColumns: `repeat(${table?.columns?.length || 1}, 1fr)`
                        }}
                    >
                        {table?.columns?.map((column, index) => (
                            <div
                                key={index}
                                style={{ color: 'var(--primary-text,#FFFFFF)' }}
                                className="py-[18px] text-[21.4px] font-bold text-[#FFFFFE] text-center"
                            >
                                {column}
                            </div>
                        ))}
                    </div>
                    {/* Body Rows */}
                    <div className="w-full">
                        {table?.rows?.map((row, rowIndex) => (
                            <div
                                key={rowIndex}
                                className="grid border-b items-center border-[#EBEBEB] last:border-0 py-2"
                                style={{
                                    borderColor: 'var(--stroke,#EBEBEB)',
                                    gridTemplateColumns: `repeat(${table?.columns?.length || 1}, 1fr)`
                                }}
                            >
                                {row.map((cell, cellIndex) => (
                                    <div
                                        key={cellIndex}
                                        className="text-[20.3px] py-1 px-2 text-foreground text-center whitespace-pre-line leading-[1.4]"
                                        style={{ color: 'var(--background-text,#000000)' }}
                                    >
                                        {cell}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                {((data as any)?.__companyName__ || (data as any)?._logo_url__) && <div className="flex items-center gap-1 absolute bottom-5 left-5 z-40">
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

