"""Unified run-until-idle loop for main and sub-agent turn execution.

The executor manages the lifecycle: initial turn -> notification consumption
-> idle wait -> return.  Actual turn execution (SDK stream, event publishing,
partial-context saving) is delegated to the caller-supplied ``run_turn``
callback, keeping the executor decoupled from agent-specific concerns.

Each turn is described by a :class:`TurnTrigger` — an immutable value that
carries the input content, the originating notification (if any), and
UI-emission flags.  The callback receives a ``TurnTrigger`` and may use
``replace()`` to augment it with session-layer behaviour before executing.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from core.delegation.notifications import notification_prompt
from core.runtime.input_items import text_input_content
from core.runtime.notification_dispatch import (
    target_notification_version,
    wait_for_target_notifications,
)
from core.task_runtime.interrupt import InterruptSignal
from core.task_runtime.trigger import TurnTrigger
from logger import get_logger
from schema.agent.events import AgentImageInputPart, AgentInputPart, AgentTextInputPart
from schema.agent.notifications import AgentNotificationSnapshot
from service.agent import notifications as agent_notifications

logger = get_logger(__name__)

RunTurnFn = Callable[[TurnTrigger], Awaitable[Any]]
HasBackgroundWorkFn = Callable[[], Awaitable[bool]]

_IDLE_WAIT_TIMEOUT_SECONDS = 30


def _content_for_notification(notification: AgentNotificationSnapshot) -> list[AgentInputPart]:
    """Build the input content for a notification-triggered turn.

    For user messages the original content parts are reconstituted from the
    snapshot's dedicated fields; for system notifications the resumption
    prompt is wrapped as a text input.
    """
    if notification.is_user_message:
        parts: list[AgentInputPart] = []
        for raw in notification.user_content or []:
            part_type = raw.get("type", "")
            if part_type == "text":
                text = (raw.get("text") or "").strip()
                if text:
                    parts.append(AgentTextInputPart(text=text))
            elif part_type == "image":
                media_type = raw.get("media_type")
                data = raw.get("data")
                if media_type and data:
                    parts.append(AgentImageInputPart(
                        media_type=media_type,
                        data=data,
                        detail=raw.get("detail", "auto"),
                    ))
        return parts or text_input_content(notification.user_display_text or "…")

    return text_input_content(notification_prompt(notification))


def _trigger_for_notification(notification: AgentNotificationSnapshot) -> TurnTrigger:
    """Build a ``TurnTrigger`` from a claimed notification."""
    return TurnTrigger(
        content=_content_for_notification(notification),
        notification=notification,
    )


async def run_until_idle(
    *,
    session_id: str,
    agent_instance_id: str,
    initial_content: list[AgentInputPart] | None = None,
    run_turn: RunTurnFn,
    has_background_work: HasBackgroundWorkFn,
) -> Any:
    """Execute agent turns until no notifications remain and no background work is active.

    Flow:
    1. If *initial_content* is provided, build an initial ``TurnTrigger``
       and run the first turn (may raise ``InterruptSignal``).
       Pass ``None`` to skip straight to the notification loop (recovery).
    2. Enter notification consumption loop:
       a. Claim and process pending notifications (each turn is interruptible).
          ``USER_MESSAGE`` notifications have higher priority and are served
          before system-generated ones.
       b. When none remain, check *has_background_work*.
       c. If background work exists, wait for the next signal, then repeat.
       d. If none, return.

    Args:
        session_id: Current agent session id.
        agent_instance_id: Target agent instance id for notification routing.
        initial_content: Input parts for the first turn, or ``None`` to skip
            the initial turn and go directly to the notification loop.
        run_turn: Async callback ``(TurnTrigger) -> result``.  The callback
            may use ``replace()`` to augment the trigger with session-layer
            flags before executing the turn.  Must propagate
            ``InterruptSignal`` without catching it.
        has_background_work: Async predicate returning ``True`` when async
            commands, subagent tasks, or other background work are still active.

    Returns:
        The result of the last successfully completed turn (typically the SDK
        stream object), or ``None`` if every turn was interrupted.
    """
    result: Any = None

    if initial_content is not None:
        try:
            result = await run_turn(TurnTrigger(content=initial_content))
        except InterruptSignal:
            pass

    while True:
        notification = await agent_notifications.claim_next_pending_notification(
            session_id=session_id,
            target_agent_instance_id=agent_instance_id,
        )

        if notification is None:
            version = await target_notification_version(agent_instance_id)
            if await agent_notifications.has_pending_notification(
                session_id=session_id,
                target_agent_instance_id=agent_instance_id,
            ):
                continue
            if not await has_background_work():
                return result
            await wait_for_target_notifications(
                agent_instance_id,
                after_version=version,
                timeout_seconds=_IDLE_WAIT_TIMEOUT_SECONDS,
            )
            continue

        trigger = _trigger_for_notification(notification)
        try:
            result = await run_turn(trigger)
            await agent_notifications.complete_notification(trigger.notification_id)
        except InterruptSignal:
            await agent_notifications.complete_notification(trigger.notification_id)
        except asyncio.CancelledError:
            await agent_notifications.release_notification(trigger.notification_id)
            raise
        except Exception as exc:
            await agent_notifications.fail_notification(
                trigger.notification_id,
                str(exc) or "notification handling failed",
            )
            raise
