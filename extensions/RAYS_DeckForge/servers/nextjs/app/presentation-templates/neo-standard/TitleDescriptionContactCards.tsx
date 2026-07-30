import * as z from 'zod';

export const Schema = z.object({
    title: z.string().max(20).describe("The main heading of the slide").default("Thank you"),
    description: z.string().max(300).describe("A brief description or concluding text").default("Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies."),
    contactItems: z.array(z.object({
        label: z.string().max(20).describe("The label of the item"),
        value: z.string().max(50).describe("The value of the item")
    })).max(3).optional().describe("A list of items").default([
        { label: "Email", value: "hello@example.com" },
        { label: "Phone", value: "+977-9800789088" },
        { label: "Website", value: "www.hello@gmail.com" }
    ])
});

export const layoutId = 'title-description-contact-cards';
export const layoutName = 'Title Description Contact Cards';
export const layoutDescription = 'A closing slide with a title, description text, and three contact information cards for email, phone, and website, ideal for thank you or contact pages.';

const dynamicSlideLayout = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const { title, description, contactItems } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden "

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Playfair Display)',
                }}
            >



                <div className="flex flex-col h-full px-[114px] pt-[132px] justify-center ">

                    <div className="mb-[60px]">
                        <div className=" w-[116.6px] h-[3.3px] bg-[#1F8A2E] mb-[10px]"
                            style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                        />
                        <h1 className="text-[42.7px] text-foreground  font-bold leading-tight mb-[16px] tracking-[-1.6px]"
                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {title}
                        </h1>
                        <p className="text-[16px] text-foreground  leading-[28.5px] max-w-[675px]"
                            style={{ color: 'var(--background-text,#000000)' }}
                        >
                            {description}
                        </p>
                    </div>

                    {/* Contact Cards Section */}
                    {contactItems && contactItems?.length > 0 && <div className="flex justify-start gap-[20px] items-start mt-auto mb-[185px]">
                        {contactItems?.map((item, index) => (
                            <div key={index} className="relative flex flex-col items-center">
                                {/* Decorative Circle Background (Approximation from reference image) */}
                                <div
                                    className="absolute -top-[25px] w-[140px] h-[70px] bg-[#F4F4F4] rounded-t-full -z-10"
                                    style={{ opacity: 0.8 }}
                                />

                                {/* Card Container */}
                                <div
                                    className="w-[296px] h-[152px] border-[0.7px] border-[#EBEBEB] rounded-[6px] bg-[#FFFFFE] flex flex-col items-center p-[6px]"
                                    style={{ boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', borderColor: 'var(--stroke,#EBEBEB)', backgroundColor: 'var(--card-color,#FFFFFE)' }}
                                >
                                    {/* Label Header */}
                                    <div className="w-full h-[37.7px] bg-[#1F8A2E] rounded-[6px] flex items-center justify-center mb-[36px]"
                                        style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                                    >
                                        <span className="text-[21.3px] text-foreground  font-bold"
                                            style={{ color: 'var(--primary-text,#FFFFFF)' }}
                                        >
                                            {item?.label}
                                        </span>
                                    </div>

                                    {/* Value Text */}
                                    <div className="flex-1 flex items-center justify-center">
                                        <span className="text-[21.6px] text-foreground text-center px-4 leading-[25.9px]"
                                            style={{ color: 'var(--background-text,#000000)' }}
                                        >
                                            {item?.value}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>}
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

