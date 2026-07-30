/**
 * Zod Schema for the Thank You / Contact slide.
 */
import { RemoteSvgIcon } from '@/app/hooks/useRemoteSvgIcon';
import * as z from 'zod'

export const Schema = z.object({
    title: z.string().max(20).describe('The title of the slide').default('Thank you'),
    description: z.string().max(350).describe('The description of the slide').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    contactItems: z.array(z.object({
        icon: z.object({
            __icon_url__: z.string(),
            __icon_query__: z.string().max(30),
        }),
        label: z.string().max(20).describe('The label of item'),
        value: z.string().max(50).describe('The value of item'),
    })).max(3).describe('A list of items').default([
        {
            icon: {
                __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg',
                __icon_query__: 'envelope',
            },
            label: 'Email',
            value: 'hello@example.com',
        },
        {
            icon: {
                __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg',
                __icon_query__: 'phone',
            },
            label: 'Phone',
            value: '+977-98000000',
        },
        {
            icon: {
                __icon_url__: 'https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg',
                __icon_query__: 'globe',
            },
            label: 'Website',
            value: 'www.example.com',
        },
    ]),
});

export const layoutId = 'title-description-contact-list';
export const layoutName = 'Title Description Contact List';
export const layoutDescription = 'A slide featuring a title and description on the left with up to 3 icon-enhanced contact items on the right. Each item has an icon, label, and value.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, contactItems } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >


                <div className="flex h-full w-full items-center justify-between px-[115px] gap-20">
                    {/* Left Section: Content */}
                    <div className="flex flex-col flex-[1.2] justify-center">
                        {title && (
                            <h1
                                style={{ fontWeight: 700, letterSpacing: '-1.6px', color: 'var(--background-text,#002BB2)' }}
                                className="text-[42.7px] font-bold  mb-6 leading-tight"
                            >
                                {title}
                            </h1>
                        )}
                        {description && (
                            <p
                                style={{ fontWeight: 400, color: 'var(--background-text,#002BB2)' }}
                                className="text-[16.0px]  leading-[28.5px] max-w-[475px]"
                            >
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Right Section: Contact List */}
                    <div className="flex flex-col flex-1 justify-center gap-10">
                        {contactItems?.map((item, index) => (
                            <div key={index} className="flex items-center gap-5">
                                {/* Icon Circle */}
                                <div
                                    className="w-[66px] h-[66px] rounded-full border  flex items-center justify-center flex-shrink-0"
                                    style={{
                                        borderColor: 'var(--stroke,#4C68DF)',
                                        backgroundColor: 'var(--primary-color,#F7F8FF)',
                                    }}
                                >
                                    {item.icon?.__icon_url__ && (
                                        <RemoteSvgIcon
                                            url={item.icon.__icon_url__}
                                            strokeColor={"currentColor"}
                                            className="w-8 h-8 object-contain"
                                            color="var(--primary-text, #4C68DF)"
                                            title={item.icon.__icon_query__}
                                        />

                                    )}
                                </div>

                                {/* Text Box */}
                                <div
                                    className="flex flex-col justify-center  px-6 py-4 rounded-[3.4px] w-full h-[92px]"
                                    style={{
                                        backgroundColor: 'var(--card-color,#F7F8FF)',
                                    }}
                                >
                                    {item.label && (
                                        <div
                                            style={{ fontWeight: 700, color: 'var(--background-text,#002BB2)' }}
                                            className="text-[17.5px] font-bold  leading-[21.0px]"
                                        >
                                            {item.label}
                                        </div>
                                    )}
                                    {item.value && (
                                        <div
                                            style={{ fontWeight: 400, color: 'var(--background-text,#002BB2)' }}
                                            className="text-[15.3px]  leading-[18.4px] mt-1"
                                        >
                                            {item.value}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {(data as any)?.__companyName__ || (data as any)?._logo_url__ && <div className="flex items-center gap-1 absolute top-5 left-5 z-40">
                    {(data as any)?._logo_url__ && <img src={(data as any)?._logo_url__} alt="logo" className="w-[60px] object-contain" />}
                    <span
                        style={{ backgroundColor: 'var(--stroke, #F0F0F0)' }}
                        className=' w-[2px] h-4'></span>
                    {(data as any)?.__companyName__ && <span className="text-sm  font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                        {(data as any)?.__companyName__}
                    </span>}
                </div>}
            </div>
        </>
    );
};
export default dynamicSlideLayout;

