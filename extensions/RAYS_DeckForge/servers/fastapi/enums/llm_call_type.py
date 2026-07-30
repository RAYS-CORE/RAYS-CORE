from enum import Enum


class LLMCallType(Enum):
    UNSTRUCTURED = "unstructured"
    UNSTRUCTURED_STREAM = "unstructured_stream"
    STRUCTURED = "structured"
    STRUCTURED_STREAM = "structured_stream"
