import * as z from "zod";

export const slideLayoutId = "media-and-text-split";
export const slideLayoutName = "Media and Text Split";
export const slideLayoutDescription =
  "A split composition with a title and media block on the left and supporting narrative plus footer text on the right.";

export const Schema = z
  .object({
    title: z
      .string()
      .max(16)
      .meta({
        description: "Left panel heading.",
      })
      .default("Overview"),
    sidePanelMode: z.enum(["solid", "image"]).default("image").meta({
      description: "Left media panel mode.",
    }),
    sidePanelColor: z.string().max(20).default("#d3d0bc").meta({
      description: "Left media color used in solid mode.",
    }),
    sidePanelImage: z
      .object({
        __image_url__: z
          .string()
          .default(
            "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80"
          ),
        __image_prompt__: z.string().default("Glass skyscraper perspective"),
      })
      .meta({
        description: "Left media image used in image mode.",
      }),
    headline: z
      .string()

      .max(50)
      .default(
        "This is a sample text to tell story for audience is written here"
      )
      .meta({
        description: "Main headline text on the right.",
      }),
    body: z
      .string()

      .max(128)
      .default(
        "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alUt enim ad minima veniam."
      )
      .meta({
        description: "Supporting paragraph text.",
      }),
    footerText: z.string().max(28).default("Footer text").meta({
      description: "Footer text at the bottom-right.",
    }),
  })
  .default({
    title: "Overview",
    sidePanelMode: "image",
    sidePanelColor: "#d3d0bc",
    sidePanelImage: {
      __image_url__:
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80",
      __image_prompt__: "Glass skyscraper perspective",
    },
    headline:
      "This is a sample text to tell story for audience is written here",
    body: "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alUt enim ad minima veniam.",
    footerText: "Footer text",
  });

export type SchemaType = z.infer<typeof Schema>;

const MediaAndTextSplit = ({ data }: { data: Partial<SchemaType> }) => {
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
        <h2
          className="px-[38px] pt-[48px]  text-[100px] leading-none tracking-[-0.02em]"
          style={{
            color: "var(--background-text,#dddac7)",
          }}
        >
          {slideData.title}
        </h2>
        <div className="flex   items-center mt-[30px]">
          <div
            className=" w-[572px] h-[542px]"
            style={{
              backgroundColor:
                slideData.sidePanelMode === "solid"
                  ? slideData.sidePanelColor
                  : "transparent",
            }}
          >
            {slideData.sidePanelMode === "image" && (
              <img
                src={slideData.sidePanelImage.__image_url__}
                alt={slideData.sidePanelImage.__image_prompt__}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="px-[66px]  flex-1 mt-[31px] flex flex-col  h-full">
            <div className="flex-1">
              <h3
                className="max-w-[610px] text-[32px] leading-[1.08]"
                style={{ color: "var(--background-text,#d7d3be)" }}
              >
                {slideData.headline}
              </h3>
              <p
                className="mt-[34px] max-w-[610px] text-[22px] leading-[1.16]"
                style={{ color: "var(--background-text,#cbc7b2)" }}
              >
                {slideData.body}
              </p>
            </div>
            <p
              className="mt-[100px] text-[34px] leading-none"
              style={{ color: "var(--background-text,#dddac7)" }}
            >
              {slideData.footerText}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default MediaAndTextSplit;
