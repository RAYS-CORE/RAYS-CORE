'use client'
import React, { useEffect } from "react";

import { Card } from "@/components/ui/card";
import { DashboardApi } from "@/app/(presentation-generator)/services/api/dashboard";
import { AlertTriangle, EllipsisVertical, Loader2, Trash } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { useFontLoader } from "@/app/(presentation-generator)/hooks/useFontLoad";
import SlideScale from "@/app/(presentation-generator)/components/PresentationRender";
import MarkdownRenderer from "@/components/MarkDownRender";

export const PresentationCard = ({
  id,
  title,
  presentation,
  onDeleted
}: {
  id: string;
  title: string;
  presentation: any;
  onDeleted?: (presentationId: string) => void;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault();

    router.push(`/presentation?id=${id}&type=standard`);
  };
  useEffect(() => {
    applyTheme(presentation.theme)
  }, [])
  const applyTheme = async (theme: any) => {
    const element = document.getElementById(`dashboard-presentation-card-${id}`)
    if (!element) return;

    if (!theme || !theme.data || !theme.data.colors['graph_0']) { return; }
    const cssVariables = {
      '--primary-color': theme.data.colors['primary'],
      '--background-color': theme.data.colors['background'],
      '--card-color': theme.data.colors['card'],
      '--stroke': theme.data.colors['stroke'],
      '--primary-text': theme.data.colors['primary_text'],
      '--background-text': theme.data.colors['background_text'],
      '--graph-0': theme.data.colors['graph_0'],
      '--graph-1': theme.data.colors['graph_1'],
      '--graph-2': theme.data.colors['graph_2'],
      '--graph-3': theme.data.colors['graph_3'],
      '--graph-4': theme.data.colors['graph_4'],
      '--graph-5': theme.data.colors['graph_5'],
      '--graph-6': theme.data.colors['graph_6'],
      '--graph-7': theme.data.colors['graph_7'],
      '--graph-8': theme.data.colors['graph_8'],
      '--graph-9': theme.data.colors['graph_9'],
    }
    Object.entries(cssVariables).forEach(([key, value]) => {
      element.style.setProperty(key, value)
    })
    // 
    if (theme.data.fonts.textFont.url && theme.data.fonts.textFont.name) {
      useFontLoader({ [theme.data.fonts.textFont.name]: theme.data.fonts.textFont.url })
    }

    // Apply fonts to preview container
    element.style.setProperty('font-family', `"${theme.data.fonts.textFont.name}"`)
    element.style.setProperty('--heading-font-family', `"${theme.data.fonts.textFont.name}"`)
    element.style.setProperty('--body-font-family', `"${theme.data.fonts.textFont.name}"`)


  }

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    const response = await DashboardApi.deletePresentation(id);

    if (response?.success) {

      toast.success("Presentation deleted", {
        description: "The presentation has been deleted successfully",
      });
      setShowDeleteDialog(false);
      if (onDeleted) {
        onDeleted(id);
      }
    } else {
      toast.error(response?.message || "Error deleting presentation");
    }
    setIsDeleting(false);
  };
  const firstSlide = presentation?.slides?.[0];
  return (
    <Card
      suppressHydrationWarning={true}
      onClick={handlePreview}
      className="shadow-none sm:shadow-none presentation-card rounded-[10px] p-0 group hover:shadow-md transition-all duration-500 slide-theme cursor-pointer overflow-hidden flex flex-col"
      style={{ background: '#1d1d1d', border: '1px solid #383838' }}
    >
      <div
        id={`dashboard-presentation-card-${id}`}
        suppressHydrationWarning={true} className="flex flex-col flex-1 relative z-40">
        {/* <p className=" text-xs font-syne absolute top-2 flex gap-1 capitalize  items-center left-2 rounded-[100px]  px-2.5 py-1 bg-[#3A3A3AF5] text-foreground font-semibold  z-40 ">

          {presentation.type}
        </p> */}

        <img src="/card_bg.svg" alt="" className="absolute top-0 left-0 w-full h-full object-cover" />
        <div className="scale-[0.75] mt-4  border border-border rounded-lg overflow-hidden">

          <SlideScale slide={firstSlide} isClickable={false} />
        </div>

        <div className="w-full py-3 px-5 mt-auto z-40 relative" style={{ background: '#1d1d1d', borderTop: '1px solid #383838' }}>
          <div className="flex items-center justify-between gap-7 w-full">
            <div className="flex flex-col items-start gap-1">
              <div className="text-sm text-foreground font-semibold  overflow-hidden line-clamp-1">
                <MarkdownRenderer content={title} className="text-sm mb-0  font-syne text-foreground font-semibold  overflow-hidden line-clamp-1" />
              </div>
              <p className="text-muted-foreground text-sm font-syne">
                {new Date(presentation?.created_at).toLocaleDateString()}
              </p>

            </div>
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger className="w-6 h-6 hover:bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setIsPopoverOpen(true); }}>
                <EllipsisVertical className="w-6 h-6 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent align="end" className="bg-card w-[200px]">
                <button
                  className="flex items-center justify-between w-full px-2 py-1 hover:bg-muted"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsPopoverOpen(false);
                    setShowDeleteDialog(true);
                  }}
                >
                  <p>Delete</p>
                  <Trash className="w- h-4 text-red-500" />
                </button>
              </PopoverContent>
            </Popover>
          </div>

        </div>
      </div>
      {showDeleteDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center animate-[fadeIn_150ms_ease-out]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isDeleting) return;
            setShowDeleteDialog(false);
          }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div
            className="relative w-[360px] rounded-[10px] animate-[scaleIn_200ms_ease-out]"
            style={{ background: '#1d1d1d', border: '1px solid #383838' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="flex flex-col items-center p-6 pb-4 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[10px]" style={{ background: '#383838' }}>
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                Delete Presentation?
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                You are about to delete{" "}
                <span className="font-medium text-foreground">&quot;{title}&quot;</span>.
                This action cannot be undone.
              </p>
            </div>
            <div className="flex" style={{ borderTop: '1px solid #383838' }}>
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderLeft: '1px solid #383838', color: '#ffffff' }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
