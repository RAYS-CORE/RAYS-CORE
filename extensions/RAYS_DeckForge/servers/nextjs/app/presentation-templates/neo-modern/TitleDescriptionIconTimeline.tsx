import { RemoteSvgIcon } from '@/app/hooks/useRemoteSvgIcon';
import * as z from 'zod'

export const Schema = z.object({
    title: z.string().max(40).describe('The main heading of the slide').default('Process / Workflow Flow'),
    description: z.string().max(300).describe('Supporting description text').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    processItems: z.array(z.object({
        icon: z.object({
            __icon_url__: z.string(),
            __icon_query__: z.string().max(30)
        }).describe('The icon representing the item'),
        heading: z.string().max(10).describe('The heading of the item'),
        subDescription: z.string().max(100).describe('The sub description of the item')
    })).max(5).describe('A list of up to 5 items').default([
        {
            icon: { __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg', __icon_query__: 'growth chart' },
            heading: '2021',
            subDescription: 'Briefly elaborate on what you want to discuss.Briefly elaborate on what you want to discuss.'
        },
        {
            icon: { __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg', __icon_query__: 'money bag' },
            heading: '2020',
            subDescription: 'Briefly elaborate on what you want to discuss.'
        },
        {
            icon: { __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg', __icon_query__: 'global' },
            heading: '2019',
            subDescription: 'Briefly elaborate on what you want to discuss.'
        },
        {
            icon: { __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg', __icon_query__: 'handshake' },
            heading: '2018',
            subDescription: 'Briefly elaborate on what you want to discuss.'
        },
        {
            icon: { __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg', __icon_query__: 'lightbulb' },
            heading: '2017',
            subDescription: 'Briefly elaborate on what you want to discuss.'
        }
    ])
});

export const layoutId = 'title-description-icon-timeline';
export const layoutName = 'Title Description Icon Timeline';
export const layoutDescription = 'A slide featuring a title and description on the left with a vertical list of icon-enhanced items on the right. Each item has a circular icon, heading, and description.';

const dynamicSlideLayout = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const { title, description, processItems } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-row items-center justify-between gap-10 px-[115px]"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >
                {/* Left Content */}
                <div className="flex-[0.5] flex flex-col justify-center pr-10">
                    <h1 className="text-[42.7px]  font-bold leading-[1.1] mb-[20px] tracking-[-1.6px]"
                        style={{ color: 'var(--background-text,#002BB2)' }}
                    >
                        {title}
                    </h1>
                    <p className="text-[16.0px]  font-normal leading-[1.7]"
                        style={{ color: 'var(--background-text,#002BB2)' }}
                    >
                        {description}
                    </p>
                </div>

                {/* Right Content - Timeline List */}
                <div className="flex-[0.5] flex flex-col justify-center  gap-[24px]">
                    {processItems?.map((item, index) => (
                        <div key={index} className="flex flex-row items-center gap-[16px]">
                            {/* Icon inside circle */}
                            <div className="w-[66px] h-[66px] rounded-full border-[1.3px] border-[#4C68DF] flex items-center justify-center flex-shrink-0"
                                style={{
                                    borderColor: 'var(--stroke,#4C68DF)',
                                    backgroundColor: 'var(--primary-color,#F7F8FF)',
                                }}
                            >
                                <div className="w-[40px] h-[40px] flex items-center justify-center">
                                    <RemoteSvgIcon
                                        url={item.icon?.__icon_url__}
                                        strokeColor={"currentColor"}
                                        className="w-full h-full object-contain"
                                        color="var(--primary-text, #4C68DF)"
                                        title={item.icon.__icon_query__}
                                    />

                                </div>
                            </div>

                            {/* Content Box */}
                            <div className="bg-[#F7F8FF] rounded-[3px] w-full h-[92px] flex flex-col justify-center px-[18px]"
                                style={{
                                    backgroundColor: 'var(--card-color,#F7F8FF)',
                                }}
                            >
                                <div className="text-[17.5px]  font-bold leading-[1.2]"
                                    style={{ color: 'var(--background-text,#002BB2)' }}
                                >
                                    {item.heading}
                                </div>
                                <div className="text-[15.3px]  font-normal leading-[1.2] mt-[6px]"
                                    style={{ color: 'var(--background-text,#002BB2)' }}
                                >
                                    {item.subDescription}
                                </div>
                            </div>
                        </div>
                    ))}
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

