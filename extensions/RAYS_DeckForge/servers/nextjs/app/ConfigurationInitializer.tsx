'use client';

import { useEffect, useRef, useState } from 'react';
import { setCanChangeKeys, setLLMConfig } from '@/store/slices/userConfig';
import { hasValidLLMConfig } from '@/utils/storeHelpers';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { checkIfSelectedOllamaModelIsPulled } from '@/utils/providerUtils';
import { LLMConfig } from '@/types/llm_config';
import { getApiUrl } from '@/utils/api';

export function ConfigurationInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();

  const route = usePathname();
  const [isLoading, setIsLoading] = useState(
    () => !route?.startsWith("/pdf-maker")
  );
  const router = useRouter();
  const hasRun = useRef(false);

  // Fetch user config state — only run once
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    fetchUserConfigState();
  }, []);

  // Hard safety timeout — never stay stuck on loading screen
  useEffect(() => {
    if (!isLoading) return;
    const timeout = setTimeout(() => {
      console.warn("[ConfigurationInitializer] Safety timeout — forcing loading=false");
      setIsLoading(false);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [isLoading]);

  const fetchUserConfigState = async () => {
    if (route.startsWith("/pdf-maker")) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      let canChangeKeys = false;
      try {
        const res = await fetch(getApiUrl('/api/v1/auth/can-change-keys'));
        const data = await res.json();
        canChangeKeys = data.canChange ?? false;
      } catch (e) {
        console.error('Failed to fetch can-change-keys:', e);
        canChangeKeys = false;
      }
      dispatch(setCanChangeKeys(canChangeKeys));

      if (canChangeKeys) {
        let llmConfig: LLMConfig = {};
        try {
          const res = await fetch(getApiUrl('/api/v1/auth/user-config'));
          llmConfig = await res.json();
        } catch (e) {
          console.error('Failed to fetch user config:', e);
          llmConfig = {};
        }
        if (!llmConfig.LLM) {
          llmConfig.LLM = 'openai';
        }

        dispatch(setLLMConfig(llmConfig));
        const isValid = hasValidLLMConfig(llmConfig, { skipImages: true });
        console.log("[ConfigurationInitializer] isValid (text only):", isValid, "route:", route);

        const isIndexRoute = route === '/' || route === '/index.html' || route === '/index';

        if (isValid) {
          // Check if the selected Ollama model is pulled
          if (llmConfig.LLM === 'ollama' && llmConfig.OLLAMA_MODEL) {
            try {
              const isPulled = await checkIfSelectedOllamaModelIsPulled(llmConfig.OLLAMA_MODEL);
              if (!isPulled) {
                console.log("[ConfigurationInitializer] Ollama model not pulled, redirecting to /");
                router.push('/');
                return;
              }
            } catch {
              // If check fails, proceed anyway
            }
          }
          if (llmConfig.LLM === 'custom') {
            try {
              const isAvailable = await checkIfSelectedCustomModelIsAvailable(llmConfig);
              if (!isAvailable) {
                console.log("[ConfigurationInitializer] Custom model not available, redirecting to /");
                router.push('/');
                return;
              }
            } catch {
              // If check fails, proceed anyway
            }
          }
          if (isIndexRoute) {
            console.log("[ConfigurationInitializer] Config valid, moving to /upload");
            router.push('/upload');
          }
        } else if (!isIndexRoute) {
          console.log("[ConfigurationInitializer] Config invalid, redirecting to / from", route);
          router.push('/');
        }
      } else {
        const isIndexRoute = route === '/' || route === '/index.html' || route === '/index';
        if (isIndexRoute) {
          router.push('/upload');
        }
      }
    } catch (e) {
      console.error('[ConfigurationInitializer] Unexpected error during initialization:', e);
    } finally {
      setIsLoading(false);
    }
  }


  const checkIfSelectedCustomModelIsAvailable = async (llmConfig: LLMConfig) => {
    try {
      const response = await fetch(getApiUrl('/api/v1/ppt/openai/models/available'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: llmConfig.CUSTOM_LLM_URL,
          api_key: llmConfig.CUSTOM_LLM_API_KEY,
        }),
      });
      const data = await response.json();
      return data.includes(llmConfig.CUSTOM_MODEL);
    } catch (error) {
      console.error('Error fetching custom models:', error);
      return false;
    }
  }


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#000000' }}>
        <div className="max-w-md w-full">
          <div className="rounded-[10px] p-8 text-center" style={{ background: '#1d1d1d', border: '1px solid #383838' }}>
            {/* RAYS Branding */}
            <div className="mb-6">
              <div className="text-2xl font-bold tracking-wider" style={{ color: '#ffffff', fontFamily: "'Space Mono', 'Fira Code', monospace" }}>RAYS</div>
              <div className="w-16 h-0.5 mx-auto mt-3 rounded-full" style={{ background: '#383838' }}></div>
            </div>

            {/* Loading Text */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold" style={{ color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>
                DeckForge
              </h3>
              <p className="text-sm" style={{ color: '#888888', fontFamily: "'Space Mono', monospace" }}>
                Initializing system…
              </p>
            </div>

            {/* Progress Indicator */}
            <div className="mt-6">
              <div className="flex space-x-1.5 justify-center">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#ffffff' }}></div>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#888888', animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#ffffff', animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
