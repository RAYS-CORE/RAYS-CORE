import React from "react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "../types/index";
import { TemplateLayoutsWithSettings } from "@/app/presentation-templates/utils";
import { ChevronRight } from "lucide-react";

interface GenerateButtonProps {
  loadingState: LoadingState;
  streamState: { isStreaming: boolean; isLoading: boolean };
  selectedTemplate: TemplateLayoutsWithSettings | string | null;
  onSubmit: () => void;
}

const GenerateButton: React.FC<GenerateButtonProps> = ({
  loadingState,
  streamState,
  selectedTemplate,
  onSubmit,
}) => {
  const isDisabled =
    loadingState.isLoading || streamState.isLoading || streamState.isStreaming;

  const getButtonText = () => {
    if (loadingState.isLoading) return loadingState.message;
    if (streamState.isLoading || streamState.isStreaming) return "Loading...";
    if (!selectedTemplate) return "Select a Template";
    return "Generate Presentation";
  };

  return (
    <Button
      disabled={isDisabled}
      onClick={() => {
        onSubmit();
      }}
      className="w-full flex items-center gap-0.5 rounded-[58px] text-sm py-3 px-5 font-instrument_sans font-semibold bg-[#ffffff] hover:bg-[#e0e0e0] text-[#000000] disabled:opacity-50 disabled:cursor-not-allowed font-syne"
    >

      {getButtonText()}
      <ChevronRight className="w-4 h-4 text-[#000000]" />
    </Button>
  );
};

export default GenerateButton;
