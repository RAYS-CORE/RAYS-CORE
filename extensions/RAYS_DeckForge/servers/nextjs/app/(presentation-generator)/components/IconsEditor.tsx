"use client";
import React, { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PresentationGenerationApi } from "../services/api/presentation-generation";
import { getStaticFileUrl } from "../utils/others";
import { toast } from "sonner";
interface IconsEditorProps {
  icon_prompt?: string[] | null;
  onClose?: () => void;
  onIconChange?: (newIconUrl: string, query?: string) => void;
}

const IconsEditor = ({
  icon_prompt,
  onClose,
  onIconChange,

}: IconsEditorProps) => {
  // State management
  const [icons, setIcons] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>(
    icon_prompt?.[0] || ""
  );
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  // Search for icons when component opens
  useEffect(() => {
    if (icon_prompt && icon_prompt.length > 0 && icons.length === 0) {
      handleIconSearch();
    }
  }, []);

  /**
   * Searches for icons based on the current query
   */
  const handleIconSearch = async () => {
    setLoading(true);
    const query = searchQuery.length > 0 ? searchQuery : icon_prompt?.[0] || "";

    try {
      const data = await PresentationGenerationApi.searchIcons({
        query,
        limit: 40,
      });
      setIcons(data);
    } catch (error: any) {
      console.error("Error fetching icons:", error);
      toast.error(error.message || "Failed to fetch icons. Please try again.");
      setIcons([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles icon selection and calls the parent callback
   */
  const handleIconChange = (newIcon: string) => {

    if (onIconChange) {
      onIconChange(newIcon, searchQuery || icon_prompt?.[0] || '');
    }
    handleClose();
  };

  // Handle close with animation
  const handleClose = () => {
    setIsOpen(false);
    // Delay the actual close to allow animation to complete
    setTimeout(() => {
      onClose?.();
    }, 300); // Match the Sheet animation duration
  };
  

  return (
    <div className="icons-editor-container">


      <Sheet open={isOpen} onOpenChange={() => handleClose()}>
        <SheetContent
          side="right"
          className="w-[400px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <SheetHeader>
            <SheetTitle>Choose Icon</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Search Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleIconSearch();
              }}
            >
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search icons..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="pl-10"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full text-semibold text-[#51459e]"
                onClick={(e) => e.stopPropagation()}
              >
                Search
              </Button>
            </form>

            {/* Icons Grid */}
            <div className="max-h-[80vh] hide-scrollbar overflow-y-auto p-1">
              {loading ? (
                <div className="grid grid-cols-4 gap-4">
                  {Array.from({ length: 40 }).map((_, index) => (
                    <Skeleton key={index} className="w-16 h-16 rounded-lg" />
                  ))}
                </div>
              ) : icons && icons.length > 0 ? (
                <div className="grid grid-cols-4 gap-4">
                  {icons.map((iconSrc, idx) => (
                    <div
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleIconChange(iconSrc);
                      }}
                      className="w-12 h-12 cursor-pointer group relative rounded-lg overflow-hidden hover:bg-muted p-2 transition-colors"
                    >
                      <img
                        src={iconSrc}
                        alt={`Icon ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-[60vh] text-center text-muted-foreground space-y-4">
                  <Search className="w-12 h-12 text-muted-foreground" />
                  <p className="text-sm">No icons found for your search.</p>
                  <p className="text-xs">Try refining your search query.</p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default IconsEditor;
