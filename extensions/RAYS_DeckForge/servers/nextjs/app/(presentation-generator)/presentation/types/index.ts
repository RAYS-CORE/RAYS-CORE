export interface PresentationState {
  loading: boolean;
  selectedSlide: number;
  isFullscreen: boolean;
  error: boolean;
  isMobilePanelOpen: boolean;
  autoSaveLoading: boolean;
}

export interface StreamState {
  isStreaming: boolean;
}

export interface PresentationPageProps {
  presentation_id: string;
} 