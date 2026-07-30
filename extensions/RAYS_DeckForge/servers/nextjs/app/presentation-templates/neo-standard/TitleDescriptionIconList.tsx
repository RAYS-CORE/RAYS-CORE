/**
 * Zod Schema for the slide content
 */
import { RemoteSvgIcon } from '@/app/hooks/useRemoteSvgIcon';
import * as z from 'zod';

export const Schema = z.object({
    title: z.string().max(30).describe('The main title of the slide').default('Process / Workflow Flow'),
    description: z.string().max(250).describe('A descriptive paragraph for the slide topic').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    listItems: z.array(z.object({
        icon: z.object({
            __icon_url__: z.string(),
            __icon_query__: z.string().max(30)
        }),
        heading: z.string().max(10).describe('The heading of the item'),
        itemDescription: z.string().max(50).describe('The sub description of the item')
    })).max(5).describe('A list of items with icons, headings, and descriptions').default([
        {
            icon: { __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg', __icon_query__: 'checkmark' },
            heading: '2021',
            itemDescription: 'Briefly elaborate on what you want to discuss.'
        },
        {
            icon: { __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg', __icon_query__: 'checkmark' },
            heading: '2020',
            itemDescription: 'Briefly elaborate on what you want to discuss.'
        },
        {
            icon: { __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg', __icon_query__: 'checkmark' },
            heading: '2019',
            itemDescription: 'Briefly elaborate on what you want to discuss.'
        },
        {
            icon: { __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg', __icon_query__: 'checkmark' },
            heading: '2018',
            itemDescription: 'Briefly elaborate on what you want to discuss.'
        },
        {
            icon: { __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg', __icon_query__: 'checkmark' },
            heading: '2017',
            itemDescription: 'Briefly elaborate on what you want to discuss.'
        }
    ])
});

export const layoutId = 'title-description-icon-list';
export const layoutName = 'Title Description Icon List';
export const layoutDescription = 'A two-column slide with a title and description on the left, and a vertical list of icon-led items on the right, perfect for processes, steps, or feature lists.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, listItems } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden flex items-center justify-between gap-10 px-28 py-20"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Playfair Display)',
                }}
            >
                {/* Left Content Area */}
                <div className="flex flex-col basis-1/2 ">
                    {/* Decorative Green Line */}
                    <div className="w-[116px] h-[3px] bg-[#1F8A2E] mb-4"
                        style={{ backgroundColor: 'var(--primary-color,#1F8A2E)' }}
                    />

                    {/* Main Title */}
                    <h1 className="text-[42.7px] text-foreground  font-bold leading-tight mb-8 tracking-[-1.6px]"
                        style={{ color: 'var(--background-text,#000000)' }}
                    >
                        {title}
                    </h1>

                    {/* Main Description */}
                    <p className="text-[16px] text-foreground  leading-[28.5px] max-w-[475px]"
                        style={{ color: 'var(--background-text,#000000)' }}
                    >
                        {description}
                    </p>
                </div>

                {/* Right List Area */}
                <div className="flex flex-col basis-1/2 gap-10">
                    {listItems?.map((item, index) => (
                        <div key={index} className="flex items-start gap-8">
                            {/* Icon Container */}
                            <div className="flex-shrink-0 w-[65.6px] h-[65.6px] rounded-full border-[1.3px] border-[#1F8A2E] bg-[#ecfaee] flex items-center justify-center p-4"
                                style={{ borderColor: 'var(--stroke,#1F8A2E)', backgroundColor: 'var(--primary-color,#ecfaee)' }}
                            >
                                <RemoteSvgIcon
                                    url={item.icon?.__icon_url__}
                                    strokeColor={"currentColor"}
                                    className="w-full h-full object-contain"
                                    color="var(--primary-text, #000000)"
                                    title={item.icon.__icon_query__}
                                />

                            </div>

                            {/* Item Text Content */}
                            <div className="flex flex-col justify-center">
                                <h3 className="text-[21.3px] text-foreground  font-bold leading-[25.6px]"
                                    style={{ color: 'var(--background-text,#000000)' }}
                                >
                                    {item.heading}
                                </h3>
                                <p className="text-[16px] text-foreground  leading-[19.2px] mt-1 max-w-[243px]"
                                    style={{ color: 'var(--background-text,#000000)' }}
                                >
                                    {item.itemDescription}
                                </p>
                            </div>
                        </div>
                    ))}
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

