"""Unified run-until-idle loop for main and sub-agent turn execution.

The executor manages the lifecycle: initial turn -> notification consumption
-> idle wait -> return.  Actual turn execution (SDK stream, event publishing,
partial-context saving) is delegated to the caller-supplied ``run_turn``
callback, keeping the executor decoupled from agent-specific concerns.
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
from logger import get_logger
from schema.agent.events import AgentInputPart
from schema.agent.notifications import AgentNotificationSnapshot
from service.agent import notifications as agent_notifications

logger = get_logger(__name__)

RunTurnFn = Callable[
    [list[AgentInputPart], AgentNotificationSnapshot | None],
    Awaitable[Any],
]
HasBackgroundWorkFn = Callable[[], Awaitable[bool]]

_IDLE_WAIT_TIMEOUT_SECONDS = 30


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
    1. If *initial_content* is provided, run the initial turn (may raise
       ``InterruptSignal`` on preemption).  Pass ``None`` to skip straight
       to the notification loop (used for recovery after restart).
    2. Enter notification consumption loop:
       a. Claim and process pending notifications (each turn is interruptible).
       b. When none remain, check *has_background_work*.
       c. If background work exists, wait for the next signal, then repeat.
       d. If none, return.

    Args:
        session_id: Current agent session id.
        agent_instance_id: Target agent instance id for notification routing.
        initial_content: Input parts for the first turn, or ``None`` to skip
            the initial turn and go directly to the notification loop.
        run_turn: Async callback ``(content, notification | None) -> result``.
            Must use ``iter_interruptible_events`` internally and propagate
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
            result = await run_turn(initial_content, None)
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

        content = text_input_content(notification_prompt(notification))
        try:
            result = await run_turn(content, notification)
            await agent_notifications.complete_notification(notification.id)
        except InterruptSignal:
            await agent_notifications.complete_notification(notification.id)
        except asyncio.CancelledError:
            await agent_notifications.release_notification(notification.id)
            raise
        except Exception as exc:
            await agent_notifications.fail_notification(
                notification.id,
                str(exc) or "notification handling failed",
            )
            raise
