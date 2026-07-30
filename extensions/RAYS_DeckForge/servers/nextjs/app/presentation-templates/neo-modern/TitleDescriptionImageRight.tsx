import * as z from 'zod'

export const Schema = z.object({
    title: z.string().max(50).describe('The main title of the slide').default('Image with Description'),
    description: z.string().max(350).describe('The body text or description of the slide').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    image: z.object({
        __image_url__: z.string().describe('The URL of the featured image'),
        __image_prompt__: z.string().max(100).describe('A description for generating a replacement image')
    }).describe('The large image displayed on the right side of the slide').default({
        __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
        __image_prompt__: 'Close up of diverse business hands joined together in a circle, representing teamwork and partnership.'
    })
});

export const layoutId = 'title-description-image-right';
export const layoutName = 'Title Description Image Right';
export const layoutDescription = 'A two-column slide with a title and description on the left and a large featured image on the right. The balanced layout provides equal emphasis on textual content and visual representation.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, image } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full h-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden font-['Montserrat'] font-normal"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >


                <div className="flex w-full h-full items-center justify-between px-[50px] py-[40px]">
                    {/* Left Side: Title and Description */}
                    <div className="flex flex-col gap-[15px] w-full max-w-[525px]">
                        {title && (
                            <h1
                                className="font-bold text-[42.7px] leading-tight"
                                style={{ letterSpacing: '-1.6px', color: 'var(--background-text,#002BB2)' }}
                            >
                                {title}
                            </h1>
                        )}
                        {description && (
                            <p
                                className="font-normal text-[16px] leading-[28.5px]"
                                style={{ color: 'var(--background-text,#244CD9)' }}
                            >
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Right Side: Featured Image */}
                    <div className="flex-shrink-0 w-[531.3px] h-[559.0px] rounded-lg overflow-hidden">
                        {image?.__image_url__ && (
                            <img
                                src={image.__image_url__}
                                alt={image.__image_prompt__ || 'Slide Visual'}
                                className="w-full h-full object-cover"
                                style={{ objectPosition: '52.9% 44.07%' }}
                            />
                        )}
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

