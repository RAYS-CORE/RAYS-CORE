from datetime import datetime
import uuid
from sqlmodel import Field, Column, JSON, SQLModel, DateTime


class OllamaPullStatus(SQLModel, table=True):
    id: str = Field(primary_key=True)
    last_updated: datetime = Field(sa_column=Column(DateTime, default=datetime.now))
    status: dict = Field(sa_column=Column(JSON))
