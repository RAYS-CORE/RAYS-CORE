from enum import Enum


class WebhookEvent(str, Enum):
    PRESENTATION_GENERATION_COMPLETED = "presentation.generation.completed"
    PRESENTATION_GENERATION_FAILED = "presentation.generation.failed"
