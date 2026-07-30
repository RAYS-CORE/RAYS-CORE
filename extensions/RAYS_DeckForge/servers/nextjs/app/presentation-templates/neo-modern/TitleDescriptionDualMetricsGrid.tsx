/**
 * Zod Schema for the slide content.
 */
import * as z from 'zod'

export const Schema = z.object({
    title: z.string().describe('The main heading of the slide').max(30).default('Description and Metrix'),
    description: z.string().describe('Supporting description text').max(250).default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    primaryMetrics: z.array(z.object({
        label: z.string().max(25).describe('Label text for the metric'),
        value: z.string().max(8).describe('Value displayed for the metric')
    })).max(3).describe('List of primary metrics displayed').default([
        { label: 'Main Challenge: Delayed Client', value: '85%' },
        { label: 'Main Challenge: Delayed Client', value: '85%' },
        { label: 'Main Challenge: Delayed Client', value: '85%' }
    ]),
    secondaryMetrics: z.array(z.object({
        label: z.string().max(25).describe('Label text for the metric'),
        value: z.string().max(8).describe('Value displayed for the metric')
    })).max(3).describe('List of secondary metrics displayed').default([
        { label: 'Total Registered Users', value: '>500 M' },
        { label: 'Total Registered Users', value: '>500 M' },
        { label: 'Total Registered Users', value: '>500 M' }
    ])
});

export const layoutId = 'title-description-dual-metrics-grid';
export const layoutName = 'Title Description Dual Metrics Grid';
export const layoutDescription = 'A slide featuring a title and description on the left, with two columns of metric cards on the right - primary metrics in bold styling and secondary metrics in subtle styling. Supports up to 6 metrics total (3 per column).';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, primaryMetrics, secondaryMetrics } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden flex items-center px-[52px] justify-between"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >
                {/* Left Content Section */}
                <div className="flex flex-col max-w-[522px] gap-[30px]">
                    {title && (
                        <h1 className="text-[42.7px]  font-bold leading-[1.05] tracking-[-1.6px]"
                            style={{ color: 'var(--background-text,#002BB2)' }}
                        >
                            {title}
                        </h1>
                    )}
                    {description && (
                        <p className="text-[16px]  font-normal leading-[1.5]"
                            style={{ color: 'var(--background-text,#002BB2)' }}
                        >
                            {description}
                        </p>
                    )}
                </div>

                {/* Right Metrics Section */}
                <div className="flex gap-[25px] items-center">
                    {/* Primary Metrics Column */}
                    <div className="flex flex-col gap-[20px]">
                        {primaryMetrics?.map((metric, index) => (
                            <div
                                key={index}
                                className="w-[259.3px] h-[152.8px]  rounded-[3.5px] p-[28px] flex flex-col justify-between"
                                style={{
                                    backgroundColor: 'var(--card-color,#6B89E6)',
                                }}
                            >
                                <div className="text-[17.8px]  font-normal leading-[1.4]"
                                    style={{ color: 'var(--background-text,#FFFFFF)' }}
                                >
                                    {metric.label}
                                </div>
                                <div className="text-[39.3px]  font-bold leading-none"
                                    style={{ color: 'var(--background-text,#FFFFFF)' }}
                                >
                                    {metric.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Secondary Metrics Column */}
                    <div className="flex flex-col gap-[20px]">
                        {secondaryMetrics?.map((metric, index) => (
                            <div
                                key={index}
                                className="w-[259px] h-[152.8px]  rounded-[3.5px] p-[28px] flex flex-col justify-between"
                                style={{
                                    backgroundColor: 'var(--card-color,#F7F8FF)',
                                }}
                            >
                                <div className="text-[17.8px]  font-normal leading-[1.4]"
                                    style={{ color: 'var(--background-text,#244CD9)' }}
                                >
                                    {metric.label}
                                </div>
                                <div className="text-[39.3px]  font-bold leading-none"
                                    style={{ color: 'var(--background-text,#244CD9)' }}
                                >
                                    {metric.value}
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

