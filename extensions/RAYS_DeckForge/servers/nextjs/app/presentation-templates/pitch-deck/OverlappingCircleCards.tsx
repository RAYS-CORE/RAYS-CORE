import * as z from "zod";

export const slideLayoutId = "overlapping-circle-cards";
export const slideLayoutName = "Overlapping Circle Cards";
export const slideLayoutDescription =
  "A horizontal row of overlapping circular cards with markers, titles, and text.";

const CardSchema = z.object({
  number: z.string().max(2).meta({
    description: "Short card marker.",
  }),
  title: z.string().max(16).meta({
    description: "Card title.",
  }),
  description: z.string().max(132).meta({
    description: "Card description text.",
  }),
});

const DEFAULT_DESCRIPTION =
  "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alUt enim ad minima veniam.";

export const Schema = z.object({
  title: z.string().max(12).default("Cards").meta({
    description: "Main heading text.",
  }),
  items: z
    .array(CardSchema)

    .max(5)
    .default([
      {
        number: "01",
        title: "Insert text here",
        description: DEFAULT_DESCRIPTION,
      },
      {
        number: "02",
        title: "Insert text here",
        description: DEFAULT_DESCRIPTION,
      },
      {
        number: "03",
        title: "Insert text here",
        description: DEFAULT_DESCRIPTION,
      },
      {
        number: "04",
        title: "Insert text here",
        description: DEFAULT_DESCRIPTION,
      },
      {
        number: "05",
        title: "Insert text here",
        description: DEFAULT_DESCRIPTION,
      },
    ])
    .meta({
      description: "Circle cards from left to right.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const CIRCLE_CARD_LAYOUT_BY_COUNT: Record<
  number,
  {
    circleSize: number;
    connectorSize: number;
    overlap: number;
    rowLeft: number;
    rowTop: number;
    numberFontSize: number;
    titleFontSize: number;
    bodyFontSize: number;
    bodyWidth: number;
  }
> = {
  3: {
    circleSize: 384,
    connectorSize: 84,
    overlap: -21,
    rowLeft: 34,
    rowTop: 238,
    numberFontSize: 32,
    titleFontSize: 30,
    bodyFontSize: 20,
    bodyWidth: 250,
  },
  4: {
    circleSize: 318,
    connectorSize: 70,
    overlap: -21,
    rowLeft: 44,
    rowTop: 238,
    numberFontSize: 30,
    titleFontSize: 28,
    bodyFontSize: 18,
    bodyWidth: 214,
  },
  5: {
    circleSize: 272,
    connectorSize: 56,
    overlap: -37,
    rowLeft: 34,
    rowTop: 238,
    numberFontSize: 24,
    titleFontSize: 22,
    bodyFontSize: 16,
    bodyWidth: 172,
  },
};

const getConnectorLeft = (overlap: number, connectorSize: number) =>
  (Math.abs(overlap) - connectorSize) / 2;

const OverlappingCircleCards = ({ data }: { data: Partial<SchemaType> }) => {
  const slideData = data as SchemaType;
  const count = slideData.items.length;
  const layout =
    CIRCLE_CARD_LAYOUT_BY_COUNT[count] ?? CIRCLE_CARD_LAYOUT_BY_COUNT[5];

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
        <div className="px-[36px] pt-[44px]">
          <h2
            className="font-serif text-[100px] leading-none"
            style={{
              color: "var(--background-text,#dddac7)",
              fontFamily: "var(--heading-font-family,'DM Serif Display')",
            }}
          >
            {slideData.title}
          </h2>
        </div>

        <div
          className="absolute flex items-center"
          style={{ left: layout.rowLeft, top: layout.rowTop }}
        >
          {slideData.items.map((item, index) => (
            <div
              key={`${item.number}-${index}`}
              className="relative"
              style={{ marginLeft: index === 0 ? 0 : layout.overlap }}
            >
              {index > 0 && (
                <span
                  className="absolute top-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: getConnectorLeft(
                      layout.overlap,
                      layout.connectorSize
                    ),
                    width: layout.connectorSize,
                    height: layout.connectorSize,
                    backgroundColor: "var(--primary-color,#dddac7)",
                  }}
                />
              )}

              <div
                className="flex flex-col items-center justify-center rounded-full border text-center"
                style={{
                  width: layout.circleSize,
                  height: layout.circleSize,
                  borderColor: "var(--stroke,#dddac7)",
                  borderWidth: 2,
                  color: "var(--background-text,#d7d3be)",
                }}
              >
                <p
                  className="font-semibold leading-none"
                  style={{
                    fontSize: layout.numberFontSize,
                    color: "var(--background-text,#dddac7)",
                  }}
                >
                  {item.number}
                </p>
                <p
                  className="mt-[16px] leading-none"
                  style={{
                    fontSize: layout.titleFontSize,
                    color: "var(--background-text,#d7d3be)",
                  }}
                >
                  {item.title}
                </p>
                <p
                  className="mt-[12px] leading-[1.15]"
                  style={{
                    width: layout.bodyWidth,
                    color: "var(--background-text,#cbc7b2)",
                    fontSize: layout.bodyFontSize,
                  }}
                >
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default OverlappingCircleCards;
