from datetime import datetime

from sqlmodel import Field, SQLModel

from schema.agent_session_schema import SessionType


class AgentSessionMeta(SQLModel, table=True):
    """app-level fields the SDK tables do not carry (classification, title).

    sort order and message count come from the SDK tables, not from here."""

    __tablename__ = "agent_session_meta"

    session_id: str = Field(primary_key=True)
    session_type: SessionType = Field(default=SessionType.CHAT, index=True)
    title: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
