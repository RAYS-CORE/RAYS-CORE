import React from "react";
import * as z from "zod";
import { ImageSchema, IconSchema } from "../defaultSchemes";
import { RemoteSvgIcon } from "@/app/hooks/useRemoteSvgIcon";

export const layoutId = "bullet-with-icons";
export const layoutName = "Bullet With Icons Slide Layout";
export const layoutDescription = "Bullets with icons slide layout";
const bulletWithIconsSlideSchema = z.object({
  title: z.string().min(3).max(20).default("Problem").meta({
    description: "Main title of the problem statement slide",
  }),
  description: z
    .string()
    .min(50)
    .max(200)
    .default(
      "A problem needs to be discussed further and in detail because this problem is the main foundation in the initial development of a product, service, and decision making. Without a well-defined problem, it will have an impact on a job that is unfocused, unmanaged, and less relevant.",
    )
    .meta({
      description: "Main content text describing the problem statement",
    }),
  problemCategories: z
    .array(
      z.object({
        title: z.string().min(3).max(30).meta({
          description: "Title of the problem category",
        }),
        description: z.string().min(20).max(100).meta({
          description: "Description of the problem category",
        }),
        icon: IconSchema.optional().meta({
          description: "Optional icon for the problem category",
        }),
      }),
    )
    .min(2)
    .max(3)
    .default([
      {
        title: "Inefficiency",
        description:
          "Businesses struggle to find digital tools that meet their needs, causing operational slowdowns.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg",
          __icon_query__: "warning alert inefficiency",
        },
      },
      {
        title: "High Costs",
        description:
          "Outdated systems increase expenses, while small businesses struggle to expand their market reach.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/fediverse-logo-bold.svg",
          __icon_query__: "trending up costs chart",
        },
      },
      {
        title: "Inefficiency",
        description:
          "Businesses struggle to find digital tools that meet their needs, causing operational slowdowns.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/video-bold.svg",
          __icon_query__: "warning alert inefficiency",
        },
      },
      {
        title: "Inefficiency",
        description:
          "Businesses struggle to find digital tools that meet their needs, causing operational slowdowns.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/users-four-bold.svg",
          __icon_query__: "warning alert inefficiency",
        },
      },
    ])
    .meta({
      description:
        "List of problem categories with titles, descriptions, and optional icons",
    }),


});

export const Schema = bulletWithIconsSlideSchema;

export type BulletWithIconsSlideData = z.infer<
  typeof bulletWithIconsSlideSchema
>;

interface BulletWithIconsSlideLayoutProps {
  data?: Partial<BulletWithIconsSlideData>;
}

const BulletWithIconsSlideLayout = ({
  data: slideData,
}: BulletWithIconsSlideLayoutProps) => {
  const problemCategories = slideData?.problemCategories || [];

  return (
    <>
      {/* Import fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className="w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden"
        style={{
          fontFamily: "var(--heading-font-family,Montserrat)",
          backgroundColor: "var(--background-color, #FFFFFF)",
        }}
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

        {/* Main content area */}
        <div className="flex h-full px-16 pb-16">
          {/* Left side - Main Problem */}
          <div className="flex-1 pr-16 flex flex-col justify-center">
            <div className="flex flex-col items-start justify-center h-full">
              <h2 className="text-5xl font-bold mb-8 leading-tight text-left" style={{ color: 'var(--background-text, #234CD9)' }}>
                {slideData?.title}
              </h2>

              <div className="text-lg leading-relaxed font-normal mb-12 max-w-lg text-left" style={{ color: 'var(--background-text, #234CD9)' }}>
                {slideData?.description}
              </div>
            </div>
          </div>

          {/* Right side - Problem Categories with Icons */}
          <div className="flex-1 pl-16 flex flex-col justify-center">
            <div className="w-full max-w-xl mx-auto grid grid-cols-1 gap-8">
              {problemCategories.map((category, index) => (
                <div
                  key={index}
                  className="flex items-start gap-5 rounded-lg p-5"
                  style={{ backgroundColor: 'var(--card-color, #F5F8FE)' }}
                >
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                    {category.icon?.__icon_url__ ? (
                      <RemoteSvgIcon
                        url={category.icon.__icon_url__}
                        strokeColor={"var(--background-text, #234CD9)"}
                        className="w-12 h-12"
                        color="var(--primary-color, #1E4CD9)"
                        title={category.icon.__icon_query__}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full opacity-40" style={{ backgroundColor: 'var(--background-text, #111827)' }} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1" style={{ color: 'var(--background-text, #234CD9)' }}>
                      {category.title}
                    </h3>
                    <p className="text-sm leading-relaxed max-w-md" style={{ color: 'var(--background-text, #234CD9)' }}>
                      {category.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom border line */}
        <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: 'var(--primary-color, #1E4CD9)' }}></div>
      </div>
    </>
  );
};

export default BulletWithIconsSlideLayout;
