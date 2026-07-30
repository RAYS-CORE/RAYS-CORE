import asyncio
import json
from typing import Any
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from models.presentation_outline_model import PresentationOutlineModel
from tests.mocks.llm import content_event
from utils.llm_calls import generate_presentation_outlines as outline_module


def _collect_async_chunks(generator) -> list[Any]:
    async def _collect():
        chunks = []
        async for chunk in generator:
            chunks.append(chunk)
        return chunks

    return asyncio.run(_collect())


def test_get_user_prompt_uses_autodetect_defaults():
    prompt = outline_module.get_user_prompt(
        content="Build quarterly strategy deck",
        n_slides=None,
        language="  ",
        additional_context=None,
        tone="professional",
        instructions=None,
    )

    assert "Number of Slides: auto-detect" in prompt
    assert "Language: auto-detect" in prompt
    assert "Tone: professional" in prompt
    assert "Context: None" in prompt


def test_generate_ppt_outline_streams_json_chunks_and_keeps_schema_shape():
    async def fake_stream_generate_events(_client, **_kwargs):
        yield content_event('{"slides": [')
        yield content_event('{"content": "## Intro\\nBullet"}')
        yield content_event("]}")

    with patch.object(outline_module, "get_model", return_value="fake-model"), patch.object(
        outline_module, "get_client", return_value=object()
    ), patch.object(outline_module, "get_llm_config", return_value={}), patch.object(
        outline_module,
        "get_generate_kwargs",
        side_effect=lambda **kwargs: kwargs,
    ), patch.object(
        outline_module, "stream_generate_events", side_effect=fake_stream_generate_events
    ):
        chunks = _collect_async_chunks(
            outline_module.generate_ppt_outline(
                content="topic",
                n_slides=1,
                language="English",
            )
        )

    parsed = json.loads("".join(chunks))
    validated = PresentationOutlineModel.model_validate(parsed)
    assert len(validated.slides) == 1
    assert validated.slides[0].content.startswith("## Intro")


def test_generate_ppt_outline_returns_http_exception_chunk_on_failure():
    async def failing_stream(_client, **_kwargs):
        raise TimeoutError("provider timed out")
        yield  # pragma: no cover

    with patch.object(outline_module, "get_model", return_value="fake-model"), patch.object(
        outline_module, "get_client", return_value=object()
    ), patch.object(
        outline_module,
        "get_llm_config",
        return_value={},
    ), patch.object(
        outline_module,
        "get_generate_kwargs",
        side_effect=lambda **kwargs: kwargs,
    ), patch.object(
        outline_module,
        "stream_generate_events",
        side_effect=failing_stream,
    ), patch.object(
        outline_module,
        "handle_llm_client_exceptions",
        return_value=HTTPException(status_code=408, detail="LLM timeout"),
    ):
        chunks = _collect_async_chunks(
            outline_module.generate_ppt_outline(
                content="topic",
                n_slides=1,
                language="English",
            )
        )

    assert len(chunks) == 1
    assert isinstance(chunks[0], HTTPException)
    assert chunks[0].status_code == 408


def test_presentation_outline_model_schema_validation_rejects_invalid_ai_payload():
    invalid_payload = {"slides": [{"not_content": "missing expected key"}]}

    with pytest.raises(ValidationError):
        PresentationOutlineModel.model_validate(invalid_payload)
