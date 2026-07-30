import * as z from 'zod'

export const Schema = z.object({
    title: z.string().max(20).describe('The main title of the slide').default('Table of Content'),
    items: z.array(z.object({
        heading: z.string().max(30).describe('The title of each list item'),
        description: z.string().max(100).describe('A short description for each list item')
    })).max(10).describe('List of content items to display').default([
        { heading: 'Order Placement', description: 'Customers choose products and confirm purchase online.' },
        { heading: 'Payment Process', description: 'Payment is made through card, bank transfer, or e-wallet.' },
        { heading: 'Order Verification', description: 'The system validates transaction details before processing.' },
        { heading: 'Packaging Stage', description: 'Items are packed securely to prepare for shipping.' },
        { heading: 'Delivery Confirmation', description: 'Package reaches the customer and confirmation is received.' },
        { heading: 'Shipment Dispatch', description: 'Courier services pick up the order for delivery.' },
        { heading: 'In-Transit Tracking', description: 'Customers can monitor the real-time delivery status.' },
        { heading: 'Delivery Confirmation', description: 'Package reaches the customer and confirmation is received.' },
        { heading: 'In-Transit Tracking', description: 'Customers can monitor the real-time delivery status.' },
        { heading: 'Delivery Confirmation', description: 'Package reaches the customer and confirmation is received.' }
    ])
});

export const layoutId = 'title-two-column-numbered-list';
export const layoutName = 'Title Two Column Numbered List';
export const layoutDescription = 'A slide layout featuring a large title on the left with a two-column numbered list on the right. Each item displays a circular number badge, heading, and description. The numbered format emphasizes sequential order and progression of items.';

const dynamicSlideLayout = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const { title, items } = data;

    const firstColumn = items?.slice(0, 5) || [];
    const secondColumn = items?.slice(5, 10) || [];

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-card z-20 mx-auto overflow-hidden flex items-center px-[85px]"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >


                <div className="flex w-full items-center justify-between">
                    {/* Left Section: Title */}
                    <div className="w-[40%] flex-shrink-0">
                        <h1 style={{ color: "var(--background-text,#002BB2)" }} className="text-[42.7px] font-bold text-foreground">
                            {title?.split(' ').reduce((acc, curr, i) => i === 1 ? acc + ' ' + curr + '\n' : acc + ' ' + curr, '').trim()}
                        </h1>
                    </div>

                    {/* Right Section: Two Columns of Numbered Items */}
                    <div className="flex-1 w-[60%] justify-center ml-[40px]  flex  gap-x-[40px]">
                        {/* Column 1 */}
                        <div className="flex flex-col ">
                            {firstColumn.map((item, idx) => (
                                <div key={idx} className="flex items-center h-[115px] border-b border-[#DCE2FA]"
                                    style={{ borderColor: 'var(--stroke,#DCE2FA)' }}
                                >
                                    <div className="flex items-start gap-[15px]">
                                        <div className="flex-shrink-0 w-[53.3px] h-[53.3px] rounded-full bg-[#1F4CD9] flex items-center justify-center"
                                            style={{ backgroundColor: 'var(--card-color,#1F4CD9)' }}
                                        >
                                            <span className="text-foreground  font-bold text-[17.2px] leading-none">
                                                {idx + 1}
                                            </span>
                                        </div>
                                        <div className="flex flex-col justify-center min-h-[53.3px]">
                                            <div className="text-[#244CD9]  font-bold text-[18.1px] mb-1 leading-tight"
                                                style={{ color: 'var(--background-text,#002BB2)' }}
                                            >
                                                {item.heading}
                                            </div>
                                            <div className="text-[#244CD9]  font-normal text-[11.6px] leading-[1.3] max-w-[260px]"
                                                style={{ color: 'var(--background-text,#002BB2)' }}
                                            >
                                                {item.description}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Column 2 */}
                        {secondColumn && secondColumn?.length > 0 && <div className="flex flex-col">
                            {secondColumn.map((item, idx) => (
                                <div key={idx} className="flex items-center h-[115px] border-b border-[#DCE2FA]"
                                    style={{ borderColor: 'var(--stroke,#DCE2FA)' }}
                                >
                                    <div className="flex items-start gap-[15px]">
                                        <div className="flex-shrink-0 w-[53.3px] h-[53.3px] rounded-full bg-[#1F4CD9] flex items-center justify-center"
                                            style={{ backgroundColor: 'var(--card-color,#1F4CD9)' }}
                                        >
                                            <span className="text-foreground  text-[17.2px] leading-none font-bold"
                                                style={{ color: 'var(--background-text,#FFFFFF)' }}
                                            >
                                                {idx + 6}
                                            </span>
                                        </div>
                                        <div className="flex flex-col justify-center min-h-[53.3px]">
                                            <div className="text-[#244CD9]  font-bold text-[18.1px] mb-1 leading-tight"
                                                style={{ color: 'var(--background-text,#002BB2)' }}
                                            >
                                                {item.heading}
                                            </div>
                                            <div className="text-[#244CD9]  font-normal text-[11.6px] leading-[1.3] max-w-[260px]"
                                                style={{ color: 'var(--background-text,#002BB2)' }}
                                            >
                                                {item.description}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>}
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

