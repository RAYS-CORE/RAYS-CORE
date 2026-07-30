/**
 * Zod Schema for the slide content
 */
import * as z from 'zod';

export const Schema = z.object({
    title: z.string().max(40).describe('The main heading of the slide').default('Image with Description & Metrix'),
    description: z.string().max(150).describe('The secondary description text below the title').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M .'),
    metrics: z.array(z.object({
        value: z.string().max(5).describe('The percentage or numeric value of the metric'),
        label: z.string().max(40).describe('The description label for the metric')
    })).max(4).describe('A list of up to 4 metric cards').default([
        { value: '85%', label: 'Main Challenge: Delayed Client' },
        { value: '85%', label: 'Main Challenge: Delayed Client' },
        { value: '85%', label: 'Main Challenge: Delayed Client' },
        { value: '85%', label: 'Main Challenge: Delayed Client' },
    ]),
    mainImage: z.object({
        __image_url__: z.string(),
        __image_prompt__: z.string().max(100),
    }).describe('The large image featured on the right side of the slide').default({
        __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
        __image_prompt__: 'A professional business setting showing collaboration or success.',
    }),
});

export const layoutId = 'title-metrics-image';
export const layoutName = 'Title Metrics Image';
export const layoutDescription = 'A slide featuring a title, description, and a 2x2 grid of metric cards on the left, with a large image on the right.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, metrics, mainImage } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full h-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden font-['Open_Sans_Regular']"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Open Sans)',
                }}

            >

                <div className="flex flex-row w-full h-full p-[40px] items-center">
                    {/* Left Column */}
                    <div className="flex flex-col w-[55%] pr-8">
                        {/* Decorative Green Line */}
                        <div className="w-[116.6px] h-[3.3px] bg-[#1F8A2E] mb-[24px]"

                            style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                        />
                        <h1
                            className="text-[42.7px] text-[#000000]  font-bold leading-[1.1] mb-[15px] tracking-[-1.6px]"
                            style={{ whiteSpace: 'pre-line', color: 'var(--background-text,#000000)' }}
                        >
                            {title}
                        </h1>

                        {/* Description */}
                        <p className="text-[16px] text-[#000000]  leading-[1.6] mb-[35px] max-w-[510px]"

                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {description}
                        </p>


                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-x-[20px] gap-y-[15px] w-full">
                            {metrics?.map((metric, idx) => (
                                <div
                                    key={idx}
                                    className="bg-[#1F8A2E] rounded-[7px] h-[152.8px] flex flex-col justify-center items-center text-foreground px-4"

                                    style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                                >
                                    <span className="text-[39.3px] font-bold  leading-none mb-2"
                                        style={{ color: 'var(--primary-text,#FFFFFF)' }}
                                    >
                                        {metric.value}
                                    </span>
                                    <span className="text-[17.8px]  text-center leading-[1.4]"
                                        style={{ color: 'var(--primary-text,#FFFFFF)' }}
                                    >
                                        {metric.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Image */}
                    <div className="flex w-[45%] h-full justify-center items-center">
                        <div className="w-full h-full max-h-[657.4px] overflow-hidden rounded-[10px]">
                            <img
                                src={mainImage?.__image_url__}
                                alt={mainImage?.__image_prompt__}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
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

