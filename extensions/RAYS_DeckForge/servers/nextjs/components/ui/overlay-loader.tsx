import { cn } from "@/lib/utils"
import { ProgressBar } from "./progress-bar"
import { useEffect, useState } from "react"

interface OverlayLoaderProps {
    text?: string
    className?: string
    show: boolean
    showProgress?: boolean
    duration?: number
    extra_info?: string
    onProgressComplete?: () => void
}

export const OverlayLoader = ({
    text,
    className,
    show,
    showProgress = false,
    duration = 10,
    onProgressComplete,
    extra_info
}: OverlayLoaderProps) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (show) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [show]);

    if (!show) return null;

    return (
        <div
            style={{
                zIndex: 1000
            }}
            className={cn(
                "fixed inset-0 bg-black/70 z-50 flex items-center justify-center transition-opacity duration-300",
                isVisible ? "opacity-100" : "opacity-0"
            )}
        >
            <div
                className={cn(
                    "flex flex-col items-center justify-center px-6 pt-6 pb-10 rounded-[10px] bg-[#1d1d1d] shadow-2xl relative min-h-[347px]",
                    "min-w-[280px] sm:min-w-[447px] border border-[#383838] transition-all duration-400 ease-out",
                    isVisible ? "opacity-100 scale-100" : "opacity-0 scale-90",
                    className
                )}

            >
                <div
                    className="overlay-loader-dots shrink-0"
                    role="status"
                    aria-label="Loading"
                />
                {showProgress ? (
                    <div className="w-full space-y-6 pt-4">
                        <ProgressBar
                            duration={duration}
                            onComplete={onProgressComplete}
                        />
                        {text && (
                            <div className="space-y-1">
                                <p className="text-[#ffffff] text-base text-center font-medium font-inter">
                                    {text}
                                </p>
                                {extra_info && <p className="text-[#888888] text-xs text-center font-medium font-inter">{extra_info}</p>}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <p className="text-[#ffffff] text-base text-center font-medium font-inter">
                            {text}
                        </p>
                        {extra_info && <p className="text-[#888888] text-xs text-center font-medium font-inter">{extra_info}</p>}
                    </>
                )}
                {/* SVG removed to match 099 style guide */}
            </div>

            <style jsx>{`
                .overlay-loader-dots {
                    width: 50px;
                    aspect-ratio: 1;
                    --_c: no-repeat radial-gradient(
                        farthest-side,
                        #ffffff 92%,
                        #0000
                    );
                    background:
                        var(--_c) top,
                        var(--_c) left,
                        var(--_c) right,
                        var(--_c) bottom;
                    background-size: 12px 12px;
                    animation: overlay-loader-l7 1s infinite;
                }
                @keyframes overlay-loader-l7 {
                    to {
                        transform: rotate(0.5turn);
                    }
                }
            `}</style>
        </div>
    )
} 