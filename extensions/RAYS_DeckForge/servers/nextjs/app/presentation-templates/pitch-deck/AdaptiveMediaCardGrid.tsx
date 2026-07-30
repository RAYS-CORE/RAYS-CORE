import * as z from "zod";

export const slideLayoutId = "adaptive-media-card-grid";
export const slideLayoutName = "Adaptive Media Card Grid";
export const slideLayoutDescription =
  "A responsive media-card grid that supports compact and dense arrangements.";

const CardSchema = z.object({
  label: z.string().max(14).meta({
    description: "Small top label shown on each card.",
  }),
  title: z.string().max(18).meta({
    description: "Primary card title.",
  }),
  description: z.string().max(40).meta({
    description: "Short supporting description.",
  }),
  image: z.object({
    __image_url__: z.string().url().meta({
      description: "Image URL for the media card.",
    }),
    __image_prompt__: z.string().meta({
      description: "A short prompt describing the image content.",
    }),
  }),
});

export const Schema = z.object({
  title: z.string().max(16).default("Highlights").meta({
    description: "Top heading text.",
  }),
  cards: z
    .array(CardSchema)

    .max(8)
    .default([
      {
        label: "LEAD",
        title: "Insert Title",
        description: "Ut enim ad minima veniam, quis nostrum",
        image: {
          __image_url__: "https://i.pravatar.cc/800?img=12",
          __image_prompt__: "Media card image",
        },
      },
      {
        label: "LEAD",
        title: "Insert Title",
        description: "Ut enim ad minima veniam, quis nostrum",
        image: {
          __image_url__: "https://i.pravatar.cc/800?img=13",
          __image_prompt__: "Media card image",
        },
      },
      {
        label: "LEAD",
        title: "Insert Title",
        description: "Ut enim ad minima veniam, quis nostrum",
        image: {
          __image_url__: "https://i.pravatar.cc/800?img=14",
          __image_prompt__: "Media card image",
        },
      },
      {
        label: "LEAD",
        title: "Insert Title",
        description: "Ut enim ad minima veniam, quis nostrum",
        image: {
          __image_url__: "https://i.pravatar.cc/800?img=12",
          __image_prompt__: "Media card image",
        },
      },
      {
        label: "LEAD",
        title: "Insert Title",
        description: "Ut enim ad minima veniam, quis nostrum",
        image: {
          __image_url__: "https://i.pravatar.cc/800?img=13",
          __image_prompt__: "Media card image",
        },
      },
      {
        label: "LEAD",
        title: "Insert Title",
        description: "Ut enim ad minima veniam, quis nostrum",
        image: {
          __image_url__: "https://i.pravatar.cc/800?img=14",
          __image_prompt__: "Media card image",
        },
      },
    ])
    .meta({
      description: "Media cards rendered in an adaptive grid.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const CARD_WIDTH_BY_COUNT: Record<number, number> = {
  3: 308,
  4: 227,
  8: 227,
};

const IMAGE_HEIGHT_BY_COUNT: Record<number, number> = {
  3: 301,
  4: 222,
  8: 222,
};

const AdaptiveMediaCardGrid = ({ data }: { data: Partial<SchemaType> }) => {
  const slideData = data as SchemaType;
  const count = slideData.cards.length;

  const columns = count <= 4 ? count : 4;
  const cardWidth = CARD_WIDTH_BY_COUNT[count] ?? 236;
  const imageHeight = IMAGE_HEIGHT_BY_COUNT[count] ?? 224;

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
        <div
          className="px-[42px] "
          style={{
            marginTop: slideData.cards.length > 4 ? "10px" : "72px",
          }}
        >
          <h2
            className="font-serif text-[100px] leading-none tracking-[-0.02em]"
            style={{
              color: "var(--background-text,#dddac7)",
              fontFamily: "var(--heading-font-family,'DM Serif Display')",
            }}
          >
            {slideData.title}
          </h2>
        </div>

        <div
          className="pt-[52px] px-[54px] grid justify-items-start gap-x-[30px] gap-y-[48px]"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {slideData.cards.map((card, index) => (
            <div
              key={`${card.title}-${index}`}
              className="relative"
              style={{ width: cardWidth }}
            >
              <img
                src={card.image.__image_url__}
                alt={card.image.__image_prompt__}
                className="w-full object-cover"
                style={{ height: imageHeight }}
              />

              <div
                className="absolute right-0 -bottom-10 mx-auto  w-[66%] p-[13px] text-center"
                style={{ backgroundColor: "var(--background-color,#27292d)" }}
              >
                <p
                  className="text-[19px] font-bold leading-none"
                  style={{ color: "var(--background-text,#dddac7)" }}
                >
                  {card.label}
                </p>
                <p
                  className="mt-[8px] text-[18px] leading-none"
                  style={{ color: "var(--background-text,#d7d3be)" }}
                >
                  {card.title}
                </p>
                <p
                  className="mt-[10px] text-[12px] "
                  style={{ color: "var(--background-text,#cbc7b2)" }}
                >
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default AdaptiveMediaCardGrid;
