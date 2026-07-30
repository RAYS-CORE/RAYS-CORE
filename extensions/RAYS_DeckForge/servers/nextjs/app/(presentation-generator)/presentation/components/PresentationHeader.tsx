"use client";
import { Button } from "@/components/ui/button";
import {
  Play,
  Loader2,
  Redo2,
  Undo2,
  RotateCcw,
  ArrowRightFromLine,
  ArrowUpRight,
  Pencil,
  Check,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { resolveBackendAssetUrl } from "@/utils/api";
import { useDispatch, useSelector } from "react-redux";


import { RootState } from "@/store/store";
import { toast } from "sonner";
import { usePresentationUndoRedo } from "../hooks/PresentationUndoRedo";
import ToolTip from "@/components/ToolTip";
import {
  clearPresentationData,
  updateTitle,
} from "@/store/slices/presentationGeneration";
import { clearHistory } from "@/store/slices/undoRedoSlice";
import { Separator } from "@/components/ui/separator";
import ThemeSelector from "./ThemeSelector";
import { DEFAULT_THEMES } from "../../(dashboard)/theme/components/ThemePanel/constants";
import ThemeApi from "../../services/api/theme";
import { Theme } from "../../services/api/types";
import MarkdownRenderer from "@/components/MarkDownRender";
import { cn } from "@/lib/utils";

const MAX_EXPORT_TITLE_LENGTH = 40;

const buildSafeExportFileName = (
  rawTitle: string | null | undefined,
  extension: "pdf" | "pptx"
) => {
  const normalizedTitle = (rawTitle || "presentation").trim();
  const titleWithoutExtension = normalizedTitle.replace(
    /\.(pdf|pptx)$/i,
    ""
  );

  let safeBase = titleWithoutExtension
    // Replace all punctuation/special chars (including dots) with dashes
    .replace(/[^a-zA-Z0-9\s_-]+/g, "-")
    // Replace whitespace with single dashes
    .replace(/\s+/g, "-")
    // Collapse repeated separators
    .replace(/[-_]{2,}/g, "-")
    // Trim separators from both ends
    .replace(/^[-_]+|[-_]+$/g, "");

  if (!safeBase) {
    safeBase = "presentation";
  }

  if (safeBase.length > MAX_EXPORT_TITLE_LENGTH) {
    safeBase = safeBase.slice(0, MAX_EXPORT_TITLE_LENGTH).replace(/[-_]+$/g, "");
  }

  if (!safeBase) {
    safeBase = "presentation";
  }

  return `${safeBase}.${extension}`;
};

const PresentationHeader = ({
  presentation_id,
  isPresentationSaving,
  currentSlide,
}: {
  presentation_id: string;
  isPresentationSaving: boolean;
  currentSlide?: number;
}) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  /** Avoid committing on blur when Save/Cancel was used (focus/click ordering) */
  const titleBlurIntentRef = useRef<"none" | "save" | "cancel">("none");

  const pathname = usePathname();
  const dispatch = useDispatch();


  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [customThemes] = await Promise.all([
          ThemeApi.getThemes(),
        ]);
        setThemes([...customThemes, ...DEFAULT_THEMES]);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load themes");
      }
    };
    if (themes.length === 0) {
      load();
    }
  }, []);

  const { onUndo, onRedo, canUndo, canRedo } = usePresentationUndoRedo();

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const beginTitleEdit = () => {
    if (isStreaming || !presentationData) return;
    setDraftTitle(presentationData.title || "");
    setIsEditingTitle(true);
  };

  const commitTitleEdit = () => {
    if (!presentationData) {
      setIsEditingTitle(false);
      return;
    }
    const trimmed = draftTitle.trim();
    const next =
      trimmed || presentationData.title || "Presentation";
    if (next !== presentationData.title) {
      dispatch(updateTitle(next));

    }
    setIsEditingTitle(false);
  };

  const cancelTitleEdit = () => {
    setDraftTitle(presentationData?.title || "");
    setIsEditingTitle(false);
  };

  const handleTitleBlur = () => {
    queueMicrotask(() => {
      const intent = titleBlurIntentRef.current;
      titleBlurIntentRef.current = "none";
      if (intent === "cancel" || intent === "save") return;
      commitTitleEdit();
    });
  };

  const onTitleSaveMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    titleBlurIntentRef.current = "save";
  };

  const onTitleCancelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    titleBlurIntentRef.current = "cancel";
  };



  const handleExportPptx = async () => {
    if (isStreaming) return;

    try {

      toast.info("Exporting PPTX...");
      setIsExporting(true);
      // Save the presentation data before exporting
      await PresentationGenerationApi.updatePresentationContent(presentationData);
      const safePptxFileName = buildSafeExportFileName(
        presentationData?.title,
        "pptx"
      );
      const safePptxTitle = safePptxFileName.replace(/\.pptx$/i, "");
      const response = await fetch("/api/export-presentation", {
        method: "POST",
        body: JSON.stringify({
          format: "pptx",
          id: presentation_id,
          title: safePptxTitle,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export PPTX");
      }

      const { path: pptxPath } = await response.json();
      if (!pptxPath) {
        throw new Error("No path returned from export");
      }

      downloadLink(pptxPath, safePptxFileName);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Having trouble exporting!", {
        description:
          "We are having trouble exporting your presentation. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (isStreaming) return;

    try {

      toast.info("Exporting PDF...");
      setIsExporting(true);
      // Save the presentation data before exporting
      await PresentationGenerationApi.updatePresentationContent(presentationData);
      const safePdfFileName = buildSafeExportFileName(
        presentationData?.title,
        "pdf"
      );
      const safePdfTitle = safePdfFileName.replace(/\.pdf$/i, "");
      const response = await fetch("/api/export-presentation", {
        method: "POST",
        body: JSON.stringify({
          format: "pdf",
          id: presentation_id,
          title: safePdfTitle,
        }),
      });

      if (response.ok) {
        const { path: pdfPath } = await response.json();
        downloadLink(pdfPath, safePdfFileName);
      } else {
        throw new Error("Failed to export PDF");
      }
    } catch (err) {
      console.error(err);
      toast.error("Having trouble exporting!", {
        description:
          "We are having trouble exporting your presentation. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };
  const handleReGenerate = () => {
    dispatch(clearPresentationData());
    dispatch(clearHistory())

    router.push(`/presentation?id=${presentation_id}&stream=true`);
  };
  const downloadLink = (path: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = resolveBackendAssetUrl(path);
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ExportOptions = ({ mobile }: { mobile: boolean }) => (
    <div className={`rounded-[10px] max-md:mt-4 p-5`} style={{ background: '#1d1d1d', border: '1px solid #383838' }}>
      <p className="text-sm font-medium" style={{ color: '#ffffff' }}>Export as</p>
      <div className="my-[18px] h-[1px]" style={{ background: '#383838' }} />
      <div className="space-y-3">

        <Button
          onClick={() => {
            handleExportPdf();
            setOpen(false);
          }}
          variant="ghost"
          className={`  rounded-none px-0 w-full text-xs flex justify-start text-foreground hover:bg-transparent ${mobile ? "bg-card py-6 border-none rounded-lg" : ""}`} >

          PDF
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          onClick={() => {
            handleExportPptx();
            setOpen(false);
          }}
          variant="ghost"
          className={`w-full flex px-0 justify-start text-xs text-foreground hover:bg-transparent  ${mobile ? "bg-card py-6" : ""}`}
        >

          PPTX
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
      </div>


    </div>
  );

  const titleBlock = (
    <div
      className={cn(
        "min-w-0 max-w-[min(640px,calc(100vw-12rem))] flex-1 transition-[box-shadow] duration-200",
        isEditingTitle && "relative z-[60]"
      )}
    >
      {isEditingTitle ? (
        <div className="flex items-stretch w-[450px] gap-0.5 rounded-[10px] pl-3.5 pr-1 py-1" style={{ background: '#1d1d1d', border: '1px solid #383838' }}>
          <input
            ref={titleInputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                titleBlurIntentRef.current = "save";
                commitTitleEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                titleBlurIntentRef.current = "cancel";
                cancelTitleEdit();
              }
            }}
            placeholder="Presentation title"
            className="min-w-0 flex-1 bg-transparent py-2 pr-2 text-base leading-tight outline-none border-0 focus:ring-0" style={{ color: '#ffffff', fontFamily: "'Space Mono', monospace" }}
            aria-label="Presentation title"
          />
          <div className="flex shrink-0 items-center gap-0.5 pl-1 ml-0.5" style={{ borderLeft: '1px solid #383838' }}>
            <ToolTip content="Save · Enter">
              <button
                type="button"
                onMouseDown={onTitleSaveMouseDown}
                onClick={commitTitleEdit}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors" style={{ color: '#ffffff' }}
                aria-label="Save title"
              >
                <Check className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </ToolTip>
            <ToolTip content="Cancel · Esc">
              <button
                type="button"
                onMouseDown={onTitleCancelMouseDown}
                onClick={cancelTitleEdit}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors" style={{ color: '#888888' }}
                aria-label="Cancel editing title"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </ToolTip>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={beginTitleEdit}
          disabled={isStreaming || !presentationData}
          className={cn(
            "group/title flex w-full min-w-0 items-center gap-2.5 rounded-[10px] px-3 py-2 text-left -mx-3 transition-colors",
            "hover:bg-[#1d1d1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#383838] focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-100 disabled:hover:bg-transparent"
          )}
        >
          <h2 className="min-w-0 flex-1 text-lg w-[450px] leading-snug" style={{ color: '#ffffff' }}>
            <MarkdownRenderer
              content={presentationData?.title || "Presentation"}
              className="mb-0 min-w-0 overflow-hidden text-ellipsis line-clamp-1 text-sm prose-p:my-0 prose-headings:my-0"
            />
          </h2>
          {presentationData && !isStreaming && (
            <Pencil
              className="h-3.5 w-3.5 shrink-0 transition-all duration-200 opacity-80 sm:opacity-0 sm:group-hover/title:opacity-100 group-hover/title:opacity-100" style={{ color: '#888888' }}
              aria-hidden
            />
          )}
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="py-[18px] px-4 sticky top-0 z-50" style={{ background: '#1d1d1d', borderBottom: '1px solid #383838' }}>
        <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">

          <img onClick={() => {
            router.push("/dashboard");
          }} src="/logo-with-bg.png" alt="" className="w-10 h-10 cursor-pointer object-contain" />
          {presentationData && !isStreaming && !isEditingTitle ? (
            <ToolTip content="Rename presentation">{titleBlock}</ToolTip>
          ) : (
            titleBlock
          )}
        </div>

        <div className="flex items-center gap-2.5">

          {isPresentationSaving && <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </div>}
          {presentationData && presentationData.slides && !presentationData.slides[0].layout.includes("custom") && <ThemeSelector current_theme={presentationData?.theme || {}} themes={themes} />}

          <div className="flex items-center gap-2 px-3.5 h-[38px] rounded-[10px]" style={{ background: '#000000', border: '1px solid #383838' }}>

            <ToolTip content="Regenerate Presentation">
              <button onClick={handleReGenerate} className="group">
                <RotateCcw className="w-3.5 h-3.5 duration-300" style={{ color: '#ffffff' }} />
              </button>
            </ToolTip>
            <Separator orientation="vertical" className="h-4" />
            <ToolTip content="Undo">
              <button disabled={!canUndo} className="disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group" onClick={() => {
                onUndo();
              }}>

                <Undo2 className="w-3.5 h-3.5 duration-300" style={{ color: '#ffffff' }} />

              </button>
            </ToolTip>
            <Separator orientation="vertical" className="h-4" />
            <ToolTip content="Redo">

              <button disabled={!canRedo} className="disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group" onClick={() => {

                onRedo();
              }}>
                <Redo2 className="w-3.5 h-3.5 duration-300" style={{ color: '#ffffff' }} />

              </button>
            </ToolTip>
            <Separator orientation="vertical" className="h-4 w-[2px]" />
            <ToolTip content="Present">
              <button
                onClick={() => {
                  const to = `?id=${presentation_id}&mode=present&slide=${currentSlide || 0}`;

                  router.push(to);
                }}
                disabled={isStreaming || !presentationData?.slides || presentationData?.slides.length === 0} className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group">
                <Play className="w-3.5 h-3.5 duration-300" style={{ color: '#ffffff' }} />
              </button>
            </ToolTip>
          </div>

          <Popover open={open} onOpenChange={setOpen} >
            <PopoverTrigger asChild>
              <button className="flex items-center gap-[7px] px-[18px] py-[11px] rounded-[10px] text-sm font-semibold"
                style={{
                  background: "#ffffff",
                  color: "#000000"
                }}
                disabled={isExporting || isStreaming === true}
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Export"} <ArrowRightFromLine className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[200px] rounded-[18px] space-y-2 p-0  ">
              <ExportOptions mobile={false} />
            </PopoverContent>
          </Popover>
        </div>
        </div>
      </div>
    </>
  );
};

export default PresentationHeader;
