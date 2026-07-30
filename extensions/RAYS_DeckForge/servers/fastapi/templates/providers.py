import asyncio
import base64
from dataclasses import dataclass
import time
from typing import Any, Awaitable, Callable, Optional

from fastapi import HTTPException
from google import genai
from google.genai import types as google_types
from llmai import AnthropicClient
from llmai.shared import (
    AnthropicClientConfig,
    ImageContentPart,
    SystemMessage,
    TextResponse,
    UserMessage,
)
from openai import AsyncOpenAI

from enums.llm_provider import LLMProvider
from utils.get_env import (
    get_anthropic_api_key_env,
    get_google_api_key_env,
    get_openai_api_key_env,
)
from utils.llm_provider import get_llm_provider, get_model

MAX_ATTEMPTS_PER_PROVIDER = 4


@dataclass(frozen=True)
class TemplateProviderSpec:
    provider: LLMProvider
    model: str


@dataclass(frozen=True)
class PlainLLMProvider:
    name: str
    call: Callable[[], Awaitable[str]]


def _exception_message(exc: Exception) -> str:
    if isinstance(exc, HTTPException):
        detail = exc.detail
        if isinstance(detail, str):
            message = detail
        else:
            message = str(detail)
    else:
        message = str(exc) or exc.__class__.__name__
    return " ".join(message.split())[:500]


def get_template_provider_spec() -> TemplateProviderSpec:
    provider = get_llm_provider()
    if provider == LLMProvider.OPENAI:
        return TemplateProviderSpec(provider=provider, model=get_model())

    if provider == LLMProvider.GOOGLE:
        return TemplateProviderSpec(provider=provider, model=get_model())
    if provider == LLMProvider.ANTHROPIC:
        return TemplateProviderSpec(provider=provider, model=get_model())

    raise HTTPException(
        status_code=400,
        detail="Template generation only supports OpenAI, Google, or Anthropic.",
    )


async def run_plain_provider_buckets(*, providers: list[PlainLLMProvider]) -> str:
    last_exception: Optional[Exception] = None
    last_provider_name: Optional[str] = None

    for provider in providers:
        for attempt in range(1, MAX_ATTEMPTS_PER_PROVIDER + 1):
            try:
                response_text = await provider.call()
                if response_text:
                    return response_text
                raise ValueError("No output from template generation provider")
            except HTTPException as exc:
                # Configuration/auth errors should fail fast instead of retrying.
                if 400 <= exc.status_code < 500:
                    raise exc
                last_exception = exc
                last_provider_name = provider.name
            except Exception as exc:
                last_exception = exc
                last_provider_name = provider.name

    if isinstance(last_exception, HTTPException):
        raise last_exception
    if last_exception:
        provider_name = last_provider_name or "Template provider"
        raise HTTPException(
            status_code=502,
            detail=f"{provider_name} error: {_exception_message(last_exception)}",
        )
    raise HTTPException(status_code=500, detail="Failed to generate template output")


def _read_openai_response_text(response) -> str:
    output_text = getattr(response, "output_text", None)
    if output_text:
        return output_text
    text = getattr(response, "text", None)
    if text:
        return text
    return ""


def _get_openai_client() -> AsyncOpenAI:
    api_key = get_openai_api_key_env()
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY is not set")
    return AsyncOpenAI(api_key=api_key, timeout=120.0)



def _get_google_client() -> genai.Client:
    api_key = get_google_api_key_env()
    if not api_key:
        raise HTTPException(status_code=400, detail="GOOGLE_API_KEY is not set")
    return genai.Client(api_key=api_key)


def _get_anthropic_client() -> AnthropicClient:
    api_key = get_anthropic_api_key_env()
    if not api_key:
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY is not set")
    return AnthropicClient(config=AnthropicClientConfig(api_key=api_key))


