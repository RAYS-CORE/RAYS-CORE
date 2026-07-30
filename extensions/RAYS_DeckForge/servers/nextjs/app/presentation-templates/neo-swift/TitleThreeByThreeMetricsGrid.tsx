import * as z from 'zod';
export const Schema = z.object({
    title: z.string().max(40).describe('The main title of the slide').default('Comparision Snapshot'),
    items: z.array(z.object({
        label: z.string().max(12).describe('The small label at the top of the card'),
        value: z.string().max(10).describe('The large central value or metric'),
        detail: z.string().max(25).describe('A short description or challenge detail'),
        isHighlighted: z.boolean().describe('Whether the card should be highlighted').default(false),
    })).max(9).describe('A list of 1-9 comparison metrics').default([
        { label: 'Research', value: '8,450', detail: 'Main Challenge: Delayed Client', isHighlighted: false },
        { label: 'Research', value: '8,450', detail: 'Main Challenge: Delayed Client', isHighlighted: false },
        { label: 'Research', value: '8,450', detail: 'Main Challenge: Delayed Client', isHighlighted: false },
        { label: 'Research', value: '8,450', detail: 'Main Challenge: Delayed Client', isHighlighted: false },
        { label: 'Research', value: '8,450', detail: 'Main Challenge: Delayed Client', isHighlighted: true },
        { label: 'Research', value: '8,450', detail: 'Main Challenge: Delayed Client', isHighlighted: false },
        { label: 'Research', value: '8,450', detail: 'Main Challenge: Delayed Client', isHighlighted: false },
        { label: 'Research', value: '8,450', detail: 'Main Challenge: Delayed Client', isHighlighted: false },
        { label: 'Research', value: '8,450', detail: 'Main Challenge: Delayed Client', isHighlighted: false },
    ]),
});

export const layoutId = 'title-three-by-three-metrics-grid';
export const layoutName = 'Title 3x3 Metrics Comparison Grid';
export const layoutDescription = 'A comprehensive metrics slide featuring a main title and a responsive grid of metric cards (1-9 items) arranged in up to three columns with row dividers. Cards can be highlighted for emphasis. Each card displays a label, a prominent value, and a detail description. Ideal for comparing multiple KPIs, benchmark data, or performance metrics across categories.';

/**
 * Internal Card component for grid items.
 */
const Card = ({ item, isHighlighted, showDivider }: { item?: { label: string; value: string; detail: string; isHighlighted?: boolean }; isHighlighted?: boolean; showDivider?: boolean }) => {
    const highlighted = isHighlighted || item?.isHighlighted;
    return (
        <div style={{ width: '243px' }}>
            <div
                style={{
                    width: '100%',
                    padding: '24px 16px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: highlighted ? 'var(--card-color,#BEF4FE)' : 'transparent',
                    boxShadow: highlighted ? '0 0 0 1px var(--stroke,rgba(0,0,0,0.08))' : 'none',
                    borderRadius: highlighted ? '12px' : '0',
                    boxSizing: 'border-box',
                }}
            >
                <div style={{ fontFamily: 'Albert Sans', fontSize: '15.8px', color: 'var(--background-text,#000000)', marginBottom: '10px', lineHeight: '1.2' }}>
                    {item?.label}
                </div>
                <div style={{ fontFamily: 'Albert Sans', fontSize: '36.3px', color: 'var(--background-text,#000000)', marginBottom: '14px', lineHeight: '1' }}>
                    {item?.value}
                </div>
                <div style={{ fontFamily: 'Albert Sans', fontSize: '12.6px', color: 'var(--background-text,#4D5463)', textAlign: 'center', lineHeight: '1.4' }}>
                    {item?.detail}
                </div>
            </div>
            {/* Individual card divider */}
            {showDivider && (
                <div
                    style={{
                        width: '100%',
                        height: '1px',
                        backgroundColor: 'var(--stroke,#D3CFCF)',
                        marginBlock: '8px',
                    }}
                />
            )}
        </div>
    );
};

/**
 * Main Dynamic Slide Layout Component
 */
const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, items } = data;

    // Calculate grid dimensions based on item count
    const itemCount = items?.length || 0;
    const rows = Math.ceil(itemCount / 3);

    // Split items into rows
    const rowsArray: (typeof items)[] = [];
    for (let i = 0; i < rows; i++) {
        rowsArray.push(items?.slice(i * 3, (i + 1) * 3));
    }

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col font-['Albert_Sans'] "
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Albert Sans)',
                }}
            >
                {/* Slide Header */}
                <header className="flex justify-center mt-[41px] pb-[30px]">
                    <h1
                        style={{
                            fontFamily: 'Albert Sans',
                            fontSize: '42.7px',
                            fontWeight: 700,
                            color: 'var(--background-text,#000000)',
                            letterSpacing: '-1.6px',
                            lineHeight: '1.2',
                        }}
                    >
                        {title}
                    </h1>
                </header>

                {/* Comparison Grid */}
                <main className="flex flex-col justify-center items-center px-[72px] mb-5">
                    {rowsArray.map((rowItems, rowIndex) => (
                        <div key={rowIndex}>
                            {/* Row of cards */}
                            <div
                                className="flex justify-center items-center"
                                style={{ gap: '40px' }}
                            >
                                {rowItems?.map((item, colIndex) => (
                                    <Card
                                        key={colIndex}
                                        item={item}
                                        showDivider={true}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </main>
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

