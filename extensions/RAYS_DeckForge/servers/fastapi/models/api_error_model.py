from fastapi import HTTPException
from pydantic import BaseModel


class APIErrorModel(BaseModel):
    status_code: int
    detail: str

    @classmethod
    def from_exception(cls, e: Exception) -> "APIErrorModel":
        if isinstance(e, HTTPException):
            return APIErrorModel(status_code=e.status_code, detail=e.detail)
        return APIErrorModel(status_code=500, detail=str(e))
