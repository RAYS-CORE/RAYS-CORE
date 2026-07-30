from typing import List
from pydantic import BaseModel, Field


class PresentationStructureModel(BaseModel):
    slides: List[int] = Field(description="List of slide layout indexes")
