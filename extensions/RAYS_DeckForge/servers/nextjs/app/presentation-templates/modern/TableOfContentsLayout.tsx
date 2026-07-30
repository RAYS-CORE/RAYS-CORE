import React from "react";
import * as z from "zod";

export const layoutId = "table-of-contents";
export const layoutName = "Table Of Contents";
export const layoutDescription =
  "A clean table of contents layout with up to 10 items, each with a short description, styled to match the modern template.";

const TocItemSchema = z.object({
  title: z.string().min(3).max(40).meta({
    description: "Item title (short)",
  }),
  description: z.string().min(10).max(80).meta({
    description: "Short item description",
  }),
});

const tableOfContentsSchema = z.object({
  title: z.string().min(3).max(40).default("Table Of Contents").meta({
    description: "Main title displayed at the top",
  }),
  items: z
    .array(TocItemSchema)
    .min(2)
    .max(10)
    .default(
      Array.from({ length: 10 }).map((_, i) => ({
        title: `Section ${i + 1}`,
        description: "Brief description for this section.",
      }))
    )
    .meta({ description: "List of up to 10 TOC items" }),

});

export const Schema = tableOfContentsSchema;
export type TableOfContentsData = z.infer<typeof tableOfContentsSchema>;

interface TableOfContentsLayoutProps {
  data?: Partial<TableOfContentsData>;
}

const TableOfContentsLayout: React.FC<TableOfContentsLayoutProps> = ({
  data: slideData,
}) => {
  const items = slideData?.items?.slice(0, 10) || [];

  return (
    <>
      {/* Import Montserrat Font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className="w-full max-w-[1280px] max-h-[720px] aspect-video mx-auto rounded shadow-lg overflow-hidden relative z-20"
        style={{ fontFamily: "var(--heading-font-family,Montserrat)", backgroundColor: 'var(--background-color, #FFFFFF)' }}
      >
        {/* Header */}
        {((slideData as any)?.__companyName__ || (slideData as any)?._logo_url__) && (
          <div className="absolute top-0 left-0 right-0 px-8 sm:px-12 lg:px-20 pt-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">

                {(slideData as any)?._logo_url__ && <img src={(slideData as any)?._logo_url__} alt="logo" className="w-6 h-6" />}
                {(slideData as any)?.__companyName__ && <span className="text-sm sm:text-base font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                  {(slideData as any)?.__companyName__ || 'Company Name'}
                </span>}
              </div>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="absolute top-20 left-16 right-16">
          <h1 className="text-5xl font-bold leading-tight text-left" style={{ color: 'var(--background-text, #234CD9)' }}>
            {slideData?.title}
          </h1>
        </div>

        {/* TOC Grid */}
        <div className="absolute left-16 right-16" style={{ top: "28%" }}>
          <div className="grid grid-cols-2 gap-x-10 gap-y-5">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full text-foreground flex items-center justify-center text-base font-bold" style={{ backgroundColor: 'var(--primary-color, #1E4CD9)', color: 'var(--primary-text, #ffffff )' }}>
                  {idx + 1}
                </div>
                <div className="flex-1 rounded-md p-3" style={{ backgroundColor: 'var(--card-color, #F5F8FE)' }}>
                  <div className="text-lg font-semibold mb-1" style={{ color: 'var(--background-text, #1E4CD9)' }}>
                    {item.title}
                  </div>
                  <div className="text-sm leading-relaxed" style={{ color: 'var(--background-text, #234CD9)' }}>
                    {item.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Divider */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: 'var(--primary-color, #1E4CD9)' }} />
      </div>
    </>
  );
};

export default TableOfContentsLayout;


