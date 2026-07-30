from typing import Optional

from fastapi import HTTPException
from llmai.shared import (
    AnthropicClientConfig,
    AzureOpenAIClientConfig,
    ClientConfig,
    GoogleClientConfig,
    OpenAIApiType,
    OpenAIClientConfig,
    VertexAIClientConfig,
)

from enums.llm_provider import LLMProvider
from utils.get_env import (
    get_azure_openai_api_key_env,
    get_azure_openai_api_version_env,
    get_azure_openai_base_url_env,
    get_azure_openai_deployment_env,
    get_azure_openai_endpoint_env,
    get_anthropic_api_key_env,
    get_custom_llm_api_key_env,
    get_custom_llm_url_env,
    get_disable_thinking_env,
    get_google_api_key_env,
    get_ollama_url_env,
    get_openai_api_key_env,
    get_vertex_api_key_env,
    get_vertex_base_url_env,
    get_vertex_location_env,
    get_vertex_project_env,
    get_web_grounding_env,
)
from utils.llm_provider import get_llm_provider
from utils.parsers import parse_bool_or_none


def enable_web_grounding() -> bool:
    return parse_bool_or_none(get_web_grounding_env()) or False


def disable_thinking() -> bool:
    return parse_bool_or_none(get_disable_thinking_env()) or False


def get_llm_config() -> ClientConfig:
    llm_provider = get_llm_provider()

    match llm_provider:
        case LLMProvider.OPENAI:
            api_key = get_openai_api_key_env()
            if not api_key:
                raise HTTPException(status_code=400, detail="OpenAI API Key is not set")
            return OpenAIClientConfig(
                api_key=api_key,
                api_type=OpenAIApiType.COMPLETIONS,
            )
        case LLMProvider.GOOGLE:
            api_key = get_google_api_key_env()
            if not api_key:
                raise HTTPException(status_code=400, detail="Google API Key is not set")
            return GoogleClientConfig(api_key=api_key)
        case LLMProvider.VERTEX:
            api_key = get_vertex_api_key_env()
            project = get_vertex_project_env()
            location = get_vertex_location_env()
            base_url = get_vertex_base_url_env()

            if api_key and (project or location):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Vertex configuration is ambiguous. Configure either "
                        "VERTEX_API_KEY or VERTEX_PROJECT/VERTEX_LOCATION, not both."
                    ),
                )

            if api_key:
                return VertexAIClientConfig(
                    api_key=api_key,
                    base_url=base_url or None,
                )

            if not project:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Vertex configuration is incomplete. Set VERTEX_API_KEY "
                        "or VERTEX_PROJECT (optionally with VERTEX_LOCATION)."
                    ),
                )

            return VertexAIClientConfig(
                project=project,
                location=location or None,
                base_url=base_url or None,
            )
        case LLMProvider.AZURE:
            api_key = get_azure_openai_api_key_env()
            api_version = get_azure_openai_api_version_env()
            endpoint = get_azure_openai_endpoint_env()
            base_url = get_azure_openai_base_url_env()
            deployment = get_azure_openai_deployment_env()

            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="Azure OpenAI API Key is not set",
                )
            if not api_version:
                raise HTTPException(
                    status_code=400,
                    detail="Azure OpenAI API Version is not set",
                )
            if not endpoint and not base_url:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Azure OpenAI endpoint is not set. "
                        "Configure AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_BASE_URL."
                    ),
                )

            return AzureOpenAIClientConfig(
                api_key=api_key,
                api_version=api_version,
                endpoint=endpoint or None,
                base_url=base_url or None,
                deployment=deployment or None,
            )
        case LLMProvider.ANTHROPIC:
            api_key = get_anthropic_api_key_env()
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="Anthropic API Key is not set",
                )
            return AnthropicClientConfig(api_key=api_key)
        case LLMProvider.OLLAMA:
            return OpenAIClientConfig(
                base_url=(get_ollama_url_env() or "http://localhost:11434") + "/v1",
                api_key="ollama",
            )
        case LLMProvider.CUSTOM:
            base_url = get_custom_llm_url_env()
            if not base_url:
                raise HTTPException(
                    status_code=400,
                    detail="Custom LLM URL is not set",
                )
            return OpenAIClientConfig(
                base_url=base_url,
                api_key=get_custom_llm_api_key_env() or "null",
            )
        case _:
            raise HTTPException(
                status_code=400,
                detail=(
                    "LLM Provider must be either openai, google, vertex, azure, "
                    "anthropic, ollama, or custom"
                ),
            )


def get_extra_body() -> Optional[dict]:
    if get_llm_provider() == LLMProvider.CUSTOM and disable_thinking():
        return {"enable_thinking": False}
    return None
