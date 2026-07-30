import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { arrayMove } from "@dnd-kit/sortable";
import { setOutlines } from "@/store/slices/presentationGeneration";

export const useOutlineManagement = (outlines: { content: string }[] | null) => {
  const dispatch = useDispatch();

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;

    if (!active || !over || !outlines) return;

    if (active.id === over.id) return;

    const oldIndex = Number(String(active.id).replace("slide-", ""));
    const newIndex = Number(String(over.id).replace("slide-", ""));

    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return;
    if (oldIndex < 0 || newIndex < 0 || oldIndex >= outlines.length || newIndex >= outlines.length) return;

    const reorderedArray = arrayMove(outlines, oldIndex, newIndex);
    dispatch(setOutlines(reorderedArray));
  }, [outlines, dispatch]);

  const handleAddSlide = useCallback(() => {
    if (!outlines) return;

    const updatedOutlines = [...outlines, { content: "Outline title" }];
    dispatch(setOutlines(updatedOutlines));
  }, [outlines, dispatch]);

  return { handleDragEnd, handleAddSlide };
}; 