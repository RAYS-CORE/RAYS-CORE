import * as z from "zod";


/**
 * Zod Schema for the slide content.
 */
export const Schema = z.object({
    title: z.string().max(20).describe('The main heading of the slide').default('Timeline'),
    milestones: z.array(z.object({
        year: z.string().max(4).describe('Time period or date label'),
        description: z.string().max(100).describe('Description text for the milestone'),
    })).min(2).max(6).describe('List of milestone items for the timeline').default([
        { year: '2017', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed facilisis lacinia dictum.' },
        { year: '2018', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed facilisis lacinia dictum.' },
        { year: '2019', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed facilisis lacinia dictum.' },
        { year: '2020', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed facilisis lacinia dictum.' },
        { year: '2021', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed facilisis lacinia dictum.' },
        { year: '2022', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed facilisis lacinia dictum.' },
        { year: '2023', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed facilisis lacinia dictum.' },
        { year: '2024', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed facilisis lacinia dictum.' },

    ]),
});

/**
 * Layout metadata.
 */
export const layoutId = 'timeline-alternating-cards-slide';
export const layoutName = 'Horizontal Timeline With Cards';
export const layoutDescription = 'A visual timeline layout featuring centered title, horizontal dashed axis line, and 2-6 milestone cards alternating above and below the axis. Each card shows a date label and description with colored accent dots.';

/**
 * React Component for the slide.
 */
const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, milestones } = data;

    const accentColors = ['#FF751F', '#FFBD59', '#FF914D', '#FF751F', '#FFBD59', '#FF914D'];

    // Dynamic positioning based on number of items
    const itemCount = milestones?.length || 0;
    const cardWidth = 216;
    const spacing = itemCount <= 3 ? 220 : itemCount <= 4 ? 180 : itemCount <= 5 ? 150 : 130;
    const totalWidth = (itemCount - 1) * spacing + cardWidth;
    const slideWidth = 1280;
    const startX = (slideWidth - totalWidth) / 2;

    // Generate config dynamically
    const config = milestones?.map((_, i) => {
        const isTop = i % 2 === 0;
        const boxX = startX + i * spacing;
        const dotCenterX = boxX + cardWidth / 2;

        return {
            boxX,
            boxY: isTop ? 235.6 : 452.9,
            yearX: boxX + 50,
            yearY: isTop ? 267.7 : 481.2,
            descX: boxX + 15,
            descY: isTop ? 292.6 : 506.1,
            dotX: dotCenterX - (isTop ? 23.7 : 10.9),
            dotY: isTop ? 389.4 : 403.1,
            type: isTop ? 'primary' : 'secondary',
            dotColor: accentColors[i % accentColors.length],
        };
    }) || [];

    // Generate white dots between items
    const whiteDots = config.slice(0, -1).map((item, i) => {
        const nextItem = config[i + 1];
        return (item.boxX + cardWidth / 2 + nextItem.boxX + cardWidth / 2) / 2 - 6.65;
    });

    // Calculate timeline line boundaries
    const lineStartX = config.length > 0 ? config[0].boxX + cardWidth / 2 - 50 : 62;
    const lineEndX = config.length > 0 ? config[config.length - 1].boxX + cardWidth / 2 + 50 : 1218;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden font-['Poppins']"

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

                {/* Title Section */}
                <div className="absolute left-[373.4px] top-[68.6px] w-[540px] h-[49.3px] text-center">
                    <h1 className="text-[42.7px]  font-bold tracking-[-1.6px] leading-[45.2px]" style={{ color: 'var(--background-text,#101828)' }}>
                        {title}
                    </h1>
                    <div className=" w-[116.6px] mx-auto h-[5.7px] overflow-visible mt-4"
                        style={{ backgroundColor: 'var(--primary-color,#9234EB)' }}
                    ></div>
                </div>

                {/* Central Axis Line */}
                <div className="absolute top-[413.1px] h-[2px]"
                    style={{ left: `${lineStartX}px`, width: `${lineEndX - lineStartX}px` }}
                >
                    <svg width="100%" height="100%" overflow="visible">
                        <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="var(--background-text,#000000)" strokeWidth="1" strokeDasharray="3,3" />
                    </svg>
                </div>

                {/* Timeline Elements Loop */}
                {milestones && milestones.map((m, i) => {
                    const item = config[i];
                    return (
                        <div key={i}>
                            {/* Card Background */}
                            <div
                                className="absolute rounded-[13.3px]"
                                style={{ left: item.boxX, top: item.boxY, width: '216px', height: '139.2px', backgroundColor: 'var(--card-color,#F0F0F2)' }}
                            />
                            {/* Year */}
                            <div
                                className="absolute text-center"
                                style={{ left: item.yearX, top: item.yearY, width: '115.3px', height: '21.2px' }}
                            >
                                <span className="text-[19.5px] font-normal" style={{ color: 'var(--background-text,#000000)' }}>{m.year}</span>
                            </div>
                            {/* Description */}
                            <div
                                className="absolute text-center leading-[17.8px]"
                                style={{ left: item.descX, top: item.descY, width: '186.1px', height: '51.5px' }}
                            >
                                <span className="text-[11.2px] font-normal" style={{ color: 'var(--background-text,#000000)' }}>{m.description}</span>
                            </div>
                            {/* Dot/Marker */}
                            {item.type === 'primary' ? (
                                <div
                                    className="absolute flex items-center justify-center rounded-full"
                                    style={{ left: item.dotX, top: item.dotY, width: '47.4px', height: '47.4px', border: '2px solid var(--background-text,#707070)' }}
                                />
                            ) : (
                                <div className="absolute rounded-full"
                                    style={{ left: item.dotX, top: item.dotY, width: '21.8px', height: '21.8px', backgroundColor: item.dotColor, borderColor: 'var(--background-text,#000000)' }}
                                />
                            )}
                        </div>
                    );
                })}

                {/* Decorative White Dots */}
                {whiteDots.map((x, i) => (
                    <div
                        key={`white-dot-${i}`}
                        className="absolute rounded-full border-[0.7px] bg-[#FFF7ED]"
                        style={{ left: x, top: '407.4px', width: '13.3px', height: '13.3px', borderColor: 'var(--background-text,#000000)' }}
                    />
                ))}
            </div>
        </>
    );
};


export default dynamicSlideLayout;