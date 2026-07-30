from typing import List, Literal
from pydantic import BaseModel
import uuid


class SlideContentUpdate(BaseModel):
    index: int
    content: dict


class EditPresentationRequest(BaseModel):
    presentation_id: uuid.UUID
    slides: List[SlideContentUpdate]
    export_as: Literal["pptx", "pdf"] = "pptx"
