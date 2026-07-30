from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Text
from sqlmodel import Field, SQLModel

from utils.datetime_utils import get_current_utc_datetime


class ChatHistoryMessageModel(SQLModel, table=True):
    __tablename__ = "chat_history_messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    presentation_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("presentations.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    conversation_id: uuid.UUID = Field(index=True)
    position: int = Field(index=True, ge=1)
    role: str
    content: str = Field(sa_column=Column(Text, nullable=False))
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=get_current_utc_datetime
        )
    )
    tool_calls: Optional[list[str]] = Field(sa_column=Column(JSON), default=None)
