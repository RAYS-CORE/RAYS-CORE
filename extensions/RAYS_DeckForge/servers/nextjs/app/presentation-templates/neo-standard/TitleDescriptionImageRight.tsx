import * as z from 'zod';

export const Schema = z.object({
    title: z
        .string()
        .max(17)
        .describe("The heading of the slide")
        .default("Executive Summary"),
    description: z
        .string()
        .max(226)
        .describe("The main textual content of the slide")
        .default(
            "Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies."
        ),
    image: z
        .object({
            __image_url__: z.string(),
            __image_prompt__: z.string().max(100),
        })
        .describe("The vertical image displayed on the right side")
        .default({
            __image_url__:
                "https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png",
            __image_prompt__:
                "A group of diverse professionals stacking their hands together in a sign of teamwork and unity, high quality corporate office setting",
        }),
});

export const layoutId = "title-description-image-right";
export const layoutName = "Title Description Image Right";
export const layoutDescription = "A two-column slide with a title and description paragraph on the left, and a large featured image on the right.";

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({
    data,
}) => {
    const { title, description, image } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Playfair Display)',
                }}
            >
                <div className="flex h-full w-full px-[90px] py-[31px]">
                    {/* Left Content Column */}
                    <div className="flex flex-col justify-center flex-1 pr-[40px]">
                        {/* Decorative Element: Green Line */}
                        <div className="mb-[20px]">
                            <svg
                                width="117"
                                height="4"
                                viewBox="0 0 117 4"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <rect width="116.6" height="3.3" fill="#1F8A2E"
                                    style={{ fill: 'var(--primary-color,#1F8A2E)' }}
                                />
                            </svg>
                        </div>

                        {/* Title */}
                        <h1
                            className="text-[42.7px]  font-bold mb-[15px] leading-[44px]"
                            style={{ letterSpacing: "-1.6px", color: 'var(--background-text,#000000)' }}
                        >
                            {title}
                        </h1>

                        {/* Description */}
                        <p className="text-[16px]  leading-[28.5px] max-w-[510px]"
                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {description}
                        </p>
                    </div>

                    {/* Right Image Column */}
                    <div className="flex items-center justify-end">
                        <div className="w-[531px] h-full max-h-[657px]">
                            <img
                                src={image?.__image_url__}
                                alt={image?.__image_prompt__}
                                className="w-full h-full object-cover rounded-[16px]"
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

