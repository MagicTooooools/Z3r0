from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from schema.agent_notification_schema import AgentNotificationKind, AgentNotificationStatus


_AGENT_NOTIFICATION_KIND_COLUMN = Column(String(64), index=True, nullable=False)
_AGENT_NOTIFICATION_STATUS_COLUMN = Column(String(32), index=True, nullable=False)


class AgentNotification(SQLModel, table=True):
    """Durable inbox item used to wake a parent agent after background work finishes."""

    __tablename__ = "agent_notifications"
    __table_args__ = (
        UniqueConstraint("kind", "run_id", name="uq_agent_notifications_kind_run_id"),
    )

    id: str = Field(primary_key=True)
    session_id: str = Field(
        foreign_key="agent_sessions.session_id",
        ondelete="CASCADE",
        index=True,
    )
    target_agent_code: str = Field(default="", index=True)
    kind: AgentNotificationKind = Field(
        default=AgentNotificationKind.SUBAGENT_FINISHED,
        sa_column=_AGENT_NOTIFICATION_KIND_COLUMN,
    )
    status: AgentNotificationStatus = Field(
        default=AgentNotificationStatus.PENDING,
        sa_column=_AGENT_NOTIFICATION_STATUS_COLUMN,
    )
    run_id: str = Field(default="", index=True)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    error: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    started_at: datetime | None = None
    finished_at: datetime | None = None
