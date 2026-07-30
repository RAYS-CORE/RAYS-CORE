import * as z from "zod";


export const Schema = z.object({
    title: z.string().max(10).describe('The main heading of the slide').default('Thank you'),
    description: z.string().max(120).describe('Supporting description text').default('Thanks for supporting our small business! to show our love, please enjoy 20% off you next order with the code "CODE20"'),
    contactTitle: z.string().max(15).describe('Heading for the contact section').default('Contact Us'),
    phone: z.string().max(20).describe('Phone number text').default('+977-98000000'),
    email: z.string().max(30).describe('Email address text').default('hello@example.com'),
    website: z.string().max(30).describe('Website URL text').default('www.example.com'),
    footerImage: z.object({
        __image_url__: z.string(),
        __image_prompt__: z.string().max(100)
    }).default({
        __image_url__: "https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png",
        __image_prompt__: "A professional aesthetic photo of business hands reviewing documents and charts"
    })
});

export const layoutId = 'thank-you-contact-info-footer-image-slide-layout';
export const layoutName = 'Centered Title With Contact And Footer Image';
export const layoutDescription = 'A conclusion slide featuring centered title with accent bar, description text on the left, contact information (phone, email, website) aligned right, and a full-width footer image.';

const dynamicSlideLayout = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const { title, description, contactTitle, phone, email, website, footerImage } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden"

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
                {/* Centered Header Section */}
                <div className="absolute left-[370.0px] top-[71.5px] w-[540.0px] h-[100px] flex flex-col items-center">
                    <div className="text-center min-h-[1.2em]" style={{ lineHeight: '45.2px' }}>
                        <span className="text-[42.7px]  font-bold" style={{ letterSpacing: '-1.6px', color: 'var(--background-text,#101828)' }}>
                            {title}
                        </span>
                    </div>
                    <div className="mt-[16px] w-[116.6px] h-[5.7px]" style={{ backgroundColor: 'var(--primary-color,#9234EB)' }}></div>
                </div>

                {/* Description / Appreciation Message */}
                <div className="absolute left-[65.2px] top-[280.1px] w-[516.5px] h-[96.0px] overflow-visible">
                    <div className="text-left min-h-[1.2em]" style={{ lineHeight: '32.3px' }}>
                        <span className="text-[23.1px] font-normal" style={{ color: 'var(--background-text,#000000)' }}>
                            {description}
                        </span>
                    </div>
                </div>

                {/* Contact Section */}
                <div className="absolute right-[82px] top-[231.2px] w-[397.4px] flex flex-col items-end">
                    <div className="text-right min-h-[1.2em] mb-[15px]" style={{ lineHeight: '28.4px' }}>
                        <span className="text-[28.4px] font-normal" style={{ color: 'var(--primary-color,#9234EB)' }}>
                            {contactTitle}
                        </span>
                    </div>
                    <div className="text-right min-h-[1.2em] mb-[6px]" style={{ lineHeight: '29.9px' }}>
                        <span className="text-[21.3px] font-normal" style={{ color: 'var(--background-text,#324712)' }}>
                            {phone}
                        </span>
                    </div>
                    <div className="text-right min-h-[1.2em] mb-[6px]" style={{ lineHeight: '29.9px' }}>
                        <span className="text-[21.3px] font-normal" style={{ color: 'var(--background-text,#324712)' }}>
                            {email}
                        </span>
                    </div>
                    <div className="text-right min-h-[1.2em]" style={{ lineHeight: '29.9px' }}>
                        <span className="text-[21.3px] font-normal" style={{ color: 'var(--background-text,#324712)' }}>
                            {website}
                        </span>
                    </div>
                </div>

                {/* Decorative Line */}
                <div className="absolute left-[60.0px] top-[412.8px] w-[558.0px] h-[1.0px]">
                    <svg width="100%" height="100%" overflow="visible">
                        <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="var(--background-text,#D3CFCF)" strokeWidth="0.7" />
                    </svg>
                </div>

                {/* Footer Image Section */}
                {footerImage && <div className="absolute left-[65.2px] top-[412.8px] w-[1142.8px] h-[276.5px] overflow-hidden">
                    <img
                        src={footerImage.__image_url__}
                        alt={footerImage.__image_prompt__}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: '68.32% 50.0%' }}
                    />
                </div>}
            </div>
        </>
    );
};

export default dynamicSlideLayout;