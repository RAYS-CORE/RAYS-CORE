import React, { useEffect, useMemo, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { ArrowUpRight, Check, CheckCircle, ChevronLeft, ChevronUp, Download, Eye, EyeOff, Info, Loader2 } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { DALLE_3_QUALITY_OPTIONS, GPT_IMAGE_1_5_QUALITY_OPTIONS, IMAGE_PROVIDERS, LLM_PROVIDERS } from '@/utils/providerConstants';
import { cn } from '@/lib/utils';
import { LLMConfig } from '@/types/llm_config';
import { RootState } from '@/store/store';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import ToolTip from '../ToolTip';
import { Switch } from '../ui/switch';
import { Select, SelectItem, SelectContent, SelectValue, SelectTrigger } from '../ui/select';
import { usePathname } from 'next/navigation';
import { handleSaveLLMConfig } from '@/utils/storeHelpers';
import { getApiUrl } from '@/utils/api';
import { checkIfSelectedOllamaModelIsPulled } from '@/utils/providerUtils';

const MANUAL_MODEL_PROVIDERS = new Set(["vertex", "azure"]);

const DeckforgeMode = ({ currentStep, setStep }: { currentStep: number, setStep: (step: number) => void }) => {
    const pathname = usePathname();
    const [openProviderSelect, setOpenProviderSelect] = useState(false);
    const [openImageProviderSelect, setOpenImageProviderSelect] = useState(false);
    const userConfigState = useSelector((state: RootState) => state.userConfig);

    const [showApiKey, setShowApiKey] = useState(false);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [openModelSelect, setOpenModelSelect] = useState(false);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsChecked, setModelsChecked] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [llmConfig, setLlmConfig] = useState<LLMConfig>(
        userConfigState.llm_config
    );
    const isManualModelProvider = MANUAL_MODEL_PROVIDERS.has(llmConfig.LLM || "");

    const handleProviderChange = (provider: string) => {
        setLlmConfig((prev: LLMConfig) => ({
            ...prev,
            LLM: provider
        }));
        setOpenProviderSelect(false);
        setAvailableModels([]);
        setModelsChecked(false);
        if (currentModelField) {
            setLlmConfig((prev: LLMConfig) => ({
                ...prev,
                [currentModelField]: ''
            }));
        }
    };

    const currentModelField = useMemo(() => {
        switch (llmConfig.LLM) {
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
    }, [llmConfig.LLM]);
    const currentApiKeyField = useMemo(() => {
        switch (llmConfig.LLM) {
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
    }, [llmConfig.LLM]);



    const getFieldValue = (field?: string) => {
        if (!field) return "";
        return (llmConfig as Record<string, string | undefined>)[field] || "";
    };

    const currentApiKey = currentApiKeyField ? ((llmConfig as Record<string, unknown>)[currentApiKeyField] as string || '') : '';
    const currentModel = currentModelField ? ((llmConfig as Record<string, unknown>)[currentModelField] as string || '') : '';
    const currentOllamaUrl = llmConfig.OLLAMA_URL || '';
    const useCustomOllamaUrl = !!llmConfig.USE_CUSTOM_URL;
    const providerApiKeyLabel =
        llmConfig.LLM === 'custom'
            ? 'Custom LLM API Key'
            : llmConfig.LLM === 'vertex'
                ? 'Vertex API Key'
                : llmConfig.LLM === 'azure'
                    ? 'Azure OpenAI API Key'
                    : `${llmConfig.LLM} API Key`;

    const getSelectedTextModel = (config: LLMConfig): string => {
        switch (config.LLM) {
            case 'openai':
                return config.OPENAI_MODEL || '';
            case 'google':
                return config.GOOGLE_MODEL || '';
            case 'vertex':
                return config.VERTEX_MODEL || '';
            case 'azure':
                return config.AZURE_OPENAI_MODEL || '';
            case 'anthropic':
                return config.ANTHROPIC_MODEL || '';
            case 'ollama':
                return config.OLLAMA_MODEL || '';
            case 'custom':
                return config.CUSTOM_MODEL || '';
            default:
                return '';
        }
    };

    const getSelectedImageQuality = (config: LLMConfig): string => {
        if (config.IMAGE_PROVIDER === 'dall-e-3') return config.DALL_E_3_QUALITY || '';
        if (config.IMAGE_PROVIDER === 'gpt-image-1.5') return config.GPT_IMAGE_1_5_QUALITY || '';
        return '';
    };

    const fetchAvailableModels = async () => {
        if (isManualModelProvider) return;
        if (llmConfig.LLM === 'openai' && !currentApiKey) return;
        if (llmConfig.LLM === 'google' && !currentApiKey) return;
        if (llmConfig.LLM === 'anthropic' && !currentApiKey) return;
        if (llmConfig.LLM === 'custom' && !llmConfig.CUSTOM_LLM_URL) return;
        setModelsLoading(true);
        try {
            let response: Response;
            if (llmConfig.LLM === 'google') {
                response = await fetch(getApiUrl('/api/v1/ppt/google/models/available'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        api_key: currentApiKey
                    }),
                });
            } else if (llmConfig.LLM === 'anthropic') {
                response = await fetch(getApiUrl('/api/v1/ppt/anthropic/models/available'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        api_key: currentApiKey
                    }),
                });
            } else if (llmConfig.LLM === 'ollama') {
                response = await fetch(getApiUrl('/api/v1/ppt/ollama/models/supported'));
            } else {
                response = await fetch(getApiUrl('/api/v1/ppt/openai/models/available'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        url: llmConfig.LLM === 'custom' ? llmConfig.CUSTOM_LLM_URL : LLM_PROVIDERS[llmConfig.LLM!]?.url || '',
                        api_key: currentApiKey
                    }),
                });
            }

            if (response.ok) {
                const data = await response.json();
                const normalizedModels: string[] = llmConfig.LLM === 'ollama'
                    ? Array.isArray(data)
                        ? data.map((model: any) => {
                            if (typeof model === 'string') return model;
                            return model?.name || model?.value || model?.label || '';
                        }).filter(Boolean)
                        : []
                    : Array.isArray(data)
                        ? data
                        : [];

                setAvailableModels(normalizedModels);
                setModelsChecked(true);

                if (normalizedModels.length > 0 && currentModelField) {
                    if (llmConfig[currentModelField] && normalizedModels.includes(llmConfig[currentModelField])) {
                        setLlmConfig((prev: LLMConfig) => ({
                            ...prev,
                            [currentModelField]: llmConfig[currentModelField]
                        }));
                        return;
                    }

                    const preferredDefault =
                        llmConfig.LLM === 'openai'
                            ? 'gpt-4.1'
                            : llmConfig.LLM === 'google'
                                ? 'models/gemini-2.5-flash'
                                : llmConfig.LLM === 'anthropic'
                                    ? 'claude-sonnet-4-20250514'
                                    : normalizedModels[0];

                    const nextModel = normalizedModels.includes(preferredDefault) ? preferredDefault : normalizedModels[0];
                    setLlmConfig((prev: LLMConfig) => ({
                        ...prev,
                        [currentModelField]: nextModel
                    }));
                }
            } else {
                console.error('Failed to fetch models');
                setAvailableModels([]);
                setModelsChecked(true);
                toast.error(`Failed to fetch ${LLM_PROVIDERS[llmConfig.LLM!]?.label} models`);
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            toast.error('Error fetching models');
            setAvailableModels([]);
            setModelsChecked(true);
        } finally {
            setModelsLoading(false);
        }
    };

    const renderQualitySelector = (llmConfig: LLMConfig) => {
        if (llmConfig.IMAGE_PROVIDER === "dall-e-3") {
            return (
                <div className="w-full ">
                    <label className="block text-sm font-medium text-foreground mb-2">
                        DALL·E 3 Image Quality
                    </label>
                    <div className="">
                        <Select value={llmConfig.DALL_E_3_QUALITY || 'standard'} onValueChange={(value) => setLlmConfig((prev) => ({
                            ...prev,
                            DALL_E_3_QUALITY: value
                        }))}>
                            <SelectTrigger className="w-full h-12 px-4 py-4 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground hover:border-[#ffffff] justify-between">
                                <SelectValue placeholder="Select a quality" />
                            </SelectTrigger>
                            <SelectContent>
                                {DALLE_3_QUALITY_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                    </div>
                </div>
            );
        }

        if (llmConfig.IMAGE_PROVIDER === "gpt-image-1.5") {
            return (
                <div className="w-full">
                    <label className="block text-sm font-medium text-foreground mb-2">
                        GPT Image 1.5 Quality
                    </label>
                    <div className="">
                        <Select
                            value={llmConfig.GPT_IMAGE_1_5_QUALITY || 'low'}
                            onValueChange={(value: string) => setLlmConfig((prev: LLMConfig) => ({
                                ...prev,
                                GPT_IMAGE_1_5_QUALITY: value
                            }))}
                        >
                            <SelectTrigger

                                className="w-full h-12 px-4 py-4 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground hover:border-[#ffffff] justify-between">
                                <SelectValue placeholder="Select a quality" />
                            </SelectTrigger>
                            <SelectContent>
                                {GPT_IMAGE_1_5_QUALITY_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                    </div>
                </div>
            );
        }

        return null;
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

    const [pullState, setPullState] = useState<{
        isPulling: boolean;
        downloaded: number | null;
        total: number | null;
        percentage: number;
        statusText: string;
        error: string | null;
    }>({
        isPulling: false,
        downloaded: null,
        total: null,
        percentage: 0,
        statusText: '',
        error: null
    });

    const formatBytes = (bytes: number | null): string => {
        if (bytes === null) return "0 B";
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const startOllamaModelPull = async (modelName: string) => {
        setPullState({
            isPulling: true,
            downloaded: null,
            total: null,
            percentage: 0,
            statusText: 'Initializing download...',
            error: null
        });

        try {
            const triggerUrl = getApiUrl(`/api/v1/ppt/ollama/model/pull?model=${encodeURIComponent(modelName)}`);
            const triggerRes = await fetch(triggerUrl);
            if (!triggerRes.ok) {
                throw new Error(`Failed to initiate pull request: ${triggerRes.statusText}`);
            }

            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(triggerUrl);
                    if (!statusRes.ok) {
                        clearInterval(pollInterval);
                        setPullState(prev => ({
                            ...prev,
                            isPulling: false,
                            error: 'Failed to poll model status from Ollama server.'
                        }));
                        toast.error('Ollama connection lost.');
                        return;
                    }

                    const statusData = await statusRes.json();
                    
                    if (statusData.status === 'error' || statusData.error) {
                        clearInterval(pollInterval);
                        setPullState(prev => ({
                            ...prev,
                            isPulling: false,
                            statusText: 'Error occurred',
                            error: statusData.error || 'Failed to download model.'
                        }));
                        toast.error(`Download failed: ${statusData.error || 'Unknown error'}`);
                        return;
                    }

                    const size = statusData.size || null;
                    const downloaded = statusData.downloaded || null;
                    const percentage = size && downloaded ? Math.round((downloaded / size) * 100) : 0;
                    
                    setPullState(prev => ({
                        ...prev,
                        downloaded,
                        total: size,
                        percentage,
                        statusText: statusData.status || 'Pulling model layers...'
                    }));

                    if (statusData.done || statusData.status === 'pulled') {
                        clearInterval(pollInterval);
                        
                        try {
                            setSavingConfig(true);
                            await handleSaveLLMConfig(llmConfig, { skipImages: true });
                            toast.info("Model pulled & configuration saved successfully!");
                            setStep(3);
                        } catch (saveError) {
                            toast.error("Model pulled, but failed to save configuration settings.");
                        } finally {
                            setSavingConfig(false);
                            setPullState(prev => ({ ...prev, isPulling: false }));
                        }
                    }
                } catch (pollErr) {
                    clearInterval(pollInterval);
                    setPullState(prev => ({
                        ...prev,
                        isPulling: false,
                        error: 'Connection interrupted while polling progress.'
                    }));
                }
            }, 1500);

        } catch (error: any) {
            setPullState(prev => ({
                ...prev,
                isPulling: false,
                error: error.message || 'Failed to pull model.'
            }));
            toast.error(error.message || 'Failed to initiate Ollama pull.');
        }
    };

    const handleSaveConfig = async () => {
        console.log("[handleSaveConfig] Starting save with config:", llmConfig);
        try {
            if (llmConfig.LLM === 'codex') {
                const isAuthenticated = await checkCurrentAuthStatus();
                if (!isAuthenticated) {
                    toast.error("Please sign in to ChatGPT to continue");
                    return;
                }
            }

            if (llmConfig.LLM === 'ollama') {
                if (!llmConfig.OLLAMA_MODEL) {
                    toast.error("Please select a supported Ollama model to continue");
                    return;
                }
                
                setSavingConfig(true);
                const isPulled = await checkIfSelectedOllamaModelIsPulled(llmConfig.OLLAMA_MODEL);
                setSavingConfig(false);

                if (!isPulled) {
                    console.log("[handleSaveConfig] Ollama model not installed, starting pull flow for:", llmConfig.OLLAMA_MODEL);
                    await startOllamaModelPull(llmConfig.OLLAMA_MODEL);
                    return;
                }
            }

            setSavingConfig(true);
            console.log("[handleSaveConfig] Calling handleSaveLLMConfig...");
            await handleSaveLLMConfig(llmConfig, { skipImages: true });

            console.log("[handleSaveConfig] Save successful, moving to Step 3");
            toast.info("Configuration saved successfully");
            setStep(3)
        } catch (error) {
            console.error("[handleSaveConfig] Error during save:", error);
            toast.error(error instanceof Error ? error.message : "Failed to save configuration");
        }
        finally {
            setSavingConfig(false);
        }
    };



    useEffect(() => {
        if (llmConfig.LLM === 'ollama' && !modelsChecked && !modelsLoading) {
            void fetchAvailableModels();
        }
    }, [llmConfig.LLM, modelsChecked, modelsLoading]);

    return (
        <div className='w-full max-w-[660px] pb-10' style={{ fontFamily: "'Space Mono', monospace" }}>
            {pullState.isPulling && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
                    <div className="w-full max-w-md p-8 rounded-[10px] bg-[#1d1d1d] border border-[#383838] shadow-2xl">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-medium tracking-wide text-white mb-2" style={{ fontFamily: "'Space Mono', monospace" }}>
                                Downloading Ollama Model
                            </h3>
                            <p className="text-xs text-[#888888] font-mono tracking-wider uppercase">
                                {llmConfig.OLLAMA_MODEL}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="relative w-full h-2 rounded-full bg-[#0d0d0d] border border-[#383838] overflow-hidden">
                                <div 
                                    className="h-full bg-white transition-all duration-300 ease-out"
                                    style={{ width: `${pullState.percentage}%` }}
                                />
                            </div>

                            <div className="flex items-center justify-between text-xs font-mono text-[#888888]">
                                <span className="capitalize">{pullState.statusText}</span>
                                <span>{pullState.percentage}%</span>
                            </div>

                            {pullState.downloaded !== null && pullState.total !== null && (
                                <div className="text-center text-xs font-mono text-[#888888] border-t border-[#383838] pt-3 mt-2">
                                    {formatBytes(pullState.downloaded)} / {formatBytes(pullState.total)}
                                </div>
                            )}

                            <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#888888] mt-4">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                                <span>Do not close RAYS DeckForge</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <p className='px-2.5 py-0.5 w-fit rounded-[10px] text-[10px] font-medium mb-5' style={{ color: '#888888', border: '1px solid #383838' }}>DECKFORGE</p>
            <div className=''>

                <h2 className='mb-4 text-[26px] font-normal' style={{ color: '#ffffff' }}>Choose your content providers</h2>
                <p className='text-xl font-normal' style={{ color: '#888888' }}>Select the AI engines that will generate your slide text and visuals.</p>
            </div>
            <div className='flex items-center gap-2 rounded-[10px] px-6 py-2.5 my-[54px]' style={{ background: '#1d1d1d', border: '1px solid #383838' }}>
                <Info className='w-4 h-4' style={{ color: '#888888' }} />
                <p className='text-sm font-medium' style={{ color: '#888888' }}>Runs locally on your device. Your API keys and generation setup stay on your machine.</p>
            </div>

            {/* Text Provider */}
            <div className='p-3 rounded-[10px]' style={{ border: '1px solid #383838', background: '#1d1d1d' }}>
                <div className="flex items-center gap-[24.3px]  mb-[42px]">
                    <div className='w-[74px] h-[74px] rounded-[10px] pt-[16.8px] pr-[17.15px] pb-[17.2px] pl-[16.85px] flex items-center justify-center'
                        style={{ backgroundColor: '#000000', border: '1px solid #383838' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
                            <path d="M20 6.6665V33.3332" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6.66666 11.6665V8.33317C6.66666 7.89114 6.84225 7.46722 7.15481 7.15466C7.46737 6.8421 7.8913 6.6665 8.33332 6.6665H31.6667C32.1087 6.6665 32.5326 6.8421 32.8452 7.15466C33.1577 7.46722 33.3333 7.89114 33.3333 8.33317V11.6665" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M15 33.3335H25" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <div className='w-full'>

                        <h3 className="text-xl font-normal pb-1.5" style={{ color: '#ffffff' }}>Text Generation Settings</h3>
                        <p className=" text-sm" style={{ color: '#888888' }}>
                            Choosing where text content comes from
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-2.5 my-[30px]'>
                    <div className='w-full h-[1px]' style={{ background: '#383838' }} />
                    <p className='text-xs font-normal' style={{ color: '#888888' }}>OR</p>
                    <div className='w-full h-[1px]' style={{ background: '#383838' }} />
                </div>
                <div className='flex flex-col items-start gap-4 '>
                    <div className="flex flex-col justify-start w-full ">

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
                                    className=" h-12 px-4 py-4 outline-none border rounded-[10px] transition-colors hover:border-border justify-between" style={{ borderColor: '#383838' }}
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
                                className="p-0 w-full "
                                align="end"

                            >
                                <Command>
                                    <CommandInput placeholder="Search provider..." />
                                    <CommandList className='hide-scrollbar'>
                                        <CommandEmpty>No provider found.</CommandEmpty>
                                        <CommandGroup >
                                            {Object.values(LLM_PROVIDERS).map(
                                                (provider: any, index: number) => (
                                                    <CommandItem
                                                        key={index}
                                                        value={provider.value}
                                                        onSelect={() => handleProviderChange(provider.value)}
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
                    <div className="relative flex flex-col justify-end  items-end  w-full ">
                        <div className="flex flex-col justify-start w-full ">
                            {llmConfig.LLM === 'ollama' ? (
                                <>
                                    {!useCustomOllamaUrl ? (
                                        <button
                                            type="button"
                                            onClick={() => setLlmConfig((prev: LLMConfig) => ({
                                                ...prev,
                                                USE_CUSTOM_URL: true,
                                                OLLAMA_URL: prev.OLLAMA_URL || 'http://localhost:11434'
                                            }))}
                                            className="py-2.5 px-3.5 w-fit rounded-[10px] text-xs font-semibold transition-all duration-200" style={{ background: '#1d1d1d', color: '#ffffff', border: '1px solid #383838' }}
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
                                                    onChange={(e) => setLlmConfig((prev: LLMConfig) => ({
                                                        ...prev,
                                                        OLLAMA_URL: e.target.value
                                                    }))}
                                                    className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                                    placeholder="http://localhost:11434"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setLlmConfig((prev: LLMConfig) => ({
                                                    ...prev,
                                                    USE_CUSTOM_URL: false,
                                                    OLLAMA_URL: 'http://localhost:11434'
                                                }))}
                                                className="mt-2 text-xs font-medium underline underline-offset-2" style={{ color: '#888888' }}
                                            >
                                                Use default Ollama URL
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className='flex items-center justify-between mb-2'>

                                        <label className="block text-sm font-medium capitalize text-foreground ">
                                            {providerApiKeyLabel}
                                        </label>
                                        {llmConfig.LLM && LLM_PROVIDERS[llmConfig.LLM!]?.getApiKeyUrl && <a href={LLM_PROVIDERS[llmConfig.LLM!]?.getApiKeyUrl || ""} target='_blank' className='text-xs font-normal flex items-center gap-1' style={{ color: '#888888' }}>Get API Key <ArrowUpRight className='w-3.5 h-3.5' /></a>}
                                    </div>

                                    <div className="relative">
                                        <input
                                            type={showApiKey ? 'text' : 'password'}
                                            value={currentApiKey}
                                            onChange={(e) => setLlmConfig((prev: LLMConfig) => ({
                                                ...prev,
                                                [currentApiKeyField]: e.target.value
                                            }))}
                                            className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                            placeholder={`Enter your ${providerApiKeyLabel}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey((prev) => !prev)}
                                            className='absolute right-2 top-1/2 -translate-y-1/2 bg-card px-2 py-1 cursor-pointer'
                                        >
                                            {showApiKey ? <Eye className='w-4 h-4 text-muted-foreground' /> : <EyeOff className='w-4 h-4 text-muted-foreground' />}
                                        </button>
                                    </div>
                                </>
                            )}
                            {llmConfig.LLM === 'custom' && (
                                <input
                                    type="text"
                                    value={llmConfig.CUSTOM_LLM_URL}
                                    onChange={(e) => setLlmConfig((prev: LLMConfig) => ({
                                        ...prev,
                                        CUSTOM_LLM_URL: e.target.value
                                    }))}
                                    className="w-full mt-2 px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                    placeholder="OpenAI-compatible URL"
                                />
                            )}
                            {llmConfig.LLM === 'vertex' && (
                                <div className="mt-2 space-y-2">
                                    <input
                                        type="text"
                                        value={llmConfig.VERTEX_PROJECT || ''}
                                        onChange={(e) => setLlmConfig((prev: LLMConfig) => ({
                                            ...prev,
                                            VERTEX_PROJECT: e.target.value
                                        }))}
                                        className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                        placeholder="GCP project (optional if API key used)"
                                    />
                                    <input
                                        type="text"
                                        value={llmConfig.VERTEX_LOCATION || ''}
                                        onChange={(e) => setLlmConfig((prev: LLMConfig) => ({
                                            ...prev,
                                            VERTEX_LOCATION: e.target.value
                                        }))}
                                        className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                        placeholder="GCP location (optional)"
                                    />
                                    <input
                                        type="text"
                                        value={llmConfig.VERTEX_BASE_URL || ''}
                                        onChange={(e) => setLlmConfig((prev: LLMConfig) => ({
                                            ...prev,
                                            VERTEX_BASE_URL: e.target.value
                                        }))}
                                        className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                        placeholder="Vertex base URL (optional)"
                                    />
                                </div>
                            )}
                            {llmConfig.LLM === 'azure' && (
                                <div className="mt-2 space-y-2">
                                    <input
                                        type="text"
                                        value={llmConfig.AZURE_OPENAI_ENDPOINT || ''}
                                        onChange={(e) => setLlmConfig((prev: LLMConfig) => ({
                                            ...prev,
                                            AZURE_OPENAI_ENDPOINT: e.target.value
                                        }))}
                                        className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                        placeholder="Azure endpoint (https://...openai.azure.com)"
                                    />
                                    <input
                                        type="text"
                                        value={llmConfig.AZURE_OPENAI_BASE_URL || ''}
                                        onChange={(e) => setLlmConfig((prev: LLMConfig) => ({
                                            ...prev,
                                            AZURE_OPENAI_BASE_URL: e.target.value
                                        }))}
                                        className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                        placeholder="Azure base URL (optional alternative)"
                                    />
                                    <input
                                        type="text"
                                        value={llmConfig.AZURE_OPENAI_API_VERSION || ''}
                                        onChange={(e) => setLlmConfig((prev: LLMConfig) => ({
                                            ...prev,
                                            AZURE_OPENAI_API_VERSION: e.target.value
                                        }))}
                                        className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                        placeholder="API version (e.g. 2024-10-21)"
                                    />
                                    <input
                                        type="text"
                                        value={llmConfig.AZURE_OPENAI_DEPLOYMENT || ''}
                                        onChange={(e) => setLlmConfig((prev: LLMConfig) => ({
                                            ...prev,
                                            AZURE_OPENAI_DEPLOYMENT: e.target.value
                                        }))}
                                        className="w-full px-2 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                        placeholder="Deployment name (optional)"
                                    />
                                </div>
                            )}


                        </div>


                        {!isManualModelProvider && llmConfig.LLM !== 'ollama' && llmConfig.LLM !== 'chatgpt' && llmConfig.LLM !== 'codex' && (!modelsChecked || (modelsChecked && availableModels.length === 0)) && (

                            <button
                                onClick={fetchAvailableModels}
                                disabled={
                                    modelsLoading ||
                                    (llmConfig.LLM === 'openai' && !currentApiKey) ||
                                    (llmConfig.LLM === 'google' && !currentApiKey) ||
                                    (llmConfig.LLM === 'anthropic' && !currentApiKey) ||
                                    (llmConfig.LLM === 'custom' && !llmConfig.CUSTOM_LLM_URL)
                                }
                                className={`mt-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed px-3.5 w-full rounded-[10px] text-xs font-semibold transition-all duration-200`}
                                style={{ background: modelsLoading ? '#000000' : '#ffffff', color: modelsLoading ? '#888888' : '#000000', border: '1px solid #383838' }}
                            >
                                {modelsLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Checking for models...
                                    </span>
                                ) : (
                                    "Validate & Load Models"
                                )}
                            </button>
                        )}
                    </div>

                </div>
                <div className='flex items-start gap-4 mt-4'>


                    {/* Model Selection - only show if models are available */}
                    {!isManualModelProvider && llmConfig.LLM !== 'chatgpt' && llmConfig.LLM !== 'codex' && modelsChecked && availableModels.length > 0 && (
                        <div className="w-full">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    {llmConfig.LLM === 'ollama' ? 'Choose a supported model' : `Select ${LLM_PROVIDERS[llmConfig.LLM!]?.label} Model`}
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
                                                className="w-full h-12 px-4 py-4 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground hover:border-[#ffffff] justify-between"
                                            >
                                                <span className="text-sm truncate font-medium text-foreground">
                                                    {
                                                        currentModel
                                                            ? availableModels.find(model => model === currentModel) || currentModel
                                                            :
                                                            "Select a model"
                                                    }
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
                                                        {availableModels.map((model, index) => (
                                                            <CommandItem
                                                                key={index}
                                                                value={model}
                                                                onSelect={(value) => {
                                                                    if (currentModelField) {
                                                                        setLlmConfig((prev: LLMConfig) => ({
                                                                            ...prev,
                                                                            [currentModelField]: value
                                                                        }));
                                                                    }
                                                                    setOpenModelSelect(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        currentModel === model
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                <div className="flex gap-3 items-center">
                                                                    <div className="flex flex-col space-y-1 flex-1">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-sm font-medium text-foreground">
                                                                                {model}
                                                                            </span>
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
                    )}
                    {isManualModelProvider && (
                        <div className="w-full">
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Enter {LLM_PROVIDERS[llmConfig.LLM!]?.label} Model
                            </label>
                            <input
                                type="text"
                                value={currentModel}
                                onChange={(e) => {
                                    if (currentModelField) {
                                        setLlmConfig(prev => ({
                                            ...prev,
                                            [currentModelField]: e.target.value
                                        }));
                                    }
                                }}
                                className="w-full h-12 px-4 py-3 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                placeholder={llmConfig.LLM === 'vertex' ? 'e.g. gemini-2.5-flash' : 'e.g. gpt-4.1'}
                            />
                        </div>
                    )}
                </div>
            </div>
            {/* Image Provider */}
            <div className={`p-3 rounded-[10px] relative mt-5`} style={{ border: '1px solid #383838', background: llmConfig.DISABLE_IMAGE_GENERATION ? '#000000' : '#1d1d1d' }}>
                <ToolTip content="Enable/Disable Image Generation" className='flex justify-end items-center absolute top-3 right-3'>
                    <div className='flex justify-end items-center'>
                        <Switch
                            checked={!llmConfig.DISABLE_IMAGE_GENERATION}
                            className='data-[state=checked]:bg-[#ffffff] h-[22px] w-[36px] data-[state=unchecked]:bg-[#383838]'
                            onCheckedChange={(checked: boolean) => setLlmConfig((prev: LLMConfig) => ({
                                ...prev,
                                DISABLE_IMAGE_GENERATION: !checked
                            }))}
                        />
                    </div>

                </ToolTip>
                <div className={` flex items-center gap-6 ${llmConfig.DISABLE_IMAGE_GENERATION ? "" : "mb-[42px]"}`}>
                    <div className='w-[74px] h-[74px] px-[13.5px] py-[14.2px] rounded-[10px] flex items-center justify-center'
                        style={{ backgroundColor: '#000000', border: '1px solid #383838' }}
                    >
                        <img src="/image-markup.svg" className='w-full h-full object-cover' alt='image-markup' />
                    </div>
                    <div>

                        <h3 className="text-xl font-normal" style={{ color: '#ffffff' }}>Image Generation Settings</h3>
                        <p className="text-sm" style={{ color: '#888888' }}>
                            Choosing where images come from
                        </p>
                    </div>
                </div>
                {!llmConfig.DISABLE_IMAGE_GENERATION && (
                    <div className='flex flex-col gap-4'>
                        {/* Image Provider Selection */}
                        <div className="w-full">
                            <label className="block text-sm font-medium text-foreground mb-2">
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
                                            className=" w-full h-12 px-4 py-4 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground hover:border-[#ffffff] justify-between"
                                        >
                                            <div className="flex gap-3 items-center">
                                                <span className="text-sm font-medium capitalize text-foreground">
                                                    {llmConfig.IMAGE_PROVIDER
                                                        ? IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]
                                                            ?.label || llmConfig.IMAGE_PROVIDER
                                                        : 'Select Image Provider'}
                                                </span>
                                            </div>
                                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="p-0 w-full"
                                        align="start"

                                    >
                                        <Command>
                                            <CommandInput placeholder="Search provider..." />
                                            <CommandList>
                                                <CommandEmpty>No provider found.</CommandEmpty>
                                                <CommandGroup>
                                                    {Object.values(IMAGE_PROVIDERS).map(
                                                        (provider: any, index: number) => (
                                                            <CommandItem
                                                                key={index}
                                                                value={provider.value}
                                                                onSelect={(value) => {
                                                                    setLlmConfig(prev => ({
                                                                        ...prev,
                                                                        IMAGE_PROVIDER: value
                                                                    }));
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



                        {/* Dynamic API Key Input for Image Provider */}
                        {llmConfig.IMAGE_PROVIDER &&
                            IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER] &&
                            (() => {
                                const provider = IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER];



                                // Show ComfyUI configuration
                                if (provider.value === "comfyui") {
                                    return (
                                        <div className=" space-y-4 w-full">
                                            <div className=''>
                                                <label className="block text-sm font-medium text-foreground mb-2">
                                                    ComfyUI Server URL
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="http://192.168.1.7:8188"
                                                        className="w-full px-4 py-2.5 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                                        value={llmConfig.COMFYUI_URL || ""}
                                                        onChange={(e) => {
                                                            setLlmConfig(prev => ({
                                                                ...prev,
                                                                COMFYUI_URL: e.target.value
                                                            }));
                                                        }}
                                                    />
                                                </div>

                                            </div>

                                        </div>
                                    );
                                }

                                // Show API key input for other providers
                                return (
                                    <div className="w-full ">
                                        <div className='flex items-center justify-between mb-2'>

                                            <label className="block text-sm font-medium text-foreground">
                                                {provider.apiKeyFieldLabel}
                                            </label>
                                            {provider.getApiKeyUrl && <a href={provider.getApiKeyUrl || ""} target='_blank' className='text-xs font-normal flex items-center gap-1' style={{ color: '#888888' }}>Get API Key <ArrowUpRight className='w-3.5 h-3.5' /></a>}
                                        </div>
                                        <div className="relative">
                                            <input
                                                type={showApiKey ? 'text' : 'password'}
                                                placeholder={`Enter your ${provider.apiKeyFieldLabel}`}
                                                className="w-full px-4 py-2.5 h-12 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground"
                                                value={getFieldValue(provider.apiKeyField)}
                                                onChange={(e) => {
                                                    setLlmConfig((prev: LLMConfig) => ({
                                                        ...prev,
                                                        [provider.apiKeyField as keyof LLMConfig]: e.target.value
                                                    }))
                                                }

                                                }
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKey((prev) => !prev)}
                                                className='absolute right-2 top-1/2 -translate-y-1/2 bg-card px-2 py-1 cursor-pointer'
                                            >
                                                {showApiKey ? <Eye className='w-4 h-4 text-muted-foreground' /> : <EyeOff className='w-4 h-4 text-muted-foreground' />}
                                            </button>
                                        </div>

                                    </div>
                                );
                            })()}

                    </div>
                )}
                {!llmConfig.DISABLE_IMAGE_GENERATION && <div className='flex flex-col justify-end items-center mt-[18px]'>
                    <div className='w-full flex items-center gap-4'>

                        {renderQualitySelector(llmConfig)}
                    </div>
                    {llmConfig.IMAGE_PROVIDER === "comfyui" && <div className='w-full'>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Workflow JSON
                        </label>
                        <div className="relative">
                            <textarea
                                placeholder='Paste your ComfyUI workflow JSON here (export via "Export (API)" in ComfyUI)'
                                className="w-full px-4 py-2.5 outline-none border border-[#383838] rounded-lg focus:ring-2 focus:ring-ring/30 focus:border-[#ffffff] transition-colors bg-transparent text-foreground font-mono text-xs"
                                rows={3}
                                value={llmConfig.COMFYUI_WORKFLOW || ""}
                                onChange={(e) => {
                                    setLlmConfig((prev) => ({
                                        ...prev,
                                        COMFYUI_WORKFLOW: e.target.value
                                    }))
                                }}
                            />
                        </div>

                    </div>}
                </div>}
            </div>

            <div className='fixed bottom-16 mr-8  max-w-[1440px]  right-16 flex justify-end items-center gap-2.5 '>
                <button
                    disabled={currentStep === 1}
                    onClick={() => {
                        setStep(currentStep - 1);
                    }}
                    className='rounded-[10px] px-4 py-1 h-[36px]' style={{ border: '1px solid #383838', color: '#888888' }}>
                    <ChevronLeft className='w-4 h-4' />
                </button>
                <button

                    disabled={savingConfig}
                    onClick={handleSaveConfig}
                    className='rounded-[10px] px-5 py-2.5 text-xs font-semibold' style={{ background: '#ffffff', color: '#000000' }}>
                    Continue to Finish
                </button>
            </div>

        </div>
    )
}

export default DeckforgeMode
