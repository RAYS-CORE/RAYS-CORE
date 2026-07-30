"use client";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import "../../utils/prism-languages";
import { Skeleton } from "@/components/ui/skeleton";
import PresentationMode from "./PresentationMode";
import SidePanel from "./SidePanel";
import SlideContent from "./SlideContent";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import {
  usePresentationStreaming,
  usePresentationData,
  usePresentationNavigation,
  useAutoSave,
} from "../hooks";
import { PresentationPageProps } from "../types";
import LoadingState from "./LoadingState";
import { applyPresentationThemeToElement } from "../utils/applyPresentationThemeDom";

import PresentationHeader from "./PresentationHeader";
import Chat from "./Chat";

const PresentationPage: React.FC<PresentationPageProps> = ({
  presentation_id,
}) => {
  const pathname = usePathname();
  // State management
  const [loading, setLoading] = useState(true);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState(false);
  const slidesScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();



  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );
  const slidesLength = presentationData?.slides?.length ?? 0;
  const lastStreamingSlideIndex =
    slidesLength > 0
      ? presentationData?.slides?.[slidesLength - 1]?.index
      : undefined;

  // Auto-save functionality
  const { isSaving } = useAutoSave({
    debounceMs: 2000,
    enabled: !!presentationData && !isStreaming,
  });

  // Custom hooks
  const { fetchUserSlides } = usePresentationData(
    presentation_id,
    setLoading,
    setError
  );

  const {
    isPresentMode,
    stream,
    currentSlide: presentSlideFromUrl,
    handleSlideClick,
    toggleFullscreen,
    handlePresentExit,
    handleSlideChange,
  } = usePresentationNavigation(
    presentation_id,
    selectedSlide,
    setSelectedSlide,
    setIsFullscreen
  );

  // Initialize streaming
  usePresentationStreaming(
    presentation_id,
    stream,
    setLoading,
    setError,
    fetchUserSlides
  );

  useEffect(() => {
    if (!isStreaming) return;

    const scrollContainer = slidesScrollContainerRef.current;
    if (!scrollContainer) return;

    const frame = window.requestAnimationFrame(() => {
      if (slidesLength <= 1) {
        scrollContainer.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

      if (lastStreamingSlideIndex === undefined) return;

      const slideElement = document.getElementById(
        `slide-${lastStreamingSlideIndex}`
      );
      if (!slideElement) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const slideRect = slideElement.getBoundingClientRect();
      const slideTop =
        slideRect.top - containerRect.top + scrollContainer.scrollTop;

      scrollContainer.scrollTo({
        top: Math.max(slideTop, 0),
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isStreaming, lastStreamingSlideIndex, slidesLength]);



  /** Editor tree unmounts in present mode; remount loses inline theme CSS — re-apply from Redux. */
  useLayoutEffect(() => {
    if (isPresentMode) return;
    const theme = presentationData?.theme;
    if (!theme) return;
    const el = document.getElementById("presentation-slides-wrapper");
    applyPresentationThemeToElement(el, theme);
  }, [isPresentMode, presentationData?.theme]);

  const onSlideChange = (newSlide: number) => {
    handleSlideChange(newSlide, presentationData);
  };


  // Presentation Mode View
  if (isPresentMode) {
    return (
      <PresentationMode
        slides={presentationData?.slides!}
        currentSlide={presentSlideFromUrl}
        theme={presentationData?.theme ?? undefined}
        isFullscreen={isFullscreen}
        onFullscreenToggle={toggleFullscreen}
        onExit={handlePresentExit}
        onSlideChange={onSlideChange}
      />
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen" style={{ background: '#000000', fontFamily: "'Space Mono', monospace" }}>
        <div
          className="px-6 py-8 rounded-[10px] flex flex-col items-center"
          role="alert"
          style={{ background: '#1d1d1d', border: '1px solid #383838' }}
        >
          <AlertCircle className="w-16 h-16 mb-4" style={{ color: '#888888' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: '#ffffff' }}>Something went wrong</h2>
          <p className="text-center mb-4" style={{ color: '#888888' }}>
            We couldn't load your presentation. Please try again.
          </p>
          <div className="flex gap-2 justify-center items-center">

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden" style={{ fontFamily: "'Space Mono', monospace" }}>
      <div
        style={{
          background: "#000000",
        }}
        id="presentation-slides-wrapper"
        className="relative flex h-full flex-col overflow-hidden"
      >
        <PresentationHeader presentation_id={presentation_id} isPresentationSaving={isSaving} currentSlide={selectedSlide} />
        <div className="flex flex-1 min-h-0 gap-6 overflow-hidden">
          <div className="w-[120px] h-full shrink-0 self-start sticky top-0 pt-[18px]">
            <SidePanel
              selectedSlide={selectedSlide}
              onSlideClick={handleSlideClick}
              presentationId={presentation_id}
              loading={loading}
            />
          </div>
          <div className="w-full min-w-0 h-full flex-1 pt-[18px]">
            <div
              ref={slidesScrollContainerRef}
              className="font-inter h-full overflow-y-auto hide-scrollbar scroll-pt-[18px]"
            >
              <div className="w-full max-w-[1280px] min-h-full mx-auto flex flex-col items-center pb-8">
                {!presentationData ||
                  loading ||
                  !presentationData?.slides ||
                  presentationData?.slides.length === 0 ? (
                  <div className="relative w-full h-[calc(100vh-120px)] mx-auto hide-scrollbar">
                    <div className="">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <Skeleton
                          key={index}
                          className="aspect-video bg-secondary my-4 w-full mx-auto "
                        />
                      ))}
                    </div>
                    {stream && <LoadingState />}
                  </div>
                ) : (
                  <>
                    {presentationData &&
                      presentationData.slides &&
                      presentationData.slides.length > 0 &&
                      presentationData.slides.map((slide: any, index: number) => (
                        <SlideContent
                          key={`${slide.type}-${index}-${slide.index}`}
                          slide={slide}
                          index={index}
                          presentationId={presentation_id}
                        />
                      ))}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="w-full max-w-[370px] h-full shrink-0 self-start sticky top-0">
            <Chat
              presentationId={presentation_id}
              currentSlide={selectedSlide}
              onPresentationChanged={() => fetchUserSlides({ clearHistory: false })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationPage;
