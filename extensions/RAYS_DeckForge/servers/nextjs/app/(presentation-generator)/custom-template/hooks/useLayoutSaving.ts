import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ApiResponseHandler } from "@/app/(presentation-generator)/services/api/api-error-handler";
import { ProcessedSlide } from "../types";
import { getHeader } from "@/app/(presentation-generator)/services/api/header";
import { getApiUrl } from "@/utils/api";


export const useLayoutSaving = (
  slides: ProcessedSlide[],


) => {
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openSaveModal = useCallback(() => {

    setIsModalOpen(true);
  }, [slides]);

  const closeSaveModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);




  const saveLayout = useCallback(async (layoutName: string, description: string, template_info_id: string): Promise<string | null> => {
    if (!slides.length) {
      toast.error("No slides to save");
      return null;
    }

    setIsSavingLayout(true);

    try {




      const reactComponents = slides.map((slide) => ({
        layout_id: `${slide.slide_number}`,
        layout_name: `Slide${slide.slide_number}`,
        layout_code: slide.react,
      }));


      // Save the layout components to the app_data/layouts folder
      const saveResponse = await fetch(
        getApiUrl(`/api/v1/ppt/template/save`),
        {
          method: "POST",
          headers: getHeader(),
          body: JSON.stringify({
            template_info_id: template_info_id,
            name: layoutName,
            description: description,
            layouts: reactComponents,

          }),
        }
      );

      const data = await ApiResponseHandler.handleResponse(
        saveResponse,
        "Failed to save layout components"
      );
      if (!data) {
        toast.error("Failed to save layout components");
        return null;
      }

      toast.success("Layout saved successfully");

      // Mark all slides as saved (remove modified flag)
      slides.forEach((slide) => {
        slide.modified = false;
      });

      toast.success(`Layout "${layoutName}" saved successfully`);


      closeSaveModal();
      return data.id;
    } catch (error) {
      console.error("Error saving layout:", error);
      toast.error("Failed to save layout", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
      return null;
    } finally {
      setIsSavingLayout(false);
    }
  }, [slides, closeSaveModal]);

  return {
    isSavingLayout,
    isModalOpen,
    openSaveModal,
    closeSaveModal,
    saveLayout,
  };
}; 
