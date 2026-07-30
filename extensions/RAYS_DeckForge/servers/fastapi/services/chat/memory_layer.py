import copy
import json
import logging
import re
import uuid
from typing import Any

from jsonschema import Draft202012Validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.image_prompt import ImagePrompt
from models.sql.image_asset import ImageAsset
from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from services.icon_finder_service import ICON_FINDER_SERVICE
from services.image_generation_service import ImageGenerationService
from services.mem0_presentation_memory_service import MEM0_PRESENTATION_MEMORY_SERVICE
from templates.presentation_layout import SlideLayoutModel
from utils.asset_directory_utils import get_images_directory
from utils.process_slides import (
    process_old_and_new_slides_and_fetch_assets,
    process_slide_and_fetch_assets,
)

LOGGER = logging.getLogger(__name__)
MAX_SCHEMA_ERRORS = 10
# Keep URL runtime fields during validation because many slide schemas require them.
# Speaker note is handled separately and should not affect JSON-schema checks.
RUNTIME_CONTENT_FIELDS = {"__speaker_note__"}


class PresentationChatMemoryLayer:
    """
    Memory abstraction for chat tools and context retrieval.

    This layer intentionally hides where data comes from (SQL-backed persisted state
    and mem0 retrieval) behind `get` and `search`-style methods so chat logic stays
    decoupled from storage details.
    """

    def __init__(self, sql_session: AsyncSession, presentation_id: uuid.UUID):
        self._sql_session = sql_session
        self._presentation_id = presentation_id

    async def get(self, key: str) -> Any:
        if key != "presentation_outline":
            return None

        # Prefer live slides from SQL so slide count and slide indices are always current.
        slides_result = await self._sql_session.scalars(
            select(SlideModel)
            .where(SlideModel.presentation == self._presentation_id)
            .order_by(SlideModel.index)
        )
        slides = list(slides_result)
        if slides:
            LOGGER.info(
                "Chat outline loaded from slides table (presentation_id=%s, slides=%d)",
                self._presentation_id,
                len(slides),
            )
            return {
                "source": "slides_table",
                "slide_count": len(slides),
                "slides": [
                    {
                        "slide_id": str(slide.id),
                        "index": slide.index,
                        "layout_id": slide.layout,
                        "content": slide.content,
                        "speaker_note": slide.speaker_note,
                    }
                    for slide in slides
                ],
            }

        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation or not presentation.outlines:
            LOGGER.info(
                "Chat memory miss for outline (presentation_id=%s)",
                self._presentation_id,
            )
            return None

        LOGGER.info(
            "Chat outline fallback hit from presentation.outlines (presentation_id=%s)",
            self._presentation_id,
        )
        return presentation.outlines

    async def search(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        """
        Search slides directly from SQL-backed slide rows.

        Results are intentionally compact (snippet-first) to keep tool-call payloads
        small for models with limited context windows.
        """

        trimmed_query = (query or "").strip()
        if not trimmed_query:
            return []

        slides_result = await self._sql_session.scalars(
            select(SlideModel).where(SlideModel.presentation == self._presentation_id)
        )
        slides = sorted(list(slides_result), key=lambda slide: slide.index)
        if not slides:
            LOGGER.info(
                "Chat memory miss for slide search (presentation_id=%s, reason=no_slides)",
                self._presentation_id,
            )
            return []

        query_lower = trimmed_query.lower()
        query_tokens = set(re.findall(r"[a-z0-9]{2,}", query_lower))
        ranked: list[tuple[int, dict[str, Any]]] = []
        for slide in slides:
            serialized = self._serialize_slide(slide)
            searchable = serialized.lower()

            score = 0
            if query_lower in searchable:
                score += 8
            if query_tokens:
                score += sum(1 for token in query_tokens if token in searchable)
            if score <= 0:
                continue

            ranked.append(
                (
                    score,
                    {
                        "slide_id": str(slide.id),
                        "index": slide.index,
                        "slide_number": slide.index + 1,
                        "layout_id": slide.layout,
                        "snippet": self._build_snippet(serialized, query_lower),
                        "score": score,
                    },
                )
            )

        ranked.sort(key=lambda item: (-item[0], item[1]["index"]))
        results = [entry for _, entry in ranked[: max(1, limit)]]
        LOGGER.info(
            "Chat DB slide search completed (presentation_id=%s, query=%r, hits=%d)",
            self._presentation_id,
            trimmed_query,
            len(results),
        )
        return results

    async def get_slide_at_index(
        self, index: int, *, include_full_content: bool = False
    ) -> dict[str, Any] | None:
        slide = await self._sql_session.scalar(
            select(SlideModel).where(
                SlideModel.presentation == self._presentation_id,
                SlideModel.index == index,
            )
        )
        if not slide:
            LOGGER.info(
                "Chat memory miss for slide by index (presentation_id=%s, index=%d)",
                self._presentation_id,
                index,
            )
            return None

        response: dict[str, Any] = {
            "slide_id": str(slide.id),
            "index": slide.index,
            "slide_number": slide.index + 1,
            "layout_id": slide.layout,
            "content_preview": self._build_snippet(
                self._serialize_slide(slide),
                query_lower="",
                window=420,
            ),
            "speaker_note": slide.speaker_note,
        }
        if include_full_content:
            response["content"] = slide.content
        return response

    async def get_available_layouts(self) -> list[dict[str, Any]]:
        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation or not isinstance(presentation.layout, dict):
            return []

        try:
            layout_model = presentation.get_layout()
        except Exception:
            LOGGER.exception(
                "Failed to parse presentation layout (presentation_id=%s)",
                self._presentation_id,
            )
            return []

        return [
            {
                "id": layout.id,
                "name": layout.name,
                "description": layout.description,
            }
            for layout in layout_model.slides
        ]

    async def get_content_schema_from_layout_id(self, layout_id: str) -> dict[str, Any] | None:
        layout = await self._get_layout_by_id(layout_id)
        if not layout:
            return None
        return layout.json_schema

    async def generate_image(self, prompt: str) -> str:
        image_generation_service = ImageGenerationService(get_images_directory())
        image = await image_generation_service.generate_image(ImagePrompt(prompt=prompt))

        if isinstance(image, ImageAsset):
            self._sql_session.add(image)
            await self._sql_session.commit()
            return image.path

        return str(image)

    async def generate_icon(self, query: str) -> str:
        icons = await ICON_FINDER_SERVICE.search_icons(query, k=1)
        if icons:
            return icons[0]
        return "/static/icons/placeholder.svg"

    async def save_slide(
        self,
        *,
        content: dict[str, Any],
        layout_id: str,
        index: int,
        replace_old_slide_at_index: bool,
    ) -> dict[str, Any]:
        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation:
            return {
                "saved": False,
                "message": "Presentation not found.",
                "validation_errors": [],
            }

        layout = await self._get_layout_by_id(layout_id, presentation=presentation)
        if not layout:
            return {
                "saved": False,
                "message": f"Layout '{layout_id}' was not found in this presentation.",
                "validation_errors": [f"Unknown layout_id '{layout_id}'."],
            }

        validation_errors = self._validate_slide_content(
            content=content,
            schema=layout.json_schema,
        )
        if validation_errors:
            return {
                "saved": False,
                "message": "Slide content failed schema validation.",
                "validation_errors": validation_errors,
            }

        target_index = max(0, index)
        image_generation_service = ImageGenerationService(get_images_directory())

        if replace_old_slide_at_index:
            existing_slide = await self._sql_session.scalar(
                select(SlideModel).where(
                    SlideModel.presentation == self._presentation_id,
                    SlideModel.index == target_index,
                )
            )
            if not existing_slide:
                return {
                    "saved": False,
                    "message": f"No existing slide found at index {target_index} to replace.",
                    "validation_errors": [],
                }

            updated_content = copy.deepcopy(content)
            new_assets = await process_old_and_new_slides_and_fetch_assets(
                image_generation_service=image_generation_service,
                old_slide_content=existing_slide.content or {},
                new_slide_content=updated_content,
            )

            existing_slide.id = uuid.uuid4()
            existing_slide.layout = layout_id
            existing_slide.layout_group = self._resolve_layout_group(
                presentation=presentation,
                fallback=existing_slide.layout_group,
            )
            existing_slide.content = updated_content
            existing_slide.speaker_note = self._extract_speaker_note(updated_content)
            self._sql_session.add(existing_slide)
            self._sql_session.add_all(new_assets)
            await self._sql_session.commit()

            await MEM0_PRESENTATION_MEMORY_SERVICE.store_slide_edit(
                presentation_id=self._presentation_id,
                slide_index=target_index,
                edit_prompt=f"[chat_tool_save_slide_replace] layout_id={layout_id}",
                edited_slide_content=updated_content,
            )

            return {
                "saved": True,
                "action": "replaced",
                "message": f"Slide at index {target_index} was replaced successfully.",
                "slide_id": str(existing_slide.id),
                "index": target_index,
            }

        slides_result = await self._sql_session.scalars(
            select(SlideModel)
            .where(SlideModel.presentation == self._presentation_id)
            .order_by(SlideModel.index)
        )
        slides = list(slides_result)

        if slides:
            max_index = max(slide.index for slide in slides)
            insert_index = min(target_index, max_index + 1)
            slides_to_shift = [slide for slide in slides if slide.index >= insert_index]
        else:
            insert_index = 0
            slides_to_shift = []

        for slide in sorted(slides_to_shift, key=lambda each: each.index, reverse=True):
            slide.index += 1
            self._sql_session.add(slide)

        new_slide_content = copy.deepcopy(content)
        new_slide = SlideModel(
            presentation=self._presentation_id,
            layout_group=self._resolve_layout_group(presentation=presentation),
            layout=layout_id,
            index=insert_index,
            content=new_slide_content,
            speaker_note=self._extract_speaker_note(new_slide_content),
        )
        new_assets = await process_slide_and_fetch_assets(
            image_generation_service=image_generation_service,
            slide=new_slide,
        )

        self._sql_session.add(new_slide)
        self._sql_session.add_all(new_assets)
        await self._sql_session.commit()
        await self._sql_session.refresh(new_slide)

        await MEM0_PRESENTATION_MEMORY_SERVICE.store_slide_edit(
            presentation_id=self._presentation_id,
            slide_index=insert_index,
            edit_prompt=f"[chat_tool_save_slide_new] layout_id={layout_id}",
            edited_slide_content=new_slide.content,
        )

        return {
            "saved": True,
            "action": "created",
            "message": f"New slide saved at index {insert_index}.",
            "slide_id": str(new_slide.id),
            "index": insert_index,
            "shifted_slide_count": len(slides_to_shift),
        }

    async def delete_slide(self, *, index: int) -> dict[str, Any]:
        target_index = max(0, index)
        slide = await self._sql_session.scalar(
            select(SlideModel).where(
                SlideModel.presentation == self._presentation_id,
                SlideModel.index == target_index,
            )
        )
        if not slide:
            return {
                "deleted": False,
                "message": f"No slide found at index {target_index}.",
                "index": target_index,
            }

        await self._sql_session.delete(slide)

        slides_result = await self._sql_session.scalars(
            select(SlideModel).where(SlideModel.presentation == self._presentation_id)
        )
        slides = sorted(list(slides_result), key=lambda each: each.index)
        shifted_count = 0
        for each_slide in slides:
            if each_slide.index <= target_index:
                continue
            each_slide.index -= 1
            self._sql_session.add(each_slide)
            shifted_count += 1

        await self._sql_session.commit()

        return {
            "deleted": True,
            "message": f"Slide at index {target_index} was deleted successfully.",
            "deleted_slide_id": str(slide.id),
            "index": target_index,
            "shifted_slide_count": shifted_count,
        }

    async def retrieve_context(self, query: str) -> str:
        context = await MEM0_PRESENTATION_MEMORY_SERVICE.retrieve_context(
            self._presentation_id,
            query,
        )
        if context:
            LOGGER.info(
                "Chat memory semantic context hit (presentation_id=%s, chars=%d)",
                self._presentation_id,
                len(context),
            )
        else:
            LOGGER.info(
                "Chat memory semantic context miss (presentation_id=%s)",
                self._presentation_id,
            )
        return context

    async def _get_layout_by_id(
        self,
        layout_id: str,
        presentation: PresentationModel | None = None,
    ) -> SlideLayoutModel | None:
        if not presentation:
            presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation or not isinstance(presentation.layout, dict):
            return None

        try:
            layout_model = presentation.get_layout()
        except Exception:
            return None

        for layout in layout_model.slides:
            if layout.id == layout_id:
                return layout
        return None

    def _validate_slide_content(
        self,
        *,
        content: dict[str, Any],
        schema: dict[str, Any],
    ) -> list[str]:
        validation_content = self._strip_runtime_fields(content)
        validator = Draft202012Validator(schema)
        errors = sorted(validator.iter_errors(validation_content), key=lambda err: err.path)

        if not errors:
            return []

        formatted_errors: list[str] = []
        for err in errors[:MAX_SCHEMA_ERRORS]:
            location = ".".join([str(part) for part in err.path]) or "$"
            formatted_errors.append(f"{location}: {err.message}")
        return formatted_errors

    @staticmethod
    def _strip_runtime_fields(value: Any) -> Any:
        if isinstance(value, dict):
            sanitized: dict[str, Any] = {}
            for key, nested_value in value.items():
                if key in RUNTIME_CONTENT_FIELDS:
                    continue
                sanitized[key] = PresentationChatMemoryLayer._strip_runtime_fields(
                    nested_value
                )
            return sanitized

        if isinstance(value, list):
            return [
                PresentationChatMemoryLayer._strip_runtime_fields(item) for item in value
            ]

        return value

    @staticmethod
    def _extract_speaker_note(content: dict[str, Any]) -> str:
        value = content.get("__speaker_note__")
        if isinstance(value, str):
            return value
        return ""

    @staticmethod
    def _resolve_layout_group(
        *,
        presentation: PresentationModel,
        fallback: str = "presentation",
    ) -> str:
        if isinstance(presentation.layout, dict):
            name = str(presentation.layout.get("name") or "").strip()
            if name:
                return name
        return fallback

    @staticmethod
    def _serialize_slide(slide: SlideModel) -> str:
        content_text = ""
        try:
            content_text = json.dumps(slide.content or {}, ensure_ascii=False)
        except Exception:
            content_text = str(slide.content)

        speaker_note = slide.speaker_note or ""
        return f"slide_index={slide.index}\nlayout_id={slide.layout}\n{content_text}\n{speaker_note}"

    @staticmethod
    def _build_snippet(text: str, query_lower: str, window: int = 320) -> str:
        normalized = " ".join(text.split())
        if not normalized:
            return ""

        offset = normalized.lower().find(query_lower)
        if offset == -1:
            return normalized[:window]

        start = max(0, offset - window // 3)
        end = min(len(normalized), start + window)
        return normalized[start:end]
