import * as z from "zod";

export const slideLayoutId = "panel-list-with-media";
export const slideLayoutName = "Panel List with Media";
export const slideLayoutDescription =
  "A table layout with a left multi-column item list and a configurable right media or color panel.";

const ItemSchema = z.object({
  title: z.string().max(18).meta({
    description: "Item title in the list.",
  }),
  number: z.string().max(2).meta({
    description: "Section number shown on the right.",
  }),
  description: z.string().max(40).optional().meta({
    description: "Optional item description used in description variants.",
  }),
});

export const Schema = z
  .object({
    title: z.string().max(14).default("List").meta({
      description: "Main heading text.",
    }),
    rowVariant: z
      .enum(["titleOnly", "titleWithDescription"])
      .default("titleWithDescription")
      .meta({
        description: "Layout variant for item rows.",
      }),
    sidePanelMode: z.enum(["solid", "image"]).default("solid").meta({
      description: "Right-side panel style.",
    }),

    sidePanelImage: z
      .object({
        __image_url__: z
          .string()
          .url()
          .default(
            "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80"
          ),
        __image_prompt__: z.string().default("Skyscraper perspective photo"),
      })
      .meta({
        description: "Right-side panel image used in image mode.",
      }),
    items: z
      .array(ItemSchema)

      .max(10)
      .default([
        {
          title: "Section Title",
          number: "1",
          description: "Ut enim ad minima. Ut enim ad minima veniam.",
        },
        {
          title: "Clarity",
          number: "2",
          description: "Ut enim ad minima. Ut enim ad minima veniam.",
        },
        {
          title: "Design Principles",
          number: "3",
          description: "Ut enim ad minima. Ut enim ad minima veniam.",
        },
        {
          title: "Visual Structure",
          number: "4",
          description: "Ut enim ad minima. Ut enim ad minima veniam.",
        },
        {
          title: "Typography",
          number: "5",
          description: "Ut enim ad minima. Ut enim ad minima veniam.",
        },
        {
          title: "Color & Space",
          number: "6",
          description: "Ut enim ad minima. Ut enim ad minima veniam.",
        },
        {
          title: "Audience Focus",
          number: "7",
          description: "Ut enim ad minima. Ut enim ad minima veniam.",
        },
        {
          title: "Layout System",
          number: "8",
          description: "Ut enim ad minima. Ut enim ad minima veniam.",
        },
        {
          title: "Presentation Flow",
          number: "9",
          description: "Ut enim ad minima. Ut enim ad minima veniam.",
        },
        {
          title: "Key Takeaways",
          number: "10",
          description: "Ut enim ad minima. Ut enim ad minima veniam.",
        },
      ])
      .meta({
        description: "Items shown in the left panel.",
      }),
  })
  .default({
    title: "List",
    rowVariant: "titleWithDescription",
    sidePanelMode: "image",
    sidePanelImage: {
      __image_url__:
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80",
      __image_prompt__: "Skyscraper perspective photo",
    },
    items: [
      {
        title: "Section Title",
        number: "1",
        description: "Ut enim ad minima. Ut enim ad minima veniam.",
      },
      {
        title: "Clarity",
        number: "2",
        description: "Ut enim ad minima. Ut enim ad minima veniam.",
      },
      {
        title: "Design Principles",
        number: "3",
        description: "Ut enim ad minima. Ut enim ad minima veniam.",
      },
      {
        title: "Visual Structure",
        number: "4    ",
        description: "Ut enim ad minima. Ut enim ad minima veniam.",
      },
      {
        title: "Typography",
        number: "5",
        description: "Ut enim ad minima. Ut enim ad minima veniam.",
      },
      {
        title: "Color & Space",
        number: "6",
        description: "Ut enim ad minima. Ut enim ad minima veniam.",
      },
      {
        title: "Audience Focus",
        number: "7",
        description: "Ut enim ad minima. Ut enim ad minima veniam.",
      },
      {
        title: "Layout System",
        number: "8",
        description: "Ut enim ad minima. Ut enim ad minima veniam.",
      },
      {
        title: "Presentation Flow",
        number: "9",
        description: "Ut enim ad minima. Ut enim ad minima veniam.",
      },
      {
        title: "Key Takeaways",
        number: "10",
        description: "Ut enim ad minima. Ut enim ad minima veniam.",
      },
    ],
  });

export type SchemaType = z.infer<typeof Schema>;

const PanelListWithMedia = ({ data }: { data: Partial<SchemaType> }) => {
  const slideData = data as SchemaType;
  const showDescriptions = slideData.rowVariant === "titleWithDescription";

  const midpoint = Math.ceil(slideData.items && slideData.items.length / 2);
  const leftItems = slideData.items && slideData.items.slice(0, midpoint);
  const rightItems = slideData.items && slideData.items.slice(midpoint);

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap"
        rel="stylesheet"
      />

      <div
        className="relative h-[720px] w-[1280px] overflow-hidden "
        style={{
          backgroundColor: "var(--background-color,#27292d)",
          fontFamily: "var(--body-font-family,'DM Serif Display')",
        }}
      >
        <div className="flex h-full ">
          <div className="px-[44px] pt-[40px] flex-1">
            <h2
              className="font-serif text-[100px] leading-none tracking-[-0.02em]"
              style={{
                color: "var(--background-text,#dddac7)",
                fontFamily: "var(--heading-font-family,'DM Serif Display')",
              }}
            >
              {slideData.title}
            </h2>

            <div className="mt-[34px] grid grid-cols-2 gap-x-[54px]">
              {[leftItems, rightItems].map((column, columnIndex) => (
                <div key={`column-${columnIndex}`}>
                  {column &&
                    column.map((item) => (
                      <div
                        key={`${columnIndex}-${item.number}-${item.title}`}
                        className={
                          showDescriptions
                            ? "border-b pb-[12px] pt-[12px]"
                            : "border-b py-[16px]"
                        }
                        style={{ borderColor: "var(--stroke,#4c4e53)" }}
                      >
                        <div className="flex items-start justify-between gap-[14px]">
                          <p
                            className="text-[28px] leading-[1.08]"
                            style={{ color: "var(--background-text,#d7d3be)" }}
                          >
                            {item.title}
                          </p>
                          <p
                            className="pt-[2px] text-[28px] font-semibold leading-none"
                            style={{ color: "var(--background-text,#cbc7b2)" }}
                          >
                            {item.number}
                          </p>
                        </div>

                        {showDescriptions && (
                          <p
                            className="mt-[6px] text-[22px] leading-[1.08]"
                            style={{ color: "var(--background-text,#cbc7b2)" }}
                          >
                            {item.description ?? "Ut enim ad minima veniam."}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>

          <div
            className="h-full w-[408px]"
            style={{ backgroundColor: "var(--primary-color,#d7d3be)" }}
          >
            {slideData.sidePanelMode === "image" && (
              <img
                src={slideData.sidePanelImage.__image_url__}
                alt={slideData.sidePanelImage.__image_prompt__}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PanelListWithMedia;
