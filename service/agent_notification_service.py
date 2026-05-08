from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from database import get_async_session
from logger import get_logger
from model.agent_notification_model import AgentNotification
from schema.agent_notification_schema import (
    AgentNotificationKind,
    AgentNotificationSnapshot,
    AgentNotificationStatus,
)
from schema.agent_subordinate_schema import AgentSubordinateTaskSnapshot


logger = get_logger(__name__)


async def enqueue_subagent_finished_notification(
    snapshot: AgentSubordinateTaskSnapshot,
    *,
    sandbox_container_id: int | None = None,
    sandbox_container_generation: int = 0,
    sandbox_skill_metadata: tuple[str, ...] = (),
) -> AgentNotificationSnapshot | None:
    """Create one durable inbox item for the parent agent of a terminal subagent run."""

    payload = {
        "run_id": snapshot.run_id,
        "parent_agent_code": snapshot.parent_agent_code,
        "agent_code": snapshot.agent_code,
        "agent_name": snapshot.agent_name,
        "status": snapshot.status.value,
        "brief": snapshot.brief,
        "result": snapshot.result,
        "error": snapshot.error,
        "started_at": _iso(snapshot.started_at),
        "finished_at": _iso(snapshot.finished_at),
        "sandbox_container_id": sandbox_container_id,
        "sandbox_container_generation": sandbox_container_generation,
        "sandbox_skill_metadata": list(sandbox_skill_metadata),
    }
    notification = AgentNotification(
        id=str(uuid4()),
        session_id=snapshot.session_id,
        target_agent_code=snapshot.parent_agent_code,
        kind=AgentNotificationKind.SUBAGENT_FINISHED.value,
        status=AgentNotificationStatus.PENDING.value,
        run_id=snapshot.run_id,
        payload=payload,
    )
    async with get_async_session() as session:
        try:
            session.add(notification)
            await session.commit()
            await session.refresh(notification)
        except IntegrityError:
            await session.rollback()
            existing = (await session.exec(
                select(AgentNotification).where(
                    AgentNotification.kind == AgentNotificationKind.SUBAGENT_FINISHED.value,
                    AgentNotification.run_id == snapshot.run_id,
                )
            )).first()
            return snapshot_from_notification(existing) if existing is not None else None

    logger.info(
        "agent notification queued: %s session=%s run=%s target=%s",
        notification.id,
        notification.session_id,
        notification.run_id,
        notification.target_agent_code,
    )
    return snapshot_from_notification(notification)


async def claim_next_pending_notification(
    *,
    session_id: str,
    target_agent_code: str | None = None,
) -> AgentNotificationSnapshot | None:
    now = datetime.now()
    async with get_async_session() as session:
        statement = select(AgentNotification).where(
            AgentNotification.session_id == session_id,
            AgentNotification.status == AgentNotificationStatus.PENDING.value,
        )
        if target_agent_code is not None:
            statement = statement.where(AgentNotification.target_agent_code == target_agent_code)
        notification = (await session.exec(
            statement
            .order_by(AgentNotification.created_at.asc())
            .limit(1)
            .with_for_update(skip_locked=True)
        )).first()
        if notification is None:
            return None
        notification.status = AgentNotificationStatus.PROCESSING.value
        notification.started_at = now
        notification.updated_at = now
        session.add(notification)
        await session.commit()
        await session.refresh(notification)
        return snapshot_from_notification(notification)


async def has_pending_notification(
    *,
    session_id: str,
    target_agent_code: str | None = None,
) -> bool:
    async with get_async_session() as session:
        statement = select(AgentNotification.id).where(
            AgentNotification.session_id == session_id,
            AgentNotification.status == AgentNotificationStatus.PENDING.value,
        )
        if target_agent_code is not None:
            statement = statement.where(AgentNotification.target_agent_code == target_agent_code)
        notification_id = (await session.exec(
            statement
            .limit(1)
        )).first()
        return notification_id is not None


async def complete_notification(notification_id: str) -> AgentNotificationSnapshot | None:
    return await _finish_notification(notification_id, AgentNotificationStatus.COMPLETED)


async def fail_notification(notification_id: str, error: str) -> AgentNotificationSnapshot | None:
    return await _finish_notification(notification_id, AgentNotificationStatus.FAILED, error=error)


