import * as z from "zod";

export const slideLayoutId = "numbered-multi-column-overview";
export const slideLayoutName = "Numbered Multi-Column Overview";
export const slideLayoutDescription =
  "A multi-column layout with numbered markers, short titles, and descriptive body text.";

const ColumnSchema = z.object({
  marker: z.string().max(2).meta({
    description: "Circular marker value.",
  }),
  title: z.string().max(14).meta({
    description: "Column title.",
  }),
  description: z.string().max(118).meta({
    description: "Column description paragraph.",
  }),
  highlighted: z.boolean().default(false).meta({
    description: "Whether marker circle is filled.",
  }),
});

export const Schema = z.object({
  title: z.string().max(16).default("Overview").meta({
    description: "Main heading text.",
  }),
  items: z
    .array(ColumnSchema)

    .max(4)
    .default([
      {
        marker: "1",
        title: "Heading 1",
        description:
          "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alUt enim.",
        highlighted: true,
      },
      {
        marker: "2",
        title: "Heading 2",
        description:
          "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alUt enim.",
        highlighted: false,
      },
      {
        marker: "3",
        title: "Heading 3",
        description:
          "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alUt enim.",
        highlighted: false,
      },
      // { marker: "4", title: "Heading 4", description: "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alUt enim.", highlighted: false },
    ])
    .meta({
      description: "Columns rendered across the slide.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const NumberedMultiColumnOverview = ({
  data,
}: {
  data: Partial<SchemaType>;
}) => {
  const slideData = data as SchemaType;
  const columns = slideData.items.length;

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
        <div className="px-[48px] pt-[72px]">
          <h2
            className=" text-[100px] leading-none tracking-[-0.02em]"
            style={{
              color: "var(--background-text,#dddac7)",
              fontFamily: "var(--heading-font-family,'DM Serif Display')",
            }}
          >
            {slideData.title}
          </h2>
        </div>

        <div
          className="px-[48px] pt-[54px] grid gap-[26px]"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {slideData.items.map((column, index) => (
            <div key={`${column.title}-${index}`}>
              <div
                className="flex h-[70px] w-[70px] items-center justify-center rounded-full border text-[29px] font-semibold leading-none"
                style={{
                  borderColor: column.highlighted
                    ? "var(--primary-color,#dddac7)"
                    : "var(--primary-color,#8d8a7d)",
                  color: column.highlighted
                    ? "var(--primary-text,#27292d)"
                    : "var(--background-text,#dddac7)",
                  backgroundColor: column.highlighted
                    ? "var(--primary-color,#dddac7)"
                    : "transparent",
                }}
              >
                {column.marker}
              </div>

              <p
                className="mt-[28px] text-[32px] leading-none"
                style={{ color: "var(--background-text,#d7d3be)" }}
              >
                {column.title}
              </p>

              <p
                className="mt-[34px] text-[22px] leading-[1.14]"
                style={{ color: "var(--background-text,#cbc7b2)" }}
              >
                {column.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default NumberedMultiColumnOverview;
