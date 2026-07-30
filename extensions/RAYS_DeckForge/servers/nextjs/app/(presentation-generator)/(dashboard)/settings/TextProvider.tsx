import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { LLMConfig } from '@/types/llm_config';
import { getApiUrl } from '@/utils/api';
import { LLM_PROVIDERS } from '@/utils/providerConstants';
import { Check, Loader2, Eye, EyeOff, ChevronUp } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { notify } from '@/components/ui/sonner';


interface OpenAIConfigProps {

    onInputChange: (value: string | boolean, field: string) => void;
    llmConfig: LLMConfig;
}

interface ModelOption {
    value: string;
    label: string;
    size?: string;
}

const MANUAL_MODEL_PROVIDERS = new Set(['vertex', 'azure']);

const TextProvider = ({

    onInputChange,
    llmConfig
}: OpenAIConfigProps

) => {
    const [openProviderSelect, setOpenProviderSelect] = useState(false);
    const [openModelSelect, setOpenModelSelect] = useState(false);
    const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsChecked, setModelsChecked] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const isFirstRender = useRef(true);

    const selectedProvider = (llmConfig.LLM || 'openai') as keyof typeof LLM_PROVIDERS;
    const selectedProviderMeta = LLM_PROVIDERS[selectedProvider];
    const isManualModelProvider = MANUAL_MODEL_PROVIDERS.has(selectedProvider);
    const currentModelField = useMemo(() => {
        switch (selectedProvider) {
            case 'openai':
                return 'OPENAI_MODEL';
            case 'google':
                return 'GOOGLE_MODEL';
            case 'vertex':
                return 'VERTEX_MODEL';
            case 'azure':
                return 'AZURE_OPENAI_MODEL';
            case 'anthropic':
                return 'ANTHROPIC_MODEL';
            case 'ollama':
                return 'OLLAMA_MODEL';
            case 'custom':
                return 'CUSTOM_MODEL';

            default:
                return '';
        }
    }, [selectedProvider]);

    const currentApiKeyField = useMemo(() => {
        switch (selectedProvider) {
            case 'openai':
                return 'OPENAI_API_KEY';
            case 'google':
                return 'GOOGLE_API_KEY';
            case 'vertex':
                return 'VERTEX_API_KEY';
            case 'azure':
                return 'AZURE_OPENAI_API_KEY';
            case 'anthropic':
                return 'ANTHROPIC_API_KEY';
            case 'custom':
                return 'CUSTOM_LLM_API_KEY';
            default:
                return '';
        }
    }, [selectedProvider]);

    const currentModel = currentModelField ? ((llmConfig as Record<string, unknown>)[currentModelField] as string || '') : '';
    const currentApiKey = currentApiKeyField ? ((llmConfig as Record<string, unknown>)[currentApiKeyField] as string || '') : '';
    const currentCustomUrl = llmConfig.CUSTOM_LLM_URL || '';
    const currentOllamaUrl = llmConfig.OLLAMA_URL || '';
    const useCustomOllamaUrl = !!llmConfig.USE_CUSTOM_URL;
    const modelLabel = selectedProviderMeta?.label || selectedProvider;
    const providerApiKeyLabel =
        selectedProvider === 'custom'
            ? 'Custom LLM API Key'
            : selectedProvider === 'vertex'
                ? 'Vertex API Key'
                : selectedProvider === 'azure'
                    ? 'Azure OpenAI API Key'
                    : `${selectedProvider} API Key`;

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        setAvailableModels([]);
        setModelsChecked(false);
        if (currentModelField) {
            onInputChange('', currentModelField);
        }
    }, [selectedProvider, currentApiKey, currentCustomUrl, currentModelField]);



    const onApiKeyChange = (llm: keyof typeof LLM_PROVIDERS, value: string) => {
        if (llm === 'ollama') {
            onInputChange(value, 'OLLAMA_URL');
            return;
        }

        const keyField =
            llm === 'openai'
                ? 'OPENAI_API_KEY'
                : llm === 'google'
                    ? 'GOOGLE_API_KEY'
                    : llm === 'vertex'
                        ? 'VERTEX_API_KEY'
                        : llm === 'azure'
                            ? 'AZURE_OPENAI_API_KEY'
                    : llm === 'anthropic'
                        ? 'ANTHROPIC_API_KEY'
                        : llm === 'custom'
                            ? 'CUSTOM_LLM_API_KEY'
                            : '';
        if (keyField) {
            onInputChange(value, keyField);
        }
    };

    const fetchAvailableModels = async () => {
        if (isManualModelProvider) return;
        if (selectedProvider === 'openai' && !currentApiKey) return;
        if (selectedProvider === 'google' && !currentApiKey) return;
        if (selectedProvider === 'anthropic' && !currentApiKey) return;
        if (selectedProvider === 'custom' && !currentCustomUrl) return;

        setModelsLoading(true);
        try {
            let response: Response;
            if (selectedProvider === 'google') {
                response = await fetch(getApiUrl('/api/v1/ppt/google/models/available'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        api_key: currentApiKey
                    }),
                });
            } else if (selectedProvider === 'anthropic') {
                response = await fetch(getApiUrl('/api/v1/ppt/anthropic/models/available'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        api_key: currentApiKey
                    }),
                });
            } else if (selectedProvider === 'ollama') {
                response = await fetch(getApiUrl('/api/v1/ppt/ollama/models/supported'));
            } else {
                response = await fetch(getApiUrl('/api/v1/ppt/openai/models/available'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        url: selectedProvider === 'custom' ? currentCustomUrl : selectedProviderMeta?.url || '',
                        api_key: currentApiKey
                    }),
                });
            }

            if (response.ok) {
                const data = await response.json();
                const normalizedModels: ModelOption[] = selectedProvider === 'ollama'
                    ? Array.isArray(data)
                        ? data
                            .map((model) => {
                                if (typeof model === 'string') {
                                    return {
                                        value: model,
                                        label: model,
                                    };
                                }

                                if (model && typeof model === 'object') {
                                    const typedModel = model as { value?: string; label?: string; size?: string | number, name?: string };
                                    return {
                                        value: typedModel.value || typedModel.name || typedModel.label || '',
                                        label: typedModel.label || typedModel.name || typedModel.value || '',
                                        size: typeof typedModel.size === 'number' ? `${(typedModel.size / 1024 / 1024 / 1024).toFixed(1)} GB` : typedModel.size,
                                    };
                                }

                                return {
                                    value: '',
                                    label: '',
                                };
                            })
                            .filter((model: ModelOption) => Boolean(model.value))
                        : []
                    : Array.isArray(data)
                        ? data
                            .filter((model): model is string => typeof model === 'string')
                            .map((model) => ({
                                value: model,
                                label: model,
                            }))
                        : [];

                setAvailableModels(normalizedModels);
                setModelsChecked(true);

                if (normalizedModels.length > 0 && currentModelField) {
                    const modelValues = normalizedModels.map((model) => model.value);
                    if (currentModel && modelValues.includes(currentModel)) {
                        onInputChange(currentModel, currentModelField);
                        return;
                    }

                    const preferredDefault =
                        selectedProvider === 'openai'
                            ? 'gpt-4.1'
                            : selectedProvider === 'google'
                                ? 'models/gemini-2.5-flash'
                                : selectedProvider === 'anthropic'
                                    ? 'claude-sonnet-4-20250514'
                                    : modelValues[0];

                    const nextModel = modelValues.includes(preferredDefault) ? preferredDefault : modelValues[0];
                    onInputChange(nextModel, currentModelField);
                }
            } else {
                console.error('Failed to fetch models');
                setAvailableModels([]);
                setModelsChecked(true);
                notify.error(
                    'Could not load models',
                    `The server could not list ${modelLabel} models. Check your API key or endpoint and try again.`
                );
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            notify.error(
                'Could not load models',
                'Something went wrong while contacting the provider. Check your network and try again.'
            );
            setAvailableModels([]);
            setModelsChecked(true);
        } finally {
            setModelsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedProvider === 'ollama' && !modelsChecked && !modelsLoading) {
            fetchAvailableModels();
        }
    }, [selectedProvider, modelsChecked, modelsLoading]);

    return (
        <div className="space-y-6 bg-[#1d1d1d] p-7 rounded-[12px] ">
            {/* API Key Input */}
            <div className="mb-4 flex items-end justify-between rounded-[12px] bg-[#1d1d1d] pt-5 pb-10 px-10">
                <div className=" max-w-[290px] ">
                    <div className='w-[60px] h-[60px] rounded-[4px] flex items-center justify-center'
                        style={{ backgroundColor: '#1d1d1d' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
                            <path d="M15.9459 5.31543V26.5767" stroke="#4C5554" strokeWidth="1.59459" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M5.31531 9.30192V6.64426C5.31531 6.29183 5.45531 5.95384 5.70451 5.70463C5.95372 5.45543 6.29171 5.31543 6.64414 5.31543H25.2477C25.6002 5.31543 25.9382 5.45543 26.1874 5.70463C26.4366 5.95384 26.5766 6.29183 26.5766 6.64426V9.30192" stroke="#4C5554" strokeWidth="1.59459" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M11.9594 26.5762H19.9324" stroke="#4C5554" strokeWidth="1.59459" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-normal text-foreground py-2.5">Text Generation Settings</h3>
                    <p className=" text-sm  text-muted-foreground">
                        Choosing where text content comes from
                    </p>
                </div>
                <div className='flex flex-col justify-end items-end gap-4'>
                    <div className={`flex gap-4 justify-end ${selectedProvider === 'codex' ? 'items-end' : 'items-start'}`}>
                        <div className={`relative ${selectedProvider === 'codex' ? 'w-[240px]' : 'w-[222px]'}`}>
                            <div className="flex flex-col justify-start ">
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Select Text Provider
                                </label>
                                <Popover
                                    open={openProviderSelect}
                                    onOpenChange={setOpenProviderSelect}
                                >
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openProviderSelect}
                                            className="w-[222px] h-12 px-4 py-4 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors hover:border-[#383838] justify-between"
                                        >
                                            <div className="flex gap-3 items-center">
                                                <span className="text-sm font-medium text-foreground">
                                                    {llmConfig.LLM
                                                        ? LLM_PROVIDERS[llmConfig.LLM]
                                                            ?.label || llmConfig.LLM
                                                        : "Select text provider"}
                                                </span>
                                            </div>
                                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="p-0"
                                        align="start"
                                        style={{ width: "300px" }}
                                    >
                                        <Command>
                                            <CommandInput placeholder="Search provider..." />
                                            <CommandList>
                                                <CommandEmpty>No provider found.</CommandEmpty>
                                                <CommandGroup>
                                                    {Object.values(LLM_PROVIDERS).map(
                                                        (provider, index) => (
                                                            <CommandItem
                                                                key={index}
                                                                value={provider.value}
                                                                onSelect={(value) => {
                                                                    onInputChange(value, "LLM");
                                                                    setOpenProviderSelect(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        llmConfig.LLM === provider.value
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
                        <div className={`relative flex flex-col justify-end ${selectedProvider === 'codex' ? 'items-end w-[262px] max-w-full' : 'items-end w-[222px]'}`}>
                            <div className="flex flex-col justify-start w-full ">
                                {selectedProvider === 'ollama' ? (
                                    <>
                                        {!useCustomOllamaUrl ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onInputChange(true, 'USE_CUSTOM_URL');
                                                    if (!currentOllamaUrl) {
                                                        onInputChange('http://localhost:11434', 'OLLAMA_URL');
                                                    }
                                                }}
                                                className="mt-8 py-2.5 bg-muted px-3.5 w-fit rounded-[48px] text-xs font-semibold text-foreground transition-all duration-200 border border-[#383838] hover:bg-accent focus:ring-2 focus:ring-ring/30"
                                            >
                                                Use Ollama URL
                                            </button>
                                        ) : (
                                            <>
                                                <label className="block text-sm font-medium capitalize text-foreground mb-2">
                                                    Ollama URL
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={currentOllamaUrl}
                                                        onChange={(e) => onApiKeyChange(selectedProvider, e.target.value)}
                                                        className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                                        placeholder="http://localhost:11434"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onInputChange(false, 'USE_CUSTOM_URL');
                                                        onInputChange('http://localhost:11434', 'OLLAMA_URL');
                                                    }}
                                                    className="mt-2 text-xs font-medium text-muted-foreground underline underline-offset-2"
                                                >
                                                    Use default Ollama URL
                                                </button>
                                            </>
                                        )}
                                    </>
                                ) : selectedProvider === 'codex' ? null : (
                                        <>
                                            <label className="block text-sm font-medium capitalize text-foreground mb-2">
                                                {providerApiKeyLabel}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showApiKey ? 'text' : 'password'}
                                                    value={currentApiKey}
                                                    onChange={(e) => onApiKeyChange(selectedProvider, e.target.value)}
                                                    className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                                    placeholder={`Enter your ${providerApiKeyLabel}`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowApiKey((prev) => !prev)}
                                                    className='absolute right-2 top-1/2 -translate-y-1/2 bg-[#1d1d1d] px-2 py-1 cursor-pointer'
                                                >
                                                    {showApiKey ? <Eye className='w-4 h-4 text-muted-foreground' /> : <EyeOff className='w-4 h-4 text-muted-foreground' />}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                {selectedProvider === 'custom' && (
                                    <input
                                        type="text"
                                        value={currentCustomUrl}
                                        onChange={(e) => onInputChange(e.target.value, 'CUSTOM_LLM_URL')}
                                        className="w-full mt-2 px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                        placeholder="OpenAI-compatible URL"
                                    />
                                )}
                                {selectedProvider === 'vertex' && (
                                    <div className="mt-2 space-y-2">
                                        <input
                                            type="text"
                                            value={llmConfig.VERTEX_PROJECT || ''}
                                            onChange={(e) => onInputChange(e.target.value, 'VERTEX_PROJECT')}
                                            className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                            placeholder="GCP project (optional if API key used)"
                                        />
                                        <input
                                            type="text"
                                            value={llmConfig.VERTEX_LOCATION || ''}
                                            onChange={(e) => onInputChange(e.target.value, 'VERTEX_LOCATION')}
                                            className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                            placeholder="GCP location (optional)"
                                        />
                                        <input
                                            type="text"
                                            value={llmConfig.VERTEX_BASE_URL || ''}
                                            onChange={(e) => onInputChange(e.target.value, 'VERTEX_BASE_URL')}
                                            className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                            placeholder="Vertex base URL (optional)"
                                        />
                                    </div>
                                )}
                                {selectedProvider === 'azure' && (
                                    <div className="mt-2 space-y-2">
                                        <input
                                            type="text"
                                            value={llmConfig.AZURE_OPENAI_ENDPOINT || ''}
                                            onChange={(e) => onInputChange(e.target.value, 'AZURE_OPENAI_ENDPOINT')}
                                            className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                            placeholder="Azure endpoint (https://...openai.azure.com)"
                                        />
                                        <input
                                            type="text"
                                            value={llmConfig.AZURE_OPENAI_BASE_URL || ''}
                                            onChange={(e) => onInputChange(e.target.value, 'AZURE_OPENAI_BASE_URL')}
                                            className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                            placeholder="Azure base URL (optional alternative)"
                                        />
                                        <input
                                            type="text"
                                            value={llmConfig.AZURE_OPENAI_API_VERSION || ''}
                                            onChange={(e) => onInputChange(e.target.value, 'AZURE_OPENAI_API_VERSION')}
                                            className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                            placeholder="API version (e.g. 2024-10-21)"
                                        />
                                        <input
                                            type="text"
                                            value={llmConfig.AZURE_OPENAI_DEPLOYMENT || ''}
                                            onChange={(e) => onInputChange(e.target.value, 'AZURE_OPENAI_DEPLOYMENT')}
                                            className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                            placeholder="Deployment name (optional)"
                                        />
                                    </div>
                                )}


                            </div>
                            {!isManualModelProvider && selectedProvider !== 'ollama' && selectedProvider !== 'codex' && (!modelsChecked || (modelsChecked && availableModels.length === 0)) && (

                                <button
                                    onClick={fetchAvailableModels}
                                    disabled={
                                        modelsLoading ||
                                        (selectedProvider === 'openai' && !currentApiKey) ||
                                        (selectedProvider === 'google' && !currentApiKey) ||
                                        (selectedProvider === 'anthropic' && !currentApiKey) ||
                                        (selectedProvider === 'custom' && !currentCustomUrl)
                                    }
                                    className={`mt-4 py-2.5 bg-muted px-3.5 w-fit  rounded-[48px] text-xs font-semibold text-foreground transition-all duration-200 border ${modelsLoading
                                        ? " border-[#383838] cursor-not-allowed text-muted-foreground"
                                        : " border-[#383838] text-foreground hover:bg-accent focus:ring-2 focus:ring-ring/30"
                                        }`}
                                >
                                    {modelsLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Checking for models...
                                        </span>
                                    ) : (
                                        "Check models"
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Model Selection - only show if models are available */}
                    {!isManualModelProvider && selectedProvider !== 'codex' && modelsChecked && availableModels.length > 0 ? (
                        <div className="w-[222px]">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-3">
                                    {selectedProvider === 'ollama' ? 'Choose a supported model' : `Select ${modelLabel} Model`}
                                </label>
                                <div className="w-full">
                                    <Popover
                                        open={openModelSelect}
                                        onOpenChange={setOpenModelSelect}
                                    >
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openModelSelect}
                                                className="w-full h-12 px-4 py-4 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors hover:border-[#383838] justify-between"
                                            >
                                                <span className="text-sm truncate font-medium text-foreground">
                                                    {(() => {
                                                        if (!currentModel) return "Select a model";
                                                        const selectedModel = availableModels.find((model) => model.value === currentModel);
                                                        if (!selectedModel) return currentModel;
                                                        if (selectedProvider === 'ollama' && selectedModel.size) {
                                                            return `${selectedModel.label} (${selectedModel.size})`;
                                                        }
                                                        return selectedModel.label;
                                                    })()}
                                                </span>

                                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="p-0"
                                            align="start"
                                            style={{ width: "var(--radix-popover-trigger-width)" }}
                                        >
                                            <Command>
                                                <CommandInput placeholder="Search models..." />
                                                <CommandList>
                                                    <CommandEmpty>No model found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {availableModels.map((model) => (
                                                            <CommandItem
                                                                key={model.value}
                                                                value={model.value}
                                                                onSelect={() => {
                                                                    if (currentModelField) {
                                                                        onInputChange(model.value, currentModelField);
                                                                    }
                                                                    setOpenModelSelect(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        currentModel === model.value
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                <div className="flex gap-3 items-center">
                                                                    <div className="flex flex-col space-y-1 flex-1">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-sm font-medium text-foreground">
                                                                                {model.label}
                                                                            </span>
                                                                            {selectedProvider === 'ollama' && model.size ? (
                                                                                <span className="text-xs font-medium text-muted-foreground">
                                                                                    {model.size}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    {isManualModelProvider ? (
                        <div className="w-[222px]">
                            <label className="block text-sm font-medium text-foreground mb-3">
                                {`Enter ${modelLabel} Model`}
                            </label>
                            <input
                                type="text"
                                value={currentModel}
                                onChange={(e) => {
                                    if (currentModelField) {
                                        onInputChange(e.target.value, currentModelField);
                                    }
                                }}
                                className="w-full h-12 px-4 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                placeholder={
                                    selectedProvider === 'vertex'
                                        ? 'e.g. gemini-2.5-flash'
                                        : 'e.g. gpt-4.1'
                                }
                            />
                        </div>
                    ) : null}
                </div>
            </div>
            {/* Show message if no models found */}
            {modelsChecked && availableModels.length === 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                        No models found. Please make sure your provider credentials are valid and the selected provider is reachable.
                    </p>
                </div>
            )}



            {/* <div className="bg-[#1d1d1d] flex justify-between items-center p-10 rounded-[12px]">
                <div className=' max-w-[290px]'>

                    <h4 className="text-xl font-normal text-foreground">Advanced</h4>
                    <p className="mt-2.5 text-sm  text-muted-foreground">
                        Configure advanced AI features.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-[222px]">
                        <div className="flex items-center  mb-4 gap-2.5 ">
                            <Switch
                                checked={!!llmConfig.WEB_GROUNDING}
                                onCheckedChange={(checked) => onInputChange(checked, "WEB_GROUNDING")}
                            />
                            <label className="text-sm font-medium text-foreground">
                                Enable Web Grounding
                            </label>
                        </div>
                    </div>
                </div>
            </div> */}
        </div>
    )
}

export default TextProvider
