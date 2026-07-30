"use client";
import React, { useState, useEffect } from "react";
import { Loader2, Download, CheckCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/sonner";
import { RootState } from "@/store/store";
import { useSelector } from "react-redux";
import {
  getLLMConfigValidationError,
  handleSaveLLMConfig,
} from "@/utils/storeHelpers";
import {
  checkIfSelectedOllamaModelIsPulled,
} from "@/utils/providerUtils";
import { useRouter, usePathname } from "next/navigation";
import { LLMConfig } from "@/types/llm_config";
import SettingSideBar from "./SettingSideBar";
import TextProvider from "./TextProvider";
import ImageProvider from "./ImageProvider";
import PrivacySettings from "./PrivacySettings";
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from "@/utils/providerConstants";
import { ImagesApi } from "@/app/(presentation-generator)/services/api/images";
import { getApiUrl } from "@/utils/api";
import { toast } from "sonner";
import LogoutButton from "@/components/Auth/LogoutButton";

const STOCK_IMAGE_PROVIDERS = new Set(["pexels", "pixabay"]);

// Button state interface
interface ButtonState {
  isLoading: boolean;
  isDisabled: boolean;
  text: string;
  showProgress: boolean;
  progressPercentage?: number;
  status?: string;
}

const SettingsPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<'nanobanana' | 'deckforge'>('deckforge')
  const [selectedProvider, setSelectedProvider] = useState<
    "text-provider" | "image-provider" | "privacy" | "session"
  >("text-provider");
  const userConfigState = useSelector((state: RootState) => state.userConfig);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(
    userConfigState.llm_config
  );
  const canChangeKeys = userConfigState.can_change_keys;
  const [buttonState, setButtonState] = useState<ButtonState>({
    isLoading: false,
    isDisabled: false,
    text: "Save Configuration",
    showProgress: false,
  });



  const ensureSelectedStockProviderReady = async (): Promise<boolean> => {
    if (llmConfig.DISABLE_IMAGE_GENERATION) {
      return true;
    }

    const provider = (llmConfig.IMAGE_PROVIDER || "").toLowerCase();
    if (!STOCK_IMAGE_PROVIDERS.has(provider)) {
      return true;
    }

    const providerApiKey =
      provider === "pexels" ? llmConfig.PEXELS_API_KEY : llmConfig.PIXABAY_API_KEY;

    try {
      await ImagesApi.searchStockImages("business", 1, {
        provider,
        apiKey: providerApiKey,
        strictApiKey: true,
      });
      return true;
    } catch (error: any) {
      notify.error(
        "Cannot save settings",
        error?.message ||
        `Unable to reach ${provider} with the provided API key. Please verify your settings and try again.`
      );
      return false;
    }
  };


  const checkCurrentAuthStatus = async () => {
    try {
      const res = await fetch(getApiUrl("/api/v1/ppt/codex/auth/status"));
      if (!res.ok) {
        return false;
      }
      const data = await res.json();
      if (data.status === "authenticated") {
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  };
  const handleSaveConfig = async () => {

    if (llmConfig.LLM === 'codex') {
      const isAuthenticated = await checkCurrentAuthStatus();
      if (!isAuthenticated) {
        toast.error("Please sign in to ChatGPT to continue");
        return;
      }
    }

    const validationError = getLLMConfigValidationError(llmConfig);
    if (validationError) {
      notify.error("Cannot save settings", validationError);
      return;
    }

    const providerReady = await ensureSelectedStockProviderReady();
    if (!providerReady) {
      return;
    }

    try {
      setButtonState((prev) => ({
        ...prev,
        isLoading: true,
        isDisabled: true,
        text: "Saving Configuration...",
      }));
      await handleSaveLLMConfig(llmConfig);

      notify.success(
        "Settings saved",
        "Your configuration was saved successfully."
      );
      setButtonState((prev) => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        text: "Save Configuration",
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while saving.";
      notify.error("Could not save settings", message);
      setButtonState((prev) => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        text: "Save Configuration",
      }));
    }
  };



  useEffect(() => {
    if (!canChangeKeys) {
      router.push("/dashboard");
    }
  }, [canChangeKeys, router]);

  if (!canChangeKeys) {
    return null;
  }

  const textProviderKey = llmConfig.LLM || "openai";
  const textProviderLabel =
    LLM_PROVIDERS[textProviderKey]?.label || textProviderKey;
  const selectedTextModel =
    textProviderKey === "openai"
      ? llmConfig.OPENAI_MODEL
      : textProviderKey === "google"
        ? llmConfig.GOOGLE_MODEL
        : textProviderKey === "vertex"
          ? llmConfig.VERTEX_MODEL
          : textProviderKey === "azure"
            ? llmConfig.AZURE_OPENAI_MODEL
            : textProviderKey === "anthropic"
              ? llmConfig.ANTHROPIC_MODEL
              : textProviderKey === "ollama"
                ? llmConfig.OLLAMA_MODEL
                : textProviderKey === "custom"
                  ? llmConfig.CUSTOM_MODEL
                  : "";
  const textSummary = selectedTextModel
    ? `${textProviderLabel} (${selectedTextModel})`
    : textProviderLabel;

  const imageSummary = llmConfig.DISABLE_IMAGE_GENERATION
    ? "Image generation disabled"
    : llmConfig.IMAGE_PROVIDER
      ? IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]?.label ||
      llmConfig.IMAGE_PROVIDER
      : "No image provider";


  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: '#000000', fontFamily: "'Space Mono', monospace" }}>

      <main className="w-full mx-auto gap-6   overflow-hidden flex ">
        <SettingSideBar
          mode={mode}
          setMode={setMode}
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
        />
        <div className="w-full">
          <div className="sticky top-0 right-0 z-50 py-[28px]   backdrop-blur mb-4 ">
            <div className="flex  gap-3 items-center ">
              <h3 className="text-[28px] tracking-[-0.84px] font-normal flex items-center gap-2" style={{ color: '#ffffff' }}>
                Settings
              </h3>
              <p className="text-[10px] px-2.5 py-0.5 rounded-[10px] font-medium" style={{ color: '#888888', border: '1px solid #383838' }}>
                {textSummary} · {imageSummary}
              </p>
            </div>
          </div>

          {mode === 'nanobanana' && <div className="w-full p-7 rounded-[10px]" style={{ background: '#1d1d1d', border: '1px solid #383838' }}>
            <h4 style={{ color: '#ffffff' }}>Nano Banana</h4>
          </div>}
          {mode === 'deckforge' && selectedProvider === 'text-provider' && <TextProvider


            onInputChange={(value, field) => {
              setLlmConfig(prev => ({
                ...prev,
                [field]: value
              }));
            }}
            llmConfig={llmConfig}
          />}
          {mode === 'deckforge' && selectedProvider === 'image-provider' && <ImageProvider llmConfig={llmConfig} setLlmConfig={setLlmConfig} />}
          {selectedProvider === 'privacy' && <PrivacySettings />}
          {selectedProvider === "session" && (
            <div className="w-full max-w-lg space-y-5 rounded-[10px] p-7" style={{ background: '#1d1d1d', border: '1px solid #383838' }}>
              <div>
                <h4 className="text-lg font-normal" style={{ color: '#ffffff' }}>Sign out</h4>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: '#888888' }}>
                  End your session on this deployment. You will need to sign in again to use the app and access the API.
                </p>
              </div>
              <LogoutButton
                label="Sign out"
                className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          )}

        </div>
      </main>

      {/* Fixed Bottom Button — hidden on Sign out; nothing to save there */}
      {selectedProvider !== "session" ? (
        <div className="mx-auto fixed bottom-20 right-5">
          <button
            onClick={handleSaveConfig}
            disabled={buttonState.isDisabled}
            style={{
              background: '#ffffff',
              color: '#000000',
            }}
            className={`font-semibold flex items-center justify-center gap-2 py-3 px-5 rounded-[10px] transition-all duration-500 ${buttonState.isDisabled
              ? 'opacity-60 cursor-not-allowed'
              : 'hover:opacity-90'
              }`}
          >
            {buttonState.isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {buttonState.text}
              </div>
            ) : (
              buttonState.text
            )}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : null}

    </div>
  );
};

export default SettingsPage;
