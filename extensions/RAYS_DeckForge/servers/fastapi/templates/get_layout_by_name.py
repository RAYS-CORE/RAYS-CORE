import logging
import os
import aiohttp
from urllib.parse import urlencode
from typing import Any

from fastapi import HTTPException

from services.export_task_service import EXPORT_TASK_SERVICE
from templates.presentation_layout import PresentationLayoutModel

LOGGER = logging.getLogger(__name__)

_MAX_LOG_DETAIL = 600


def _preview_detail(text: str, limit: int = _MAX_LOG_DETAIL) -> str:
    text = text.replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


async def get_layout_by_name(layout_name: str) -> PresentationLayoutModel:
    query = urlencode({"group": layout_name})
    next_public_url = (os.getenv("NEXT_PUBLIC_URL") or "http://localhost:3000").rstrip("/")
    url = f"{next_public_url}/schema?{query}"

    LOGGER.info(
        "[template_layout] resolving template=%r primary_schema_url=%s",
        layout_name,
        url,
    )

    schema_payload: dict[str, Any] | None = None
    runtime_error: str | None = None

    try:
        schema = await EXPORT_TASK_SERVICE.extract_schema(url)
        schema_payload = schema.model_dump()
        slide_ids = [s.get("id") for s in schema_payload.get("slides") or []][:12]
        LOGGER.info(
            "[template_layout] extract-schema succeeded template=%r "
            "payload_name=%r ordered=%s slide_count=%d slide_ids(sample)=%s",
            layout_name,
            schema_payload.get("name"),
            schema_payload.get("ordered"),
            len(schema_payload.get("slides") or []),
            slide_ids,
        )
    except HTTPException as exc:
        # Backward compatibility: older export runtimes do not implement
        # extract-schema and return "Invalid task type".
        runtime_error = str(exc.detail)
    except Exception as exc:  # noqa: BLE001
        runtime_error = str(exc)

    if schema_payload is None:
        fallback_error = None
        fallback_url = f"{next_public_url}/api/template?group={layout_name}"
        LOGGER.info(
            "[template_layout] trying HTTP fallback template=%r url=%s",
            layout_name,
            fallback_url,
        )
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(fallback_url) as response:
                    if response.status == 200:
                        schema_payload = await response.json()
                        if runtime_error:
                            LOGGER.info(
                                "[template_layout] primary extract-schema failed template=%r detail=%s",
                                layout_name,
                                _preview_detail(runtime_error),
                            )
                        LOGGER.info(
                            "[template_layout] fallback OK template=%r slide_count=%d",
                            layout_name,
                            len(schema_payload.get("slides") or []),
                        )
                    else:
                        fallback_error = await response.text()
                        LOGGER.warning(
                            "[template_layout] fallback HTTP %s template=%r body=%s",
                            response.status,
                            layout_name,
                            _preview_detail(fallback_error or ""),
                        )
        except aiohttp.ClientError as exc:
            fallback_error = str(exc)
            LOGGER.warning(
                "[template_layout] fallback request failed template=%r error=%s",
                layout_name,
                fallback_error,
            )
        except Exception as exc:  # noqa: BLE001
            fallback_error = str(exc)
            LOGGER.warning(
                "[template_layout] fallback unexpected error template=%r error=%s",
                layout_name,
                _preview_detail(fallback_error),
            )

        if schema_payload is None:
            error_detail = runtime_error or fallback_error or "unknown error"
            if runtime_error:
                LOGGER.warning(
                    "[template_layout] extract-schema HTTP error template=%r detail=%s",
                    layout_name,
                    _preview_detail(runtime_error),
                )
            LOGGER.error(
                "[template_layout] no schema payload template=%r combined_detail=%s",
                layout_name,
                _preview_detail(error_detail),
            )
            raise HTTPException(
                status_code=404,
                detail=f"Template '{layout_name}' not found: {error_detail}",
            )

    slides = schema_payload.get("slides") or []
    if not slides:
        LOGGER.error(
            "[template_layout] slides empty after resolve template=%r keys=%s",
            layout_name,
            list(schema_payload.keys()),
        )
        raise HTTPException(
            status_code=404,
            detail=f"Template '{layout_name}' not found",
        )

    LOGGER.info(
        "[template_layout] building PresentationLayoutModel template=%r slides=%d",
        layout_name,
        len(slides),
    )
    return PresentationLayoutModel(**schema_payload)
