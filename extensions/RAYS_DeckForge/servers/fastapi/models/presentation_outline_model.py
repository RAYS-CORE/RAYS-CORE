from typing import List
from pydantic import BaseModel


class SlideOutlineModel(BaseModel):
    content: str


class PresentationOutlineModel(BaseModel):
    slides: List[SlideOutlineModel]

    def to_string(self):
        message = ""
        for i, slide in enumerate(self.slides):
            message += f"## Slide {i+1}:\n"
            message += f"  - Content: {slide} \n"
        return message
