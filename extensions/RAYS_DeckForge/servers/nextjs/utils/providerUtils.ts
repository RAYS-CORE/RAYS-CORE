import { getApiUrl } from "@/utils/api";
import { LLMConfig } from "@/types/llm_config";

export interface OllamaModel {
  label: string;
  value: string;
  size: string;
}

export interface DownloadingModel {
  name: string;
  size: number | null;
  downloaded: number | null;
  status: string;
  done: boolean;
  error?: string | null;
}

export interface OllamaModelsResult {
  models: OllamaModel[];
  updatedConfig?: LLMConfig;
}

/**
 * Updates LLM configuration based on field changes
 */
export const updateLLMConfig = (
  currentConfig: LLMConfig,
  field: string,
  value: string | boolean
): LLMConfig => {
  const fieldMappings: Record<string, keyof LLMConfig> = {
    openai_api_key: "OPENAI_API_KEY",
    openai_model: "OPENAI_MODEL",
    google_api_key: "GOOGLE_API_KEY",
    google_model: "GOOGLE_MODEL",
    vertex_api_key: "VERTEX_API_KEY",
    vertex_model: "VERTEX_MODEL",
    vertex_project: "VERTEX_PROJECT",
    vertex_location: "VERTEX_LOCATION",
    vertex_base_url: "VERTEX_BASE_URL",
    azure_openai_api_key: "AZURE_OPENAI_API_KEY",
    azure_openai_model: "AZURE_OPENAI_MODEL",
    azure_openai_endpoint: "AZURE_OPENAI_ENDPOINT",
    azure_openai_base_url: "AZURE_OPENAI_BASE_URL",
    azure_openai_api_version: "AZURE_OPENAI_API_VERSION",
    azure_openai_deployment: "AZURE_OPENAI_DEPLOYMENT",
    anthropic_api_key: "ANTHROPIC_API_KEY",
    anthropic_model: "ANTHROPIC_MODEL",
    ollama_url: "OLLAMA_URL",
    ollama_model: "OLLAMA_MODEL",
    custom_llm_url: "CUSTOM_LLM_URL",
    custom_llm_api_key: "CUSTOM_LLM_API_KEY",
    custom_model: "CUSTOM_MODEL",
    pexels_api_key: "PEXELS_API_KEY",
    pixabay_api_key: "PIXABAY_API_KEY",
    image_provider: "IMAGE_PROVIDER",
    disable_image_generation: "DISABLE_IMAGE_GENERATION",
    use_custom_url: "USE_CUSTOM_URL",
    disable_thinking: "DISABLE_THINKING",
    extended_reasoning: "EXTENDED_REASONING",
    web_grounding: "WEB_GROUNDING",
    comfyui_url: "COMFYUI_URL",
    comfyui_workflow: "COMFYUI_WORKFLOW",
    dall_e_3_quality: "DALL_E_3_QUALITY",
    gpt_image_1_5_quality: "GPT_IMAGE_1_5_QUALITY",
    open_webui_image_url: "OPEN_WEBUI_IMAGE_URL",
    open_webui_image_api_key: "OPEN_WEBUI_IMAGE_API_KEY",
  };

  const configKey = fieldMappings[field];
  if (configKey) {
    return { ...currentConfig, [configKey]: value };
  }

  return currentConfig;
};

/**
 * Changes the provider and sets appropriate defaults
 */
export const changeProvider = (
  currentConfig: LLMConfig,
  provider: string
): LLMConfig => {
  const newConfig = { ...currentConfig, LLM: provider };

  // Auto Select appropriate image provider based on the text models
  if (provider === "openai") {
    newConfig.IMAGE_PROVIDER = "gpt-image-1.5";
  } else if (provider === "google") {
    newConfig.IMAGE_PROVIDER = "gemini_flash";
  } else {
    newConfig.IMAGE_PROVIDER = "pexels"; // default for vertex, azure, ollama, custom, codex
  }

  return newConfig;
};

export const checkIfSelectedOllamaModelIsPulled = async (ollamaModel: string) => {
  if (!ollamaModel) return false;
  try {
    const response = await fetch(getApiUrl('/api/v1/ppt/ollama/models/available'));
    if (!response.ok) return false;
    const models = await response.json();
    const availableModelNames: string[] = models.map((model: any) => model.name || "");
    console.log("[checkIfSelectedOllamaModelIsPulled] checking:", ollamaModel, "against available:", availableModelNames);

    // Normalize tags: e.g. "llama3:latest" -> "llama3"
    const normalize = (name: string) => name.toLowerCase().trim().split(':')[0];
    const targetNorm = normalize(ollamaModel);

    return availableModelNames.some((name: string) => {
      const cleanName = name.trim();
      return (
        cleanName.toLowerCase() === ollamaModel.toLowerCase().trim() ||
        normalize(cleanName) === targetNorm
      );
    });
  } catch (error) {
    console.error('Error checking if selected Ollama model is pulled:', error);
    return false;
  }
}


