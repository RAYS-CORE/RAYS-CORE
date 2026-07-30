import React from 'react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { LLMConfig } from '@/types/llm_config';
import { IMAGE_PROVIDERS } from '@/utils/providerConstants';
import { cn } from '@/lib/utils';
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from './ui/select';

const DALLE_3_QUALITY_OPTIONS = [
    {
        label: "Standard",
        value: "standard",
        description: "Faster generation with lower cost",
    },
    {
        label: "HD",
        value: "hd",
        description: "Higher quality images with increased cost",
    },
];

const GPT_IMAGE_1_5_QUALITY_OPTIONS = [
    {
        label: "Low",
        value: "low",
        description: "Fastest and most cost-effective",
    },
    {
        label: "Medium",
        value: "medium",
        description: "Balanced quality and speed",
    },
    {
        label: "High",
        value: "high",
        description: "Best quality with longer generation time",
    },
];
const renderQualitySelector = (llmConfig: LLMConfig, input_field_changed: (value: string, field: string) => void) => {
    if (llmConfig.IMAGE_PROVIDER === "dall-e-3") {
        return (
            <div className="w-[295px]">
                <label className="block text-sm font-medium text-foreground mb-2">
                    DALL·E 3 Image Quality
                </label>
                <div className="">
                    <Select value={llmConfig.DALL_E_3_QUALITY} onValueChange={(value) => input_field_changed(value, "dall_e_3_quality")}>
                        <SelectTrigger className="w-full h-12 px-4 py-4 outline-none border border-border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-border justify-between">
                            <SelectValue placeholder="Select a quality" />
                        </SelectTrigger>
                        <SelectContent>
                            {DALLE_3_QUALITY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {/* {DALLE_3_QUALITY_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={cn(
                                "border rounded-lg p-3 text-left transition-colors",
                                llmConfig.DALL_E_3_QUALITY === option.value
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-border hover:border-border"
                            )}
                            onClick={() =>
                                input_field_changed(option.value, "dall_e_3_quality")
                            }
                        >
                            <div className="text-sm font-medium text-foreground">
                                {option.label}
                            </div>
                            <div className="text-xs text-foreground mt-1">
                                {option.description}
                            </div>
                        </button>
                    ))} */}
                </div>
            </div>
        );
    }

    if (llmConfig.IMAGE_PROVIDER === "gpt-image-1.5") {
        return (
            <div className="w-[295px]">
                <label className="block text-sm font-medium text-foreground mb-2">
                    GPT Image 1.5 Quality
                </label>
                <div className="">
                    <Select
                        value={llmConfig.GPT_IMAGE_1_5_QUALITY}
                        onValueChange={(value) => input_field_changed(value, "gpt_image_1_5_quality")}
                    >
                        <SelectTrigger

                            className="w-full h-12 px-4 py-4 outline-none border border-border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-border justify-between">
                            <SelectValue placeholder="Select a quality" />
                        </SelectTrigger>
                        <SelectContent>
                            {GPT_IMAGE_1_5_QUALITY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {/* {GPT_IMAGE_1_5_QUALITY_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={cn(
                                "border rounded-lg p-3 text-left transition-colors",
                                llmConfig.GPT_IMAGE_1_5_QUALITY === option.value
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-border hover:border-border"
                            )}
                            onClick={() =>
                                input_field_changed(option.value, "gpt_image_1_5_quality")
                            }
                        >
                            <div className="text-sm font-medium text-foreground">
                                {option.label}
                            </div>
                            <div className="text-xs text-foreground mt-1">
                                {option.description}
                            </div>
                        </button>
                    ))} */}
                </div>
            </div>
        );
    }

    return null;
};

const ImageSelectionConfig = ({ isImageGenerationDisabled, openImageProviderSelect, setOpenImageProviderSelect, llmConfig, input_field_changed, getApiKeyValue, handleApiKeyInputChange }: { isImageGenerationDisabled: boolean, openImageProviderSelect: boolean, setOpenImageProviderSelect: (open: boolean) => void, llmConfig: LLMConfig, input_field_changed: (value: string, field: string) => void, getApiKeyValue: (field: string) => string, handleApiKeyInputChange: (field: string, value: string) => void }) => {
    return (
        <div className='mt-7'>
            <div className="p-10 flex justify-between items-center bg-card rounded-[12px]">
                <div>
                    <h4 className="text-xl font-normal text-[#191919]">Image Generation Settings</h4>
                    <p className="mt-2 text-sm max-w-[205px] text-muted-foreground">
                        Choosing where images come from.
                    </p>
                </div>
                <div className='flex items-center gap-4'>


                    {!isImageGenerationDisabled && (
                        <>
                            {/* Image Provider Selection */}
                            <div className="my-8">
                                <label className="block text-sm font-medium text-foreground mb-3">
                                    Select Image Provider
                                </label>
                                <div className="w-full">
                                    <Popover
                                        open={openImageProviderSelect}
                                        onOpenChange={setOpenImageProviderSelect}
                                    >
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openImageProviderSelect}
                                                className="w-[275px] h-12 px-4 py-4 outline-none border border-border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-border justify-between"
                                            >
                                                <div className="flex gap-3 items-center">
                                                    <span className="text-sm font-medium text-foreground">
                                                        {llmConfig.IMAGE_PROVIDER
                                                            ? IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]
                                                                ?.label || llmConfig.IMAGE_PROVIDER
                                                            : "Select image provider"}
                                                    </span>
                                                </div>
                                                <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="p-0"
                                            align="start"
                                            style={{ width: "var(--radix-popover-trigger-width)" }}
                                        >
                                            <Command>
                                                <CommandInput placeholder="Search provider..." />
                                                <CommandList>
                                                    <CommandEmpty>No provider found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {Object.values(IMAGE_PROVIDERS).map(
                                                            (provider, index) => (
                                                                <CommandItem
                                                                    key={index}
                                                                    value={provider.value}
                                                                    onSelect={(value) => {
                                                                        input_field_changed(value, "image_provider");
                                                                        setOpenImageProviderSelect(false);
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            llmConfig.IMAGE_PROVIDER === provider.value
                                                                                ? "opacity-100"
                                                                                : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <div className="flex gap-3 items-center">
                                                                        <div className="flex flex-col space-y-1 flex-1">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <span className="text-sm font-medium text-foreground capitalize">
                                                                                    {provider.label}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-xs text-foreground leading-relaxed">
                                                                                {provider.description}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </CommandItem>
                                                            )
                                                        )}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            {renderQualitySelector(llmConfig, input_field_changed)}

                            {/* Dynamic API Key Input for Image Provider */}
                            {llmConfig.IMAGE_PROVIDER &&
                                IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER] &&
                                (() => {
                                    const provider = IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER];

                                    // Show info message when using same API key as main provider
                                    if (
                                        provider.value === "dall-e-3" &&
                                        llmConfig.LLM === "openai"
                                    ) {
                                        return <></>;
                                    }

                                    if (
                                        provider.value === "gpt-image-1.5" &&
                                        llmConfig.LLM === "openai"
                                    ) {
                                        return <></>;
                                    }

                                    if (
                                        provider.value === "gemini_flash" &&
                                        llmConfig.LLM === "google"
                                    ) {
                                        return <></>;
                                    }

                                    if (
                                        provider.value === "nanobanana_pro" &&
                                        llmConfig.LLM === "google"
                                    ) {
                                        return <></>;
                                    }

                                    // Show Open WebUI configuration
                                    if (provider.value === "open_webui") {
                                        return (
                                            <div className="space-y-4 w-[295px]">
                                                <div>
                                                    <label className="block text-sm font-medium text-foreground mb-2">
                                                        Open WebUI URL
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="http://localhost:3000/api/v1"
                                                            className="w-full px-4 py-2.5 outline-none border border-border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                                            value={llmConfig.OPEN_WEBUI_IMAGE_URL || ""}
                                                            onChange={(e) => {
                                                                input_field_changed(
                                                                    e.target.value,
                                                                    "open_webui_image_url"
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                    <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                                                        <span className="block w-1 h-1 rounded-full bg-secondary"></span>
                                                        Image model is configured in Open WebUI admin settings
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-foreground mb-2">
                                                        API Key (optional)
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="Open WebUI API key"
                                                            className="w-full px-4 py-2.5 outline-none border border-border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                                            value={llmConfig.OPEN_WEBUI_IMAGE_API_KEY || ""}
                                                            onChange={(e) => {
                                                                input_field_changed(
                                                                    e.target.value,
                                                                    "open_webui_image_api_key"
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Show ComfyUI configuration
                                    if (provider.value === "comfyui") {
                                        return (
                                            <div className=" space-y-4 w-[295px]">
                                                <div>
                                                    <label className="block text-sm font-medium text-foreground mb-2">
                                                        ComfyUI Server URL
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="http://192.168.1.7:8188"
                                                            className="w-full px-4 py-2.5 outline-none border border-border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                                            value={llmConfig.COMFYUI_URL || ""}
                                                            onChange={(e) => {
                                                                input_field_changed(
                                                                    e.target.value,
                                                                    "comfyui_url"
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                    <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                                                        <span className="block w-1 h-1 rounded-full bg-secondary"></span>
                                                        Use your machine IP address (not localhost) when
                                                        running on a remote server
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-foreground mb-2">
                                                        Workflow JSON
                                                    </label>
                                                    <div className="relative">
                                                        <textarea
                                                            placeholder='Paste your ComfyUI workflow JSON here (export via "Export (API)" in ComfyUI)'
                                                            className="w-full px-4 py-2.5 outline-none border border-border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-mono text-xs"
                                                            rows={6}
                                                            value={llmConfig.COMFYUI_WORKFLOW || ""}
                                                            onChange={(e) => {
                                                                input_field_changed(
                                                                    e.target.value,
                                                                    "comfyui_workflow"
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                    <p className="mt-2 text-sm text-muted-foreground">
                                                        Export your workflow from ComfyUI using &quot;Export
                                                        (API)&quot; and paste the JSON here.
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Show API key input for other providers
                                    return (
                                        <div className=" w-[295px]">
                                            <label className="block text-sm font-medium text-foreground mb-2">
                                                {provider.apiKeyFieldLabel}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder={`Enter your ${provider.apiKeyFieldLabel}`}
                                                    className="w-full px-4 py-2.5 h-12 outline-none border border-border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                                    value={getApiKeyValue(provider.apiKeyField || "")}
                                                    onChange={(e) =>
                                                        handleApiKeyInputChange(
                                                            provider.apiKeyField || "",
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </div>

                                        </div>
                                    );
                                })()}
                        </>
                    )}
                </div>
            </div>

        </div>
    )
}

export default ImageSelectionConfig
