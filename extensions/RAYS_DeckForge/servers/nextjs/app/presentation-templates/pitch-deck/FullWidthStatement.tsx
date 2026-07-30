import * as z from "zod";

export const slideLayoutId = "full-width-statement";
export const slideLayoutName = "Full-Width Statement";
export const slideLayoutDescription =
  "A minimalist emphasis layout with a compact label and a large full-width statement block.";

export const Schema = z.object({
  label: z.string().max(12).default("Label").meta({
    description: "Small label above the statement.",
  }),
  statement: z
    .string()

    .max(90)
    .default(
      "This is a sample statement used for placeholder content in presentations. This is a sample statement used for placeholder"
    )
    .meta({
      description: "Main statement text, with max 90 characters.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const FullWidthStatement = ({ data }: { data: Partial<SchemaType> }) => {
  const slideData = data as SchemaType;

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap"
        rel="stylesheet"
      />

      <div
        className="relative h-[720px] w-[1280px] flex flex-col justify-end pb-[74px] overflow-hidden "
        style={{
          backgroundColor: "var(--background-color,#27292d)",
          fontFamily: "var(--body-font-family,'DM Serif Display')",
        }}
      >
        <div className="px-[46px] ">
          <p
            className="text-[32px] leading-none"
            style={{ color: "var(--background-text,#d7d3be)" }}
          >
            {slideData.label}
          </p>

          <p
            className="mt-[61px]  text-[100px] leading-[100%]"
            style={{
              color: "var(--background-text,#dddac7)",
            }}
          >
            {slideData.statement}”
          </p>
        </div>
      </div>
    </>
  );
};

export default FullWidthStatement;
