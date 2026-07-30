"use client";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import "@/app/(presentation-generator)/utils/prism-languages";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { setPresentationData } from "@/store/slices/presentationGeneration";
import { DashboardApi } from "@/app/(presentation-generator)/services/api/dashboard";
import { ApiResponseHandler } from "@/app/(presentation-generator)/services/api/api-error-handler";
import { useFontLoader } from "@/app/(presentation-generator)/hooks/useFontLoad";
import { Theme } from "@/app/(presentation-generator)/services/api/types";
import SlideScale from "@/app/(presentation-generator)/components/PresentationRender";

const PDF_PRINT_STYLE = `
  @media print {
    #presentation-slides-wrapper {
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }

    #presentation-slides-wrapper > div > div {
      padding-top: 0 !important;
    }

    #presentation-slides-wrapper .main-slide {
      margin: 0 !important;
      break-after: page;
      page-break-after: always;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    #presentation-slides-wrapper .main-slide:last-child {
      break-after: auto;
      page-break-after: auto;
    }
  }
`;

type PresentationPageProps = {
  presentation_id: string;
  exportCookie?: string;
};

const PresentationPage = ({ presentation_id, exportCookie }: PresentationPageProps) => {
  const pathname = usePathname();
  const [contentLoading, setContentLoading] = useState(true);
  const exportCookieFromHash =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.hash.replace(/^#/, "")).get(
          "exportCookie"
        ) ?? undefined
      : undefined;
  const effectiveExportCookie = exportCookie ?? exportCookieFromHash;

  const dispatch = useDispatch();
  const { presentationData } = useSelector(
    (state: RootState) => state.presentationGeneration
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (presentationData?.slides?.[0]?.layout?.includes("custom")) {
      const existingScript = document.querySelector(
        'script[src*="tailwindcss.com"]'
      );
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://cdn.tailwindcss.com";
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, [presentationData]);
  useEffect(() => {
    fetchUserSlides();
  }, []);

  const fetchUserSlides = async () => {
    try {
      const data = effectiveExportCookie
        ? await fetchPresentationForExport(presentation_id, effectiveExportCookie)
        : await DashboardApi.getPresentation(presentation_id);
      dispatch(setPresentationData(data));

      if (data.fonts) {
        useFontLoader(data.fonts);
      }
      if (data?.theme) {
        try {
          applyTheme(data.theme);
        } catch (themeError) {
          // Theme issues should not block export rendering.
          console.warn("Theme application skipped for pdf-maker:", themeError);
        }
      }
    } catch (error) {
      setError(true);
      toast.error("Failed to load presentation");
      console.error("Error fetching user slides:", error);
    } finally {
      setContentLoading(false);
    }
  };

  const fetchPresentationForExport = async (
    id: string,
    cookieHeader: string
  ) => {
    const response = await fetch(`/api/export-presentation-data/${id}`, {
      method: "GET",
      headers: {
        "x-export-cookie": cookieHeader,
      },
      cache: "no-store",
    });

    return ApiResponseHandler.handleResponse(
      response,
      "Presentation not found"
    );
  };

  const applyTheme = (theme: Theme) => {
    const element = document.getElementById("presentation-slides-wrapper");
    if (!element) return;
    if (!theme?.data) return;
    if (!theme.data.colors["graph_0"]) return;
    if (!theme.data.fonts?.textFont?.name || !theme.data.fonts?.textFont?.url) return;

    const cssVariables = {
      "--primary-color": theme.data.colors["primary"],
      "--background-color": theme.data.colors["background"],
      "--card-color": theme.data.colors["card"],
      "--stroke": theme.data.colors["stroke"],
      "--primary-text": theme.data.colors["primary_text"],
      "--background-text": theme.data.colors["background_text"],
      "--graph-0": theme.data.colors["graph_0"],
      "--graph-1": theme.data.colors["graph_1"],
      "--graph-2": theme.data.colors["graph_2"],
      "--graph-3": theme.data.colors["graph_3"],
      "--graph-4": theme.data.colors["graph_4"],
      "--graph-5": theme.data.colors["graph_5"],
      "--graph-6": theme.data.colors["graph_6"],
      "--graph-7": theme.data.colors["graph_7"],
      "--graph-8": theme.data.colors["graph_8"],
      "--graph-9": theme.data.colors["graph_9"],
    };

    Object.entries(cssVariables).forEach(([key, value]) => {
      element.style.setProperty(key, value);
    });
    const textFontName = theme.data.fonts.textFont.name;
    const textFontUrl = theme.data.fonts.textFont.url;
    useFontLoader({ [textFontName]: textFontUrl });
    element.style.setProperty("font-family", `"${textFontName}"`);
    element.style.setProperty("--heading-font-family", `"${textFontName}"`);
    element.style.setProperty("--body-font-family", `"${textFontName}"`);
  };

  const slides = presentationData?.slides ?? [];
  const isLoading = contentLoading || slides.length === 0;

  return (
    <div className="flex overflow-hidden flex-col">
      {error ? (
        <div className="flex flex-col items-center justify-center h-screen bg-muted">
          <div
            className="bg-card border border-red-300 text-red-700 px-6 py-8 rounded-lg shadow-lg flex flex-col items-center"
            role="alert"
          >
            <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
            <strong className="font-bold text-4xl mb-2">Oops!</strong>
            <p className="block text-2xl py-2">
              We encountered an issue loading your presentation.
            </p>
            <p className="text-lg py-2">
              Please check your internet connection or try again later.
            </p>
            <Button
              className="mt-4 bg-red-500 text-foreground hover:bg-red-600 focus:ring-4 focus:ring-red-300"
              onClick={() => {
                window.location.reload();
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          <style jsx global>{PDF_PRINT_STYLE}</style>
          <div
            id="presentation-slides-wrapper"
            className="relative mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden"
          >
            {isLoading ? (
              <div className="relative mx-auto h-[calc(100vh-120px)] w-full">
                <div>
                  {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton
                      key={index}
                      className="aspect-video bg-secondary my-4 w-full mx-auto max-w-[1280px]"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex w-full justify-center">
                <div className="w-full pt-[18px]">
                  <div className="font-inter w-full">
                    <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center">
                      {slides.map((slide: any, index: number) => (
                        <div
                          key={`${slide.type}-${index}-${slide.index}`}
                          id={`slide-${slide.index}`}
                          className="main-slide relative flex w-full items-center justify-center max-md:mb-4"
                          data-speaker-note={slide.speaker_note ?? ""}
                        >
                          <div
                            className="group w-full font-syne"
                            data-layout={slide.layout}
                            data-group={slide.layout_group}
                          >
                            <SlideScale
                              slide={slide}
                              theme={presentationData?.theme ?? null}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PresentationPage;
