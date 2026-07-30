import os


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_can_change_keys_env():
    return os.getenv("CAN_CHANGE_KEYS")


def get_database_url_env():
    return os.getenv("DATABASE_URL")


def get_app_data_directory_env():
    path = os.getenv("APP_DATA_DIRECTORY") or "app_data"
    return os.path.abspath(path)


def get_temp_directory_env():
    path = os.getenv("TEMP_DIRECTORY") or "app_data/temp"
    return os.path.abspath(path)


def get_user_config_path_env():
    path = os.getenv("USER_CONFIG_PATH") or "app_data/userConfig.json"
    return os.path.abspath(path)


def get_disable_auth_env():
    return os.getenv("DISABLE_AUTH")


def is_disable_auth_enabled():
    return _is_truthy(get_disable_auth_env())


def get_llm_provider_env():
    return os.getenv("LLM")


def get_anthropic_api_key_env():
    return os.getenv("ANTHROPIC_API_KEY")


def get_anthropic_model_env():
    return os.getenv("ANTHROPIC_MODEL")


def get_ollama_url_env():
    return os.getenv("OLLAMA_URL") or "http://127.0.0.1:11434"


def get_custom_llm_url_env():
    return os.getenv("CUSTOM_LLM_URL")


def get_openai_api_key_env():
    return os.getenv("OPENAI_API_KEY")


def get_openai_model_env():
    return os.getenv("OPENAI_MODEL")


def get_google_api_key_env():
    return os.getenv("GOOGLE_API_KEY")


def get_google_model_env():
    return os.getenv("GOOGLE_MODEL")


def get_vertex_api_key_env():
    return os.getenv("VERTEX_API_KEY")


def get_vertex_model_env():
    return os.getenv("VERTEX_MODEL")


def get_vertex_project_env():
    return os.getenv("VERTEX_PROJECT")


def get_vertex_location_env():
    return os.getenv("VERTEX_LOCATION")


def get_vertex_base_url_env():
    return os.getenv("VERTEX_BASE_URL")


def get_azure_openai_api_key_env():
    return os.getenv("AZURE_OPENAI_API_KEY")


def get_azure_openai_model_env():
    return os.getenv("AZURE_OPENAI_MODEL")


def get_azure_openai_endpoint_env():
    return os.getenv("AZURE_OPENAI_ENDPOINT")


def get_azure_openai_base_url_env():
    return os.getenv("AZURE_OPENAI_BASE_URL")


def get_azure_openai_api_version_env():
    return os.getenv("AZURE_OPENAI_API_VERSION")


def get_azure_openai_deployment_env():
    return os.getenv("AZURE_OPENAI_DEPLOYMENT")


def get_custom_llm_api_key_env():
    return os.getenv("CUSTOM_LLM_API_KEY")


def get_ollama_model_env():
    return os.getenv("OLLAMA_MODEL")


def get_custom_model_env():
    return os.getenv("CUSTOM_MODEL")


def get_pexels_api_key_env():
    return os.getenv("PEXELS_API_KEY")


def get_disable_image_generation_env():
    return os.getenv("DISABLE_IMAGE_GENERATION")


def get_image_provider_env():
    return os.getenv("IMAGE_PROVIDER")


def get_pixabay_api_key_env():
    return os.getenv("PIXABAY_API_KEY")


def get_disable_thinking_env():
    return os.getenv("DISABLE_THINKING")


def get_extended_reasoning_env():
    return os.getenv("EXTENDED_REASONING")


def get_web_grounding_env():
    return os.getenv("WEB_GROUNDING")


def get_comfyui_url_env():
    return os.getenv("COMFYUI_URL")


def get_comfyui_workflow_env():
    return os.getenv("COMFYUI_WORKFLOW")


# Dalle 3 Quality
def get_dall_e_3_quality_env():
    return os.getenv("DALL_E_3_QUALITY")


# Gpt Image 1.5 Quality
def get_gpt_image_1_5_quality_env():
    return os.getenv("GPT_IMAGE_1_5_QUALITY")


def get_migrate_database_on_startup_env():
    return os.getenv("MIGRATE_DATABASE_ON_STARTUP")


# Open WebUI Image Provider
def get_open_webui_image_url_env():
    return os.getenv("OPEN_WEBUI_IMAGE_URL")


def get_open_webui_image_api_key_env():
    return os.getenv("OPEN_WEBUI_IMAGE_API_KEY")