async def release_notification(notification_id: str) -> AgentNotificationSnapshot | None:
    now = datetime.now()
    async with get_async_session() as session:
        notification = await session.get(AgentNotification, notification_id)
        if notification is None:
            return None
        if notification.status != AgentNotificationStatus.PROCESSING.value:
            return snapshot_from_notification(notification)
        notification.status = AgentNotificationStatus.PENDING.value
        notification.error = ""
        notification.started_at = None
        notification.updated_at = now
        session.add(notification)
        await session.commit()
        await session.refresh(notification)
        return snapshot_from_notification(notification)


async def cancel_session_notifications(session_id: str, error: str = "") -> list[AgentNotificationSnapshot]:
    now = datetime.now()
    async with get_async_session() as session:
        rows = (await session.exec(
            select(AgentNotification).where(
                AgentNotification.session_id == session_id,
                AgentNotification.status.in_([
                    AgentNotificationStatus.PENDING.value,
                    AgentNotificationStatus.PROCESSING.value,
                ]),
            )
        )).all()
        for notification in rows:
            notification.status = AgentNotificationStatus.CANCELED.value
            notification.error = error
            notification.updated_at = now
            notification.finished_at = now
            session.add(notification)
        if not rows:
            return []
        await session.commit()
        for notification in rows:
            await session.refresh(notification)
        return [snapshot_from_notification(notification) for notification in rows]


async def reset_processing_notifications_all() -> int:
    now = datetime.now()
    async with get_async_session() as session:
        rows = (await session.exec(
            select(AgentNotification).where(
                AgentNotification.status == AgentNotificationStatus.PROCESSING.value,
            )
        )).all()
        for notification in rows:
            notification.status = AgentNotificationStatus.PENDING.value
            notification.error = ""
            notification.started_at = None
            notification.updated_at = now
            session.add(notification)
        if rows:
            await session.commit()
            logger.info("processing agent notifications reset: %d", len(rows))
        return len(rows)


async def _finish_notification(
    notification_id: str,
    status: AgentNotificationStatus,
    *,
    error: str = "",
) -> AgentNotificationSnapshot | None:
    now = datetime.now()
    async with get_async_session() as session:
        notification = await session.get(AgentNotification, notification_id)
        if notification is None:
            return None
        notification.status = status.value
        notification.error = error
        notification.updated_at = now
        notification.finished_at = now
        session.add(notification)
        await session.commit()
        await session.refresh(notification)
        return snapshot_from_notification(notification)


def snapshot_from_notification(notification: AgentNotification) -> AgentNotificationSnapshot:
    payload = _coerce_payload(notification.payload)
    return AgentNotificationSnapshot(
        id=notification.id,
        session_id=notification.session_id,
        target_agent_code=notification.target_agent_code,
        kind=_coerce_kind(notification.kind),
        status=_coerce_status(notification.status),
        run_id=notification.run_id,
        payload=payload,
        error=notification.error,
        sandbox_container_id=_coerce_container_id(payload.get("sandbox_container_id")),
        sandbox_container_generation=_coerce_int(payload.get("sandbox_container_generation")),
        sandbox_skill_metadata=_coerce_string_tuple(payload.get("sandbox_skill_metadata")),
        created_at=notification.created_at,
        updated_at=notification.updated_at,
        started_at=notification.started_at,
        finished_at=notification.finished_at,
    )


def _coerce_kind(value: AgentNotificationKind | str) -> AgentNotificationKind:
    if isinstance(value, AgentNotificationKind):
        return value
    return AgentNotificationKind(str(value).lower())


def _coerce_status(value: AgentNotificationStatus | str) -> AgentNotificationStatus:
    if isinstance(value, AgentNotificationStatus):
        return value
    return AgentNotificationStatus(str(value).lower())


def _coerce_payload(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _coerce_container_id(value: Any) -> int | None:
    if value is None:
        return None
    try:
        integer = int(value)
    except (TypeError, ValueError):
        return None
    return integer if integer > 0 else None


def _coerce_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _coerce_string_tuple(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list | tuple):
        return ()
    return tuple(item for item in value if isinstance(item, str))


def _iso(value: datetime | None) -> str:
    return value.isoformat() if value is not None else ""
