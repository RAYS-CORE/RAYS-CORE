import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { setPresentationData } from "@/store/slices/presentationGeneration";
import { DashboardApi } from '../../services/api/dashboard';
import { clearHistory } from "@/store/slices/undoRedoSlice";
import { applyPresentationThemeToElement } from "../utils/applyPresentationThemeDom";
import { resolveBackendAssetUrl } from "@/utils/api";
import { useFontLoader } from "../../hooks/useFontLoad";


const normalizePresentationAssets = <T,>(input: T): T => {
  if (Array.isArray(input)) {
    return input.map((item) => normalizePresentationAssets(item)) as T;
  }

  if (input && typeof input === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (typeof value === "string") {
        normalized[key] = resolveBackendAssetUrl(value);
      } else {
        normalized[key] = normalizePresentationAssets(value);
      }
    }
    return normalized as T;
  }

  return input;
};


export const usePresentationData = (
  presentationId: string,
  setLoading: (loading: boolean) => void,
  setError: (error: boolean) => void
) => {
  const dispatch = useDispatch();

  const fetchUserSlides = useCallback(async (options?: { clearHistory?: boolean }) => {
    try {
      const data = await DashboardApi.getPresentation(presentationId);
      const normalizedData = normalizePresentationAssets(data);


      if (normalizedData) {
        dispatch(setPresentationData(normalizedData));
        if (options?.clearHistory ?? true) {
          dispatch(clearHistory());
        }
        setLoading(false);
      }
      if (normalizedData.fonts) {
        useFontLoader(normalizedData.fonts);
      }
      if (normalizedData?.theme) {
        const el = document.getElementById("presentation-slides-wrapper");
        applyPresentationThemeToElement(el, normalizedData.theme);
      }
    } catch (error) {
      setError(true);
      toast.error("Failed to load presentation");
      console.error("Error fetching user slides:", error);
      setLoading(false);
    }
  }, [presentationId, dispatch, setLoading, setError]);

  return {
    fetchUserSlides,
  };
};
