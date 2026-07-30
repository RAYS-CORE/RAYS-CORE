from enum import Enum


class LLMProvider(Enum):
    OLLAMA = "ollama"
    OPENAI = "openai"
    GOOGLE = "google"
    VERTEX = "vertex"
    AZURE = "azure"
    ANTHROPIC = "anthropic"
    CUSTOM = "custom"
