import * as z from 'zod'

export const Schema = z.object({
    title: z.string().max(12).describe("The main heading of the slide").default("TABLE"),
    description: z.string().max(250).describe("Supporting description text").default("Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies."),
    table: z.object({
        columns: z.array(z.string().max(15)).max(3).describe("Column headers for the table"),
        rows: z.array(z.array(z.string().max(60)).max(3)).max(3).describe("Data rows for the table")
    }).default({
        columns: ["Problem", "Description", "Solution"],
        rows: [
            ["Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos"],
            ["Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos"],
            ["Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos",],


        ]
    })
});

/**
 * Layout ID, Name and Description.
 */
export const layoutId = "title-description-table";
export const layoutName = "Title Description Table";
export const layoutDescription = "A slide featuring a bold title, description, and a clean 3-column table with color-highlighted headers. The header row provides visual hierarchy while rounded cell backgrounds maintain a modern appearance.";

/**
 * React Component for the slide layout.
 */
const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, table } = data;
    const { columns, rows } = table || {};

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col p-[72px]"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >
                {/* Header Section */}
                <div className="flex justify-between items-start mb-[45px]">
                    <div className="w-[30%]">
                        <h1 className="text-[42.7px]  font-bold leading-tight tracking-[-1.6px] uppercase"
                            style={{ color: 'var(--background-text,#002BB2)' }}
                        >
                            {title}
                        </h1>
                    </div>
                    <div className="w-[45%]">
                        <p className="text-[16px]  font-normal leading-[1.6]"
                            style={{ color: 'var(--background-text,#002BB2)' }}
                        >
                            {description}
                        </p>
                    </div>
                </div>

                {/* Table Section */}
                <div className="flex flex-col gap-[17px] w-full mx-auto"
                    style={{ width: columns?.length === 1 ? '60%' : '100%' }}

                >
                    {/* Table Header Row */}
                    <div
                        className="bg-[#1F4CD9] h-[64px] rounded-[4px] flex justify-between px-8 gap-[17px] items-center"
                        style={{
                            backgroundColor: 'var(--primary-color,#1F4CD9)',
                        }}
                    >
                        {columns?.map((column, index) => (
                            <div key={index} className="text-center w-full">
                                <span className="text-[21.4px]  font-bold"
                                    style={{ color: 'var(--primary-text,#FFFFFE)' }}
                                >
                                    {column}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Table Body Rows */}
                    <div className="flex flex-col gap-[17px]">
                        {rows?.map((row, rowIndex) => (
                            <div key={rowIndex} className="flex justify-between gap-[17px]">
                                {row.map((cell, cellIndex) => (
                                    <div
                                        key={cellIndex}
                                        className="bg-[#F7F8FF] w-full rounded-[12px] h-[105px] flex flex-col justify-center items-center px-6 text-center"
                                        style={{ backgroundColor: 'var(--card-color,#F7F8FF)' }}
                                    >
                                        {cell.split('\n').map((line, lineIndex) => (
                                            <span
                                                key={lineIndex}
                                                className="text-[20.3px]  font-normal leading-[1.4]"
                                                style={{ color: 'var(--background-text,#002BB2)' }}
                                            >
                                                {line}
                                            </span>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
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

