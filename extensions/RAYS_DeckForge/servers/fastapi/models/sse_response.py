import json

from pydantic import BaseModel


class SSEResponse(BaseModel):
    event: str
    data: str

    def to_string(self):
        return f"event: {self.event}\ndata: {self.data}\n\n"


class SSEStatusResponse(BaseModel):
    status: str

    def to_string(self):
        return SSEResponse(
            event="response", data=json.dumps({"type": "status", "status": self.status})
        ).to_string()


class SSETraceResponse(BaseModel):
    trace: object

    def to_string(self):
        return SSEResponse(
            event="response", data=json.dumps({"type": "trace", "trace": self.trace})
        ).to_string()


class SSEErrorResponse(BaseModel):
    detail: str

    def to_string(self):
        return SSEResponse(
            event="response", data=json.dumps({"type": "error", "detail": self.detail})
        ).to_string()


class SSECompleteResponse(BaseModel):
    key: str
    value: object

    def to_string(self):
        return SSEResponse(
            event="response",
            data=json.dumps({"type": "complete", self.key: self.value}),
        ).to_string()
