import * as z from "zod";

export const slideLayoutId = "headline-with-detail-columns";
export const slideLayoutName = "Headline with Detail Columns";
export const slideLayoutDescription =
  "A layout with a large headline and detail columns containing markers, text, and bullets.";

const SectionSchema = z.object({
  number: z.string().max(2).meta({
    description: "Numeric marker value.",
  }),
  title: z.string().max(16).meta({
    description: "Section title.",
  }),
  description: z.string().max(150).meta({
    description: "Section paragraph.",
  }),
  bullets: z.array(z.string().max(40)).max(4).meta({
    description: "Bullet list content.",
  }),
  highlighted: z.boolean().default(false).meta({
    description: "Whether the top marker is filled.",
  }),
});

export const Schema = z.object({
  title: z.string().max(24).default("Focus Areas").meta({
    description: "Large left-side heading.",
  }),
  sections: z
    .array(SectionSchema)

    .max(2)
    .default([
      {
        number: "1",
        title: "Column A",
        description:
          "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alUt enim ad minima veniam.",
        bullets: [
          "Ut enim ad minima veniam, quis nostrum",
          "Exercitationem ullam corporis suscipit",
          "Laboriosam, nisi ut alUt enim ad minima",
        ],
        highlighted: true,
      },
      {
        number: "2",
        title: "Column B",
        description:
          "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alUt enim ad minima veniam.",
        bullets: [
          "Ut enim ad minima veniam, quis nostrum",
          "Exercitationem ullam corporis suscipit",
          "Laboriosam, nisi ut alUt enim ad minima",
        ],
        highlighted: false,
      },
    ])
    .meta({
      description: "Right-side detail columns.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const HeadlineWithDetailColumns = ({ data }: { data: Partial<SchemaType> }) => {
  const slideData = data as SchemaType;

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
        <div className="grid h-full grid-cols-[35%_34%_34%] gap-x-[8px] px-[36px] pt-[48px]">
          <h2
            className="whitespace-pre-line font-serif text-[100px] leading-[0.94] tracking-[-0.02em]"
            style={{ color: "var(--background-text,#dddac7)" }}
          >
            {slideData.title}
          </h2>

          {slideData.sections.map((section, index) => (
            <div key={`${section.title}-${index}`} className="pr-[20px]">
              <div
                className="flex h-[70px] w-[70px] border rounded-full items-center justify-center text-[30px] font-semibold "
                style={{
                  borderColor: section.highlighted
                    ? "var(--primary-color,#dddac7)"
                    : "var(--primary-color,#dddac7)",
                  color: section.highlighted
                    ? "var(--primary-text,#27292d)"
                    : "var(--background-text,#dddac7)",
                  backgroundColor: section.highlighted
                    ? "var(--primary-color,#dddac7)"
                    : "transparent",
                }}
              >
                {section.number}
              </div>

              <p
                className="mt-[20px] text-[32px] leading-none"
                style={{ color: "var(--background-text,#d7d3be)" }}
              >
                {section.title}
              </p>

              <p
                className="mt-[20px] text-[22px] leading-[1.15]"
                style={{ color: "var(--background-text,#cbc7b2)" }}
              >
                {section.description}
              </p>

              <div
                className="mt-[26px]  space-y-[2px] pl-[16px] text-[22px] leading-[1.14]"
                style={{ color: "var(--background-text,#d7d3be)" }}
              >
                {section.bullets.map((bullet, bulletIndex) => (
                  <p
                    key={`${section.title}-bullet-${bulletIndex}`}
                    className="flex gap-2 items-start"
                  >
                    <p
                      className="w-1 h-1 rounded-full mt-3  "
                      style={{
                        background: "var(--background-text,#ffffff)",
                      }}
                    />
                    <p>{bullet}</p>
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default HeadlineWithDetailColumns;
