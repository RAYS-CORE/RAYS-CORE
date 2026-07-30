import * as z from 'zod';
import React from 'react';


export const Schema = z.object({
    title: z.string().max(12).describe("The main title of the slide displayed at the top left").default("TABLE"),
    description: z.string().max(180).describe("The overview description paragraph displayed at the top right").default("Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies."),
    table: z.object({
        columns: z.array(z.string().max(15)).max(3).describe("The headers for the table columns"),
        rows: z.array(z.array(z.string().max(60)).max(3)).max(3).describe("The data rows for the table with max 3 cells per row"),
    }).describe("The main table content with headings and cell data").default({
        columns: ["Problem", "Description", "Solution"],
        rows: [
            ["Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos"],
            ["Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos"],
            ["Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos", "Self-motivation\nReference: Book and Inspirational Videos"],

        ],
    }),
});
export const layoutId = "title-description-three-column-table";
export const layoutName = "Title Description Three Column Table";
export const layoutDescription = "A structured data presentation slide featuring a large header title on the left and a descriptive paragraph on the right, followed by a three-column table with a colored header row. Each table cell supports multi-line text. Ideal for presenting structured comparisons, problem-solution matrices, feature breakdowns, or any tabular data that benefits from visual organization.";

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, table } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full h-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden font-['Albert_Sans']"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Albert Sans)',
                }}
            >
                {/* Slide Layout Container */}
                <div className="flex flex-col h-full px-[72px] pt-[65px] pb-[40px]">

                    {/* Header Section */}
                    <div className="flex justify-between items-start mb-[40px]">
                        <h1 className="text-[42.7px] text-foreground  font-bold leading-none uppercase tracking-[-1.6px]"

                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {title}
                        </h1>
                        <p className="text-[16px] text-foreground leading-[1.6] max-w-[510px] text-left"

                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {description}
                        </p>
                    </div>

                    {/* Table Section */}
                    <div className=" mx-auto"
                        style={{ width: table?.columns?.length === 1 ? '60%' : '100%' }}
                    >
                        <div className="rounded-[4px] overflow-hidden bg-[#EDFAFD]"

                            style={{ backgroundColor: 'var(--card-color,#EDFAFD)' }}
                        >
                            {/* Header Row */}
                            <div
                                className="grid bg-[#BEF4FE] h-[63.5px] items-center"
                                style={{
                                    backgroundColor: 'var(--primary-color,#BEF4FE)',
                                    gridTemplateColumns: `repeat(${table?.columns?.length || 1}, 1fr)`
                                }}
                            >
                                {table?.columns?.map((column, index) => (
                                    <div
                                        key={index}
                                        className="px-6 text-[21.4px] text-foreground font-normal text-center"
                                        style={{ color: 'var(--primary-text,#000000)' }}
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
                                        className={`grid h-[110px] items-center ${rowIndex < (table?.rows?.length ?? 0) - 1 ? 'border-b-[2.7px] border-[#EBEBEB]' : ''}`}
                                        style={{
                                            borderColor: 'var(--stroke,#EBEBEB)',
                                            gridTemplateColumns: `repeat(${table?.columns?.length || 1}, 1fr)`
                                        }}
                                    >
                                        {row.map((cell, cellIndex) => (
                                            <div
                                                key={cellIndex}
                                                className="px-6 text-[20.3px] text-foreground text-center whitespace-pre-line leading-[1.4]"
                                                style={{ color: 'var(--background-text,#000000)' }}
                                            >
                                                {cell}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                            {/* Bottom line for the table container if there are rows */}
                            {(table?.rows?.length ?? 0) > 0 && (
                                <div className="h-[2.7px] w-full bg-[#EBEBEB]"

                                    style={{ backgroundColor: 'var(--stroke,#EBEBEB)' }}
                                />
                            )}
                        </div>
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

