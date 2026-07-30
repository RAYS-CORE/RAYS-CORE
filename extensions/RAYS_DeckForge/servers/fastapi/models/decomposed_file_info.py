from pydantic import BaseModel


class DecomposedFileInfo(BaseModel):
    name: str
    file_path: str