def _read_llmai_response_text(response: Any) -> str:
    content = getattr(response, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
                continue
            text = getattr(part, "text", None)
            if isinstance(text, str):
                parts.append(text)
        return "".join(parts)
    return getattr(content, "text", None) or ""


async def _call_openai_like(
    *,
    client: AsyncOpenAI,
    model: str,
    system_prompt: str,
    user_text: str,
    image_bytes: Optional[bytes] = None,
    media_type: str = "image/png",
) -> str:
    content = [{"type": "input_text", "text": user_text}]
    if image_bytes:
        content.insert(
            0,
            {
                "type": "input_image",
                "image_url": f"data:{media_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}",
            },
        )

    response = await client.responses.create(
        model=model,
        instructions=system_prompt,
        input=[{"role": "user", "content": content}],
        text={"verbosity": "medium"},
        store=False,
    )
    output_text = _read_openai_response_text(response)
    if not output_text:
        raise HTTPException(status_code=500, detail="No output from template provider")
    return output_text


def _response_event_to_dict(event: Any) -> dict:
    if isinstance(event, dict):
        return event
    if hasattr(event, "model_dump"):
        return event.model_dump()
    return {
        "type": getattr(event, "type", None),
        "delta": getattr(event, "delta", None),
        "text": getattr(event, "text", None),
        "item": getattr(event, "item", None),
        "response": getattr(event, "response", None),
        "error": getattr(event, "error", None),
        "message": getattr(event, "message", None),
    }



async def _call_google(
    *,
    model: str,
    system_prompt: str,
    user_text: str,
    image_bytes: Optional[bytes] = None,
    media_type: str = "image/png",
) -> str:
    client = _get_google_client()
    parts = [google_types.Part.from_text(text=user_text)]
    if image_bytes:
        parts.append(google_types.Part.from_bytes(data=image_bytes, mime_type=media_type))

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=model,
        contents=[google_types.Content(role="user", parts=parts)],
        config=google_types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="text/plain",
        ),
    )
    output_text = getattr(response, "text", None) or ""
    if not output_text:
        raise HTTPException(status_code=500, detail="No output from template provider")
    return output_text


async def _call_anthropic(
    *,
    model: str,
    system_prompt: str,
    user_text: str,
    image_bytes: Optional[bytes] = None,
    media_type: str = "image/png",
) -> str:
    client = _get_anthropic_client()
    content: str | list[object] = user_text
    if image_bytes:
        content = [
            user_text,
            ImageContentPart(data=image_bytes, mime_type=media_type),
        ]

    response = await asyncio.to_thread(
        client.generate,
        model=model,
        messages=[
            SystemMessage(content=system_prompt),
            UserMessage(content=content),
        ],
        response_format=TextResponse(),
        max_tokens=8192,
    )
    output_text = _read_llmai_response_text(response)
    if not output_text:
        raise HTTPException(status_code=500, detail="No output from template provider")
    return output_text


def _build_provider_call(
    *,
    spec: Optional[TemplateProviderSpec] = None,
    system_prompt: str,
    user_text: str,
    image_bytes: Optional[bytes] = None,
    media_type: str = "image/png",
) -> PlainLLMProvider:
    spec = spec or get_template_provider_spec()

    if spec.provider == LLMProvider.OPENAI:
        return PlainLLMProvider(
            name="OpenAI",
            call=lambda: _call_openai_like(
                client=_get_openai_client(),
                model=spec.model,
                system_prompt=system_prompt,
                user_text=user_text,
                image_bytes=image_bytes,
                media_type=media_type,
            ),
        )

    if spec.provider == LLMProvider.GOOGLE:
        return PlainLLMProvider(
            name="Google",
            call=lambda: _call_google(
                model=spec.model,
                system_prompt=system_prompt,
                user_text=user_text,
                image_bytes=image_bytes,
                media_type=media_type,
            ),
        )
    if spec.provider == LLMProvider.ANTHROPIC:
        return PlainLLMProvider(
            name="Anthropic",
            call=lambda: _call_anthropic(
                model=spec.model,
                system_prompt=system_prompt,
                user_text=user_text,
                image_bytes=image_bytes,
                media_type=media_type,
            ),
        )

    raise HTTPException(
        status_code=400,
        detail="Template generation only supports OpenAI, Google, or Anthropic.",
    )


async def generate_slide_layout_code(
    *,
    system_prompt: str,
    user_text: str,
    image_bytes: bytes,
    media_type: str = "image/png",
) -> str:
    provider = _build_provider_call(
        system_prompt=system_prompt,
        user_text=user_text,
        image_bytes=image_bytes,
        media_type=media_type,
    )
    return await run_plain_provider_buckets(providers=[provider])


async def edit_slide_layout_code(
    *,
    system_prompt: str,
    user_text: str,
) -> str:
    provider = _build_provider_call(
        system_prompt=system_prompt,
        user_text=user_text,
    )
    return await run_plain_provider_buckets(providers=[provider])
