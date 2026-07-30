/**
 * Zod Schema for Slide Content
 */
import * as z from "zod";
export const Schema = z.object({
    title: z.string().max(30).describe('The main heading of the slide').default('Our Team Members'),
    description: z.string().max(400).describe('Supporting description text for the slide').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    teamMembers: z.array(z.object({
        name: z.string().max(40).describe('Name of the person'),
        designation: z.string().max(50).describe('Role or position title'),
        image: z.object({
            __image_url__: z.string(),
            __image_prompt__: z.string().max(100),
        }).describe('Profile image of the person'),
        bio: z.string().max(100).describe('Brief biography or description text'),
    })).max(4).describe('List of person cards, up to 4 items').default([
        {
            name: 'Hannah Morales',
            designation: 'Founder & CEO',
            image: {
                __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
                __image_prompt__: 'Professional headshot of a female executive',
            },
            bio: 'Focus on companies with 500+ employees.',
        },
        {
            name: 'James Wilson',
            designation: 'Head of Sales',
            image: {
                __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
                __image_prompt__: 'Professional headshot of a male executive',
            },
            bio: 'Focus on companies with 500+ employees.',
        },
        {
            name: 'Helene Paquet',
            designation: 'Chief Tech Officer',
            image: {
                __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
                __image_prompt__: 'Professional headshot of a female technology leader',
            },
            bio: 'Focus on companies with 500+ employees.',
        },
        {
            name: 'Marcus Chen',
            designation: 'Creative Director',
            image: {
                __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
                __image_prompt__: 'Professional headshot of a male creative professional',
            },
            bio: 'Focus on companies with 500+ employees.',
        },
    ]),
});

/**
 * Layout ID, Name, and Description
 */
export const layoutId = 'title-description-team-grid';
export const layoutName = 'Title Description With Photo Row';
export const layoutDescription = 'A top-aligned layout featuring split title and description sections at the top, followed by a horizontal row of up to 4 person cards. Each card shows name, designation, square photo, and brief bio.';

/**
 * React Component: dynamicSlideLayout
 */
const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, teamMembers } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col p-[80px] font-['Poppins']"

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

                {/* Decorative Slide Number Placeholder (Based on HTML but kept subtle) */}
                <div className="absolute left-[52px] top-[34px] opacity-0">
                    <span className="text-[20px] font-normal tracking-[5px]" style={{ color: 'var(--background-text,#000000)' }}>1</span>
                </div>

                {/* Header Section */}
                <div className="flex justify-between items-start mb-[80px]">
                    <div className="flex flex-col basis-1/2">
                        <h1 className="text-[42.7px] font-bold leading-[1.1] tracking-[-1.6px] mb-[16px]" style={{ color: 'var(--background-text,#101828)' }}>
                            {title}
                        </h1>
                        <div className="w-[116px] h-[6px]" style={{ backgroundColor: 'var(--primary-color,#9234EB)' }} />
                    </div>

                    <div className="basis-1/2 pl-[40px]">
                        <p className="text-[16px] font-normal leading-[1.6]" style={{ color: 'var(--background-text,#000000)' }}>
                            {description}
                        </p>
                    </div>
                </div>

                {/* Team Grid Section */}
                <div className="flex gap-[40px] items-start justify-center flex-grow">
                    {teamMembers?.map((member, index) => (
                        <div key={index} className="flex flex-col flex-1 max-w-[215px]">
                            {/* Name and Designation */}
                            <div className="mb-[30px] h-[50px] flex flex-col justify-end">
                                <h2 className="text-[18px]  font-medium leading-[1.4] tracking-[-0.1px]" style={{ color: 'var(--background-text,#2B3A38)' }}>
                                    {member?.name}
                                </h2>
                                <p className="text-[18px] font-normal leading-[1.4] tracking-[-0.1px]" style={{ color: 'var(--background-text,#A8ABA3)' }}>
                                    {member?.designation}
                                </p>
                            </div>

                            {/* Photo */}
                            <div className="w-full aspect-square mb-[20px] overflow-hidden rounded-[8px]">
                                <img
                                    src={member?.image?.__image_url__}
                                    alt={member?.image?.__image_prompt__}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            {/* Bio */}
                            <div className="mt-auto">
                                <p className="text-[16px] font-normal leading-[1.3]" style={{ color: 'var(--background-text,#000000)' }}>
                                    {member?.bio}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default dynamicSlideLayout;