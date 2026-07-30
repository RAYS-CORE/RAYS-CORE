import * as z from 'zod'

export const Schema = z.object({
    title: z.string().max(20).describe('The main title of the slide').default('Timeline'),
    items: z.array(z.object({
        heading: z.string().max(10).describe('The heading or year for the timeline event'),
        description: z.string().max(150).describe('A brief description of the event')
    })).max(7).describe('A list of up to 7 timeline events').default([
        { heading: '2014', description: 'Business processes should have clear objectives, be as detailed as possible, and produce consistent results.' },
        { heading: '2014', description: 'Business processes should have clear objectives, be as detailed as possible, and produce consistent results.' },
        { heading: '2014', description: 'Business processes should have clear objectives, be as detailed as possible, and produce consistent results.' },
        { heading: '2014', description: 'Business processes should have clear objectives, be as detailed as possible, and produce consistent results.' },
        { heading: '2014', description: 'Business processes should have clear objectives, be as detailed as possible, and produce consistent results.' },
        { heading: '2014', description: 'Business processes should have clear objectives, be as detailed as possible, and produce consistent results.' },
        { heading: '2014', description: 'Business processes should have clear objectives, be as detailed as possible, and produce consistent results.' }
    ])
});

export const layoutId = 'title-horizontal-alternating-timeline';
export const layoutName = 'Title Horizontal Alternating Timeline';
export const layoutDescription = 'A horizontal timeline slide with alternating content boxes above and below a central axis line. Features a prominent title with up to 7 timeline events, each displaying a heading and description. The zigzag pattern creates visual interest while showing chronological progression.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, items } = data;

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
                {/* Title Section */}
                <div className="mt-12 mb-16">
                    <h1 className="text-[42.7px]  font-bold tracking-[-2px] text-center"
                        style={{ color: 'var(--background-text,#002BB2)' }}
                    >
                        {title}
                    </h1>
                </div>

                {/* Timeline Section */}
                <div className="relative w-full flex-grow px-20">
                    {/* Central Axis Line */}
                    <div
                        className="absolute left-0 right-0 h-[2.7px] bg-[#D9D9D9]"
                        style={{ top: '50%', transform: 'translateY(-50%)', backgroundColor: 'var(--background-text,#D9D9D9)' }}
                    />

                    {/* Timeline Items Container */}
                    <div className="relative flex justify-between h-full w-full">
                        {items?.map((item, index) => {
                            const isEven = index % 2 === 0;
                            return (
                                <div key={index} className="relative flex flex-col items-center" style={{ width: '264px' }}>
                                    {isEven ? (
                                        /* Top Content */
                                        <div className="absolute bottom-[50%] flex flex-col items-center w-full">
                                            {/* Content Box */}
                                            <div className="bg-[#F7F8FF]  p-4 rounded-md shadow-sm w-full min-h-[115px] flex flex-col justify-center items-center mb-6"
                                                style={{ backgroundColor: 'var(--card-color,#F7F8FF)' }}
                                            >
                                                <h2 className="text-[21.3px]  font-bold text-center mb-1"
                                                    style={{ color: 'var(--background-text,#002BB2)' }}
                                                >
                                                    {item.heading}
                                                </h2>
                                                <p className="text-[9.8px]  font-normal text-center leading-[1.4]"
                                                    style={{ color: 'var(--background-text,#002BB2)' }}
                                                >
                                                    {item.description}
                                                </p>
                                            </div>
                                            {/* Arrow/Connector */}
                                            <div className="relative h-[48px] w-[2.7px] bg-[#3E61DE]"
                                                style={{ backgroundColor: 'var(--primary-color,#3E61DE)' }}
                                            >
                                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                        <path d="M5 0L9.33 7.5H0.67L5 0Z" fill="#3E61DE"
                                                            style={{ fill: 'var(--primary-color,#3E61DE)' }}
                                                        />
                                                    </svg>
                                                </div>
                                            </div>
                                            {/* Marker Circle */}
                                            <div className="w-[11.7px] h-[11.7px] bg-[#002BB2] rounded-full translate-y-[5.8px]"
                                                style={{ backgroundColor: 'var(--background-text,#002BB2)' }}
                                            />
                                        </div>
                                    ) : (
                                        /* Bottom Content */
                                        <div className="absolute top-[50%] flex flex-col items-center w-full">
                                            {/* Marker Circle */}
                                            <div className="w-[11.7px] h-[11.7px] bg-[#002BB2] rounded-full -translate-y-[5.8px]"
                                                style={{ backgroundColor: 'var(--background-text,#002BB2)' }}
                                            />
                                            {/* Arrow/Connector */}
                                            <div className="relative h-[50px] w-[2.7px] bg-[#3E61DE]"
                                                style={{ backgroundColor: 'var(--primary-color,#3E61DE)' }}
                                            >
                                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-180">
                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                        <path d="M5 0L9.33 7.5H0.67L5 0Z" fill="#3E61DE"
                                                            style={{ fill: 'var(--primary-color,#3E61DE)' }}
                                                        />
                                                    </svg>
                                                </div>
                                            </div>
                                            {/* Content Box */}
                                            <div className="bg-[#F7F8FF] p-4 rounded-md shadow-sm w-full min-h-[115px] flex flex-col justify-center items-center mt-6"
                                                style={{ backgroundColor: 'var(--card-color,#F7F8FF)' }}
                                            >
                                                <h2 className="text-[21.3px]  font-bold text-center mb-1"
                                                    style={{ color: 'var(--background-text,#002BB2)' }}
                                                >
                                                    {item.heading}
                                                </h2>
                                                <p className="text-[9.8px]  font-normal text-center leading-[1.4]"
                                                    style={{ color: 'var(--background-text,#002BB2)' }}
                                                >
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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

