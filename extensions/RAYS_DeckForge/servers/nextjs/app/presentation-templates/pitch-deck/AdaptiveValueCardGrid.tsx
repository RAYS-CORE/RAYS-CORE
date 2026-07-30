import { RemoteSvgIcon } from "@/app/hooks/useRemoteSvgIcon";
import * as z from "zod";

export const slideLayoutId = "adaptive-value-card-grid";
export const slideLayoutName = "Adaptive Value Card Grid";
export const slideLayoutDescription =
  "A card grid that supports even layouts and odd-count variants with an emphasized trailing card.";

const ValueCardSchema = z.object({
  value: z.string().max(6).meta({
    description: "Primary card value text.",
  }),
  label: z.string().max(28).meta({
    description: "Secondary label under the card.",
  }),
  icon: z.object({
    __icon_url__: z.string(),
    __icon_query__: z.string(),
  }),
});

export const Schema = z.object({
  title: z.string().max(16).default("Highlights").meta({
    description: "Top-left heading.",
  }),
  items: z
    .array(ValueCardSchema)

    .max(8)
    .default([
      {
        value: "X 5",
        label: "Lorem ipsum dolor sit.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        value: "X 5",
        label: "Lorem ipsum dolor sit.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        value: "X 5",
        label: "Lorem ipsum dolor sit.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        value: "X 5",
        label: "Lorem ipsum dolor sit.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        value: "X 5",
        label: "Lorem ipsum dolor sit.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        value: "X 5",
        label: "Lorem ipsum dolor sit.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        value: "X 5",
        label: "Lorem ipsum dolor sit.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      // {
      //   value: "X 5", label: "Lorem ipsum dolor sit.", icon: {
      //     __icon_url__:
      //       "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
      //     __icon_query__: "check icon",
      //   }
      // },
    ])
    .meta({
      description: "Value cards displayed in an adaptive grid.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const RIGHT_RATIO_BY_ODD_COUNT: Record<number, string> = {
  3: "49%",
  5: "33%",
  7: "29%",
};

function Card({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: any;
}) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center border text-center p-[11px]"
      style={{
        borderColor: "var(--border-color,#8d8a7d)",
        color: "var(--background-text,#d7d3be)",
      }}
    >
      <div className="flex items-center gap-[14px]">
        <span
          className="inline-flex items-center justify-center rounded-full"
          style={{
            width: 56,
            height: 56,
            backgroundColor: "var(--primary-color,#dddac7)",
            color: "var(--background-color,#27292d)",
          }}
        >
          {/* <img
            src={icon.__icon_url__}
            alt={icon.__icon_query__}
            className="w-7 h-7"
          /> */}
          <RemoteSvgIcon
            url={icon.__icon_url__}
            className="w-7 h-7"
            strokeColor={"currentColor"}
            color="var(--primary-text,#27292d)"
            title={icon.__icon_query__}
          />
        </span>
        <p className="text-[45px] font-semibold leading-none tracking-[0.01em]">
          {value}
        </p>
      </div>
      <p
        className="mt-[14px]  text-[30px] leading-[1.06]"
        style={{ color: "var(--background-text,#d7d3be)" }}
      >
        {label}
      </p>
    </div>
  );
}

const AdaptiveValueCardGrid = ({ data }: { data: Partial<SchemaType> }) => {
  const slideData = data as SchemaType;
  const count = slideData.items.length;
  const isOdd = count % 2 === 1;

  const leftCards = isOdd ? slideData.items.slice(0, -1) : slideData.items;
  const rightTallCard = isOdd
    ? slideData.items[slideData.items.length - 1]
    : null;

  const evenColumns = Math.max(2, Math.min(4, count / 2));
  const oddLeftColumns = Math.max(1, Math.ceil(leftCards.length / 2));
  const rightRatio = RIGHT_RATIO_BY_ODD_COUNT[count] ?? "33%";

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
              color: "var(--background-text,#d7d3be)",
              fontFamily: "var(--heading-font-family,'DM Serif Display')",
            }}
          >
            {slideData.title}
          </h2>
        </div>

        {!isOdd && (
          <div
            className="absolute left-[36px] right-[36px] top-[200px] grid gap-[21px]"
            style={{
              gridTemplateColumns: `repeat(${evenColumns}, minmax(0, 1fr))`,
              gridAutoRows: "236px",
            }}
          >
            {slideData.items.map((card, index) => (
              <Card
                key={`${card.value}-${index}`}
                value={card.value}
                label={card.label}
                icon={card.icon}
              />
            ))}
          </div>
        )}

        {isOdd && rightTallCard && (
          <div
            className="absolute left-[36px] right-[36px] top-[200px] grid h-[490px] gap-[21px]"
            style={{ gridTemplateColumns: `minmax(0, 1fr) ${rightRatio}` }}
          >
            <div
              className="grid gap-[18px]"
              style={{
                gridTemplateColumns: `repeat(${oddLeftColumns}, minmax(0, 1fr))`,
                gridAutoRows: "236px",
              }}
            >
              {leftCards.map((card, index) => (
                <Card
                  key={`${card.value}-${index}`}
                  value={card.value}
                  label={card.label}
                  icon={card.icon}
                />
              ))}
            </div>

            <Card
              value={rightTallCard.value}
              label={rightTallCard.label}
              icon={rightTallCard.icon}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default AdaptiveValueCardGrid;
