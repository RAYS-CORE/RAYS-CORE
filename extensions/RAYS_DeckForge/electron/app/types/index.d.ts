interface FastApiEnv {
  DEBUG?: string,
  CAN_CHANGE_KEYS?: string,
  LLM?: string,
  OPENAI_API_KEY?: string,
  OPENAI_MODEL?: string,
  GOOGLE_API_KEY?: string,
  GOOGLE_MODEL?: string,
  ANTHROPIC_API_KEY?: string,
  ANTHROPIC_MODEL?: string,
  OLLAMA_URL?: string,
  OLLAMA_MODEL?: string,
  CUSTOM_LLM_URL?: string,
  CUSTOM_LLM_API_KEY?: string,
  CUSTOM_MODEL?: string,
  PEXELS_API_KEY?: string,
  PIXABAY_API_KEY?: string,
  IMAGE_PROVIDER?: string,
  DISABLE_IMAGE_GENERATION?: string,
  EXTENDED_REASONING?: string,
  TOOL_CALLS?: string,
  DISABLE_THINKING?: string,
  WEB_GROUNDING?: string,
  DATABASE_URL?: string,
  DISABLE_ANONYMOUS_TRACKING?: string,
  COMFYUI_URL?: string,
  COMFYUI_WORKFLOW?: string,
  DALL_E_3_QUALITY?: string,
  GPT_IMAGE_1_5_QUALITY?: string,
  APP_DATA_DIRECTORY?: string,
  FASTAPI_PUBLIC_URL?: string,
  TEMP_DIRECTORY?: string,
  USER_CONFIG_PATH?: string,
  MIGRATE_DATABASE_ON_STARTUP?: string,
  DISABLE_AUTH?: string,
  /** Absolute path to the resolved LibreOffice executable discovered at startup. */
  SOFFICE_PATH?: string,
  /** Absolute path to the ImageMagick binary resolved at startup by imagemagick-check.ts. */
  IMAGEMAGICK_BINARY?: string,
  /** Absolute path to the bundled LiteParse runner script. */
  LITEPARSE_RUNNER_PATH?: string,
  /** Binary path used by LiteParseService to execute liteparse_runner.mjs. */
  LITEPARSE_NODE_BINARY?: string,
  /** Set to "1" when using the Electron binary as a Node runtime. */
  ELECTRON_RUN_AS_NODE?: string,
  /** Root directory of the bundled presentation export runtime package. */
  EXPORT_PACKAGE_ROOT?: string,
  /** Directory used by FastAPI export task runtime resolution. */
  EXPORT_RUNTIME_DIR?: string,
  /** Absolute path to bundled PyInstaller converter binary for export runtime. */
  BUILT_PYTHON_MODULE_PATH?: string,
}

interface NextJsEnv {
  NEXT_PUBLIC_FAST_API?: string,
  FAST_API_INTERNAL_URL?: string,
  TEMP_DIRECTORY?: string,
  NEXT_PUBLIC_URL?: string,
  NEXT_PUBLIC_USER_CONFIG_PATH?: string,
  USER_CONFIG_PATH?: string,
  APP_DATA_DIRECTORY?: string,
  DISABLE_AUTH?: string,
  EXPORT_PACKAGE_ROOT?: string,
  DECKFORGE_APP_ROOT?: string,
  BUILT_PYTHON_MODULE_PATH?: string,
  PUPPETEER_EXECUTABLE_PATH?: string,
}

interface UserConfig {
  CAN_CHANGE_KEYS?: string,
  LLM?: string,
  OPENAI_API_KEY?: string,
  OPENAI_MODEL?: string,
  GOOGLE_API_KEY?: string,
  GOOGLE_MODEL?: string,
  ANTHROPIC_API_KEY?: string,
  ANTHROPIC_MODEL?: string,
  OLLAMA_URL?: string,
  OLLAMA_MODEL?: string,
  CUSTOM_LLM_URL?: string,
  CUSTOM_LLM_API_KEY?: string,
  CUSTOM_MODEL?: string,
  PEXELS_API_KEY?: string,
  PIXABAY_API_KEY?: string,
  IMAGE_PROVIDER?: string,
  DISABLE_IMAGE_GENERATION?: string,
  EXTENDED_REASONING?: string,
  TOOL_CALLS?: string,
  DISABLE_THINKING?: string,
  WEB_GROUNDING?: string,
  DATABASE_URL?: string,
  DISABLE_ANONYMOUS_TRACKING?: string,
  COMFYUI_URL?: string,
  COMFYUI_WORKFLOW?: string,
  DALL_E_3_QUALITY?: string,
  GPT_IMAGE_1_5_QUALITY?: string,

}

interface IPCStatus {
  success: boolean,
  message?: string,
}
