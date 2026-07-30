"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { handleSaveLLMConfig } from "@/utils/storeHelpers";

import { LLMConfig } from "@/types/llm_config";
import { usePathname } from "next/navigation";
import OnBoardingSlidebar from "./OnBoarding/OnBoardingSlidebar";
import OnBoardingHeader from "./OnBoarding/OnBoardingHeader";
import ModeSelectStep from "./OnBoarding/ModeSelectStep";
import DeckforgeMode from "./OnBoarding/DeckforgeMode";
import GenerationWithImage from "./OnBoarding/GenerationWithImage";
import FinalStep from "./OnBoarding/FinalStep";
import { checkIfSelectedOllamaModelIsPulled } from "@/utils/providerUtils";




export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1)
  const [selectedMode, setSelectedMode] = useState<string>("deckforge")
  const config = useSelector((state: RootState) => state.userConfig);

  const canChangeKeys = config.can_change_keys;


  useEffect(() => {
    if (!canChangeKeys) {
      router.push("/upload");
    }
  }, [canChangeKeys, router]);

  useEffect(() => {
    if (config.llm_config?.LLM === 'ollama' && config.llm_config?.OLLAMA_MODEL) {
      void (async () => {
        const isPulled = await checkIfSelectedOllamaModelIsPulled(config.llm_config.OLLAMA_MODEL || "");
        if (!isPulled) {
          console.log("[Home] Pre-configured Ollama model not pulled, auto-transitioning to Step 2 for download");
          setSelectedMode("deckforge");
          setStep(2);
        }
      })();
    }
  }, [config.llm_config]);

  if (!canChangeKeys) {
    return null;
  }

  return (

    <div className="flex min-h-screen relative" style={{ background: '#000000' }}>
      <OnBoardingSlidebar step={step} />
      <main className="w-full pl-20 pr-8 max-w-[1440px] mx-auto relative z-10">

        <OnBoardingHeader currentStep={step} setStep={setStep} />
        {step === 1 && <ModeSelectStep selectedMode={selectedMode} setStep={setStep} setSelectedMode={setSelectedMode} />}
        {step === 2 && selectedMode === "deckforge" && <DeckforgeMode currentStep={step} setStep={setStep} />}
        {step === 2 && selectedMode === "image" && <GenerationWithImage />}
        {step === 3 && <FinalStep />}
      </main>
    </div>
  );
}
