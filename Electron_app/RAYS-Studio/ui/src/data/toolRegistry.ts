export type EnvVarInfo = {
  description: string;
  prompt: string;
  url?: string | null;
  password?: boolean;
  category: string;
  advanced?: boolean;
  tools?: string[];
};

export const TOOL_REGISTRY: Record<string, EnvVarInfo> = {
  "EXA_API_KEY": {
    "description": "Exa API key for AI-native web search and contents",
    "prompt": "Exa API key",
    "url": "https://exa.ai/",
    "tools": [
      "web_search",
      "web_extract"
    ],
    "password": true,
    "category": "tool"
  },
  "PARALLEL_API_KEY": {
    "description": "Parallel API key for AI-native web search and extract",
    "prompt": "Parallel API key",
    "url": "https://parallel.ai/",
    "tools": [
      "web_search",
      "web_extract"
    ],
    "password": true,
    "category": "tool"
  },
  "FIRECRAWL_API_KEY": {
    "description": "Firecrawl API key for web search and scraping",
    "prompt": "Firecrawl API key",
    "url": "https://firecrawl.dev/",
    "tools": [
      "web_search",
      "web_extract"
    ],
    "password": true,
    "category": "tool"
  },
  "FIRECRAWL_API_URL": {
    "description": "Firecrawl API URL for self-hosted instances (optional)",
    "prompt": "Firecrawl API URL (leave empty for cloud)",
    "url": null,
    "password": false,
    "category": "tool",
    "advanced": true
  },
  "FIRECRAWL_GATEWAY_URL": {
    "description": "Exact Firecrawl tool-gateway origin override for Nous Subscribers only (optional)",
    "prompt": "Firecrawl gateway URL (leave empty to derive from domain)",
    "url": null,
    "password": false,
    "category": "tool",
    "advanced": true
  },
  "TOOL_GATEWAY_DOMAIN": {
    "description": "Shared tool-gateway domain suffix for Nous Subscribers only, used to derive vendor hosts, e.g. nousresearch.com -> firecrawl-gateway.nousresearch.com",
    "prompt": "Tool-gateway domain suffix",
    "url": null,
    "password": false,
    "category": "tool",
    "advanced": true
  },
  "TOOL_GATEWAY_SCHEME": {
    "description": "Shared tool-gateway URL scheme for Nous Subscribers only, used to derive vendor hosts (`https` by default, set `http` for local gateway testing)",
    "prompt": "Tool-gateway URL scheme",
    "url": null,
    "password": false,
    "category": "tool",
    "advanced": true
  },
  "TOOL_GATEWAY_USER_TOKEN": {
    "description": "Explicit Nous Subscriber access token for tool-gateway requests (optional; otherwise read from the Hermes auth store)",
    "prompt": "Tool-gateway user token",
    "url": null,
    "password": true,
    "category": "tool",
    "advanced": true
  },
  "TAVILY_API_KEY": {
    "description": "Tavily API key for AI-native web search and extract",
    "prompt": "Tavily API key",
    "url": "https://app.tavily.com/home",
    "tools": [
      "web_search",
      "web_extract"
    ],
    "password": true,
    "category": "tool"
  },
  "SEARXNG_URL": {
    "description": "URL of your SearXNG instance for free self-hosted web search",
    "prompt": "SearXNG URL (e.g. http://localhost:8080)",
    "url": "https://searxng.github.io/searxng/",
    "tools": [
      "web_search"
    ],
    "password": false,
    "category": "tool"
  },
  "BRAVE_SEARCH_API_KEY": {
    "description": "Brave Search API subscription token (free tier: 2,000 queries/mo)",
    "prompt": "Brave Search subscription token",
    "url": "https://brave.com/search/api/",
    "tools": [
      "web_search"
    ],
    "password": true,
    "category": "tool"
  },
  "BROWSERBASE_API_KEY": {
    "description": "Browserbase API key for cloud browser (optional \u2014 local browser works without this)",
    "prompt": "Browserbase API key",
    "url": "https://browserbase.com/",
    "tools": [
      "browser_navigate",
      "browser_click"
    ],
    "password": true,
    "category": "tool"
  },
  "BROWSERBASE_PROJECT_ID": {
    "description": "Browserbase project ID (optional \u2014 only needed for cloud browser)",
    "prompt": "Browserbase project ID",
    "url": "https://browserbase.com/",
    "tools": [
      "browser_navigate",
      "browser_click"
    ],
    "password": false,
    "category": "tool"
  },
  "BROWSER_USE_API_KEY": {
    "description": "Browser Use API key for cloud browser (optional \u2014 local browser works without this)",
    "prompt": "Browser Use API key",
    "url": "https://browser-use.com/",
    "tools": [
      "browser_navigate",
      "browser_click"
    ],
    "password": true,
    "category": "tool"
  },
  "FIRECRAWL_BROWSER_TTL": {
    "description": "Firecrawl browser session TTL in seconds (optional, default 300)",
    "prompt": "Browser session TTL (seconds)",
    "tools": [
      "browser_navigate",
      "browser_click"
    ],
    "password": false,
    "category": "tool"
  },
  "AGENT_BROWSER_ENGINE": {
    "description": "Browser engine for local mode: auto (default Chrome), lightpanda (faster, no screenshots), chrome",
    "prompt": "Browser engine (auto/lightpanda/chrome)",
    "url": "https://github.com/vercel-labs/agent-browser",
    "tools": [
      "browser_navigate",
      "browser_snapshot",
      "browser_click",
      "browser_vision"
    ],
    "password": false,
    "category": "tool",
    "advanced": true
  },
  "CAMOFOX_URL": {
    "description": "Camofox browser server URL for local anti-detection browsing (e.g. http://localhost:9377)",
    "prompt": "Camofox server URL",
    "url": "https://github.com/jo-inc/camofox-browser",
    "tools": [
      "browser_navigate",
      "browser_click"
    ],
    "password": false,
    "category": "tool"
  },
  "CAMOFOX_API_KEY": {
    "description": "Optional bearer token sent as Authorization header to a remote/authenticated Camofox server",
    "prompt": "Camofox API key",
    "url": "https://github.com/jo-inc/camofox-browser",
    "tools": [
      "browser_navigate",
      "browser_click"
    ],
    "password": true,
    "category": "tool",
    "advanced": true
  },
  "FAL_KEY": {
    "description": "FAL API key for image and video generation",
    "prompt": "FAL API key",
    "url": "https://fal.ai/",
    "tools": [
      "image_generate",
      "video_generate"
    ],
    "password": true,
    "category": "tool"
  },
  "KREA_API_KEY": {
    "description": "Krea API key for Krea 2 image generation (Medium + Large)",
    "prompt": "Krea API key",
    "url": "https://www.krea.ai/settings/api-tokens",
    "tools": [
      "image_generate"
    ],
    "password": true,
    "category": "tool"
  },
  "VOICE_TOOLS_OPENAI_KEY": {
    "description": "OpenAI API key for voice transcription (Whisper) and OpenAI TTS",
    "prompt": "OpenAI API Key (for Whisper STT + TTS)",
    "url": "https://platform.openai.com/api-keys",
    "tools": [
      "voice_transcription",
      "openai_tts"
    ],
    "password": true,
    "category": "tool"
  },
  "ELEVENLABS_API_KEY": {
    "description": "ElevenLabs API key for premium text-to-speech voices and Scribe transcription",
    "prompt": "ElevenLabs API key",
    "url": "https://elevenlabs.io/",
    "tools": [
      "elevenlabs_tts",
      "voice_transcription"
    ],
    "password": true,
    "category": "tool"
  },
  "MISTRAL_API_KEY": {
    "description": "Mistral API key for Voxtral TTS and transcription (STT)",
    "prompt": "Mistral API key",
    "url": "https://console.mistral.ai/",
    "password": true,
    "category": "tool"
  },
  "GITHUB_TOKEN": {
    "description": "GitHub token for Skills Hub (higher API rate limits, skill publish)",
    "prompt": "GitHub Token",
    "url": "https://github.com/settings/tokens",
    "password": true,
    "category": "tool"
  },
  "HONCHO_API_KEY": {
    "description": "Honcho API key for AI-native persistent memory",
    "prompt": "Honcho API key",
    "url": "https://app.honcho.dev",
    "tools": [
      "honcho_context"
    ],
    "password": true,
    "category": "tool"
  },
  "HONCHO_BASE_URL": {
    "description": "Base URL for self-hosted Honcho instances (no API key needed)",
    "prompt": "Honcho base URL (e.g. http://localhost:8000)",
    "category": "tool"
  },
  "HINDSIGHT_API_KEY": {
    "description": "Hindsight API key for graph-aware persistent memory",
    "prompt": "Hindsight API key",
    "url": "https://hindsight.vectorize.io",
    "tools": [
      "hindsight_recall"
    ],
    "password": true,
    "category": "tool"
  },
  "HINDSIGHT_API_URL": {
    "description": "Base URL for the Hindsight API (default: https://api.hindsight.vectorize.io)",
    "prompt": "Hindsight API URL",
    "category": "tool",
    "advanced": true
  },
  "SUPERMEMORY_API_KEY": {
    "description": "Supermemory API key for conversation-scoped persistent memory",
    "prompt": "Supermemory API key",
    "url": "https://supermemory.ai",
    "tools": [
      "supermemory_search"
    ],
    "password": true,
    "category": "tool"
  },
  "MEM0_API_KEY": {
    "description": "Mem0 Platform API key for semantic persistent memory",
    "prompt": "Mem0 API key",
    "url": "https://app.mem0.ai",
    "tools": [
      "mem0_search"
    ],
    "password": true,
    "category": "tool"
  },
  "RETAINDB_API_KEY": {
    "description": "RetainDB API key for persistent memory",
    "prompt": "RetainDB API key",
    "url": "https://retaindb.com",
    "tools": [
      "retaindb_search"
    ],
    "password": true,
    "category": "tool"
  },
  "RETAINDB_BASE_URL": {
    "description": "Base URL for self-hosted RetainDB instances (default: https://api.retaindb.com)",
    "prompt": "RetainDB base URL",
    "category": "tool",
    "advanced": true
  },
  "BRV_API_KEY": {
    "description": "ByteRover API key (optional, for cloud sync \u2014 local-first by default)",
    "prompt": "ByteRover API key",
    "url": "https://app.byterover.dev",
    "tools": [
      "brv_query"
    ],
    "password": true,
    "category": "tool"
  },
  "OPENVIKING_API_KEY": {
    "description": "OpenViking API key (leave blank for local dev mode)",
    "prompt": "OpenViking API key",
    "tools": [
      "viking_search"
    ],
    "password": true,
    "category": "tool"
  },
  "OPENVIKING_ENDPOINT": {
    "description": "OpenViking server URL (default: http://127.0.0.1:1933)",
    "prompt": "OpenViking endpoint",
    "category": "tool",
    "advanced": true
  },
  "HERMES_LANGFUSE_PUBLIC_KEY": {
    "description": "Langfuse project public key (pk-lf-...)",
    "prompt": "Langfuse public key",
    "url": "https://cloud.langfuse.com",
    "password": false,
    "category": "tool"
  },
  "HERMES_LANGFUSE_SECRET_KEY": {
    "description": "Langfuse project secret key (sk-lf-...)",
    "prompt": "Langfuse secret key",
    "url": "https://cloud.langfuse.com",
    "password": true,
    "category": "tool"
  },
  "HERMES_LANGFUSE_BASE_URL": {
    "description": "Langfuse server URL (default: https://cloud.langfuse.com)",
    "prompt": "Langfuse server URL (leave empty for cloud.langfuse.com)",
    "url": null,
    "password": false,
    "category": "tool",
    "advanced": true
  }
};
