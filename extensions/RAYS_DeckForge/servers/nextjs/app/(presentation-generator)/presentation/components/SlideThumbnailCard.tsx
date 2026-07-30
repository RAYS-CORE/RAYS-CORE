import React, { forwardRef } from "react";
import type { Slide } from "../../types/slide";
import { V1ContentRender } from "../../components/V1ContentRender";

interface SlideThumbnailCardProps extends React.HTMLAttributes<HTMLDivElement> {
  slide: Slide;
  index: number;
  selected: boolean;
}

const SCALE = 0.061;

export const SlideThumbnailCard = forwardRef<
  HTMLDivElement,
  SlideThumbnailCardProps
>(({ slide, index, selected, className = "", style, ...props }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        backgroundColor: "var(--card-color, #ffffff)",
        borderColor: selected ? "#5141e5" : "var(--stroke, #e5e7eb)",
        ...style,
      }}
      className={`cursor-pointer border relative p-1.5 rounded-[12px] overflow-hidden transition-all duration-200 ${
        selected ? "border-[#BDB4FE]" : "border-[#EDEEEF]"
      } ${className}`}
      {...props}
    >
      <p className="pointer-events-none absolute -left-1 top-1/2 z-50 flex h-[18px] min-w-[18px] -translate-y-1/2 items-center justify-center rounded-full border border-[#EDEEEF] bg-card px-1 text-[10px] font-medium text-[#191919] shadow-sm">
        {index + 1}
      </p>

      <div
        className="relative"
        style={{ height: `${720 * SCALE}px`, overflow: "hidden" }}
      >
        <div
          className="absolute top-0 left-0 rounded-[10px] overflow-hidden pointer-events-none"
          style={{
            width: 1280,
            height: 720,
            transformOrigin: "top left",
            transform: `scale(${SCALE})`,
          }}
        >
          <V1ContentRender slide={slide} isEditMode={true} />
        </div>
      </div>
    </div>
  );
});

SlideThumbnailCard.displayName = "SlideThumbnailCard";
