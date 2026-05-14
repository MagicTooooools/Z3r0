"""In-memory projection of an active stream for reconnect replay."""

from collections.abc import Callable
from dataclasses import dataclass

from schema.agent.events import (
    AgentEventSchema,
    DoneEvent,
    ErrorEvent,
    RunStateEvent,
    SubagentTaskEvent,
    TextCompleteEvent,
    TextDeltaEvent,
    ThinkingCompleteEvent,
    ThinkingDeltaEvent,
    ToolCallEvent,
    ToolResultEvent,
    TurnBoundaryEvent,
    UserMessageEvent,
)


@dataclass(frozen=True, slots=True)
class _SegmentKey:
    event_type: str
    segment_id: str
    nested_for: str = ""
    nested_call_id: str = ""


class LiveEventProjection:
    def __init__(self) -> None:
        self._events: list[AgentEventSchema] = []
        self._segment_indexes: dict[_SegmentKey, int] = {}
        self._tool_indexes: dict[tuple[str, str, str, str], int] = {}
        self._subagent_indexes: dict[str, int] = {}

    def reset(self, event: RunStateEvent) -> None:
        self._events = [event]
        self._segment_indexes.clear()
        self._tool_indexes.clear()
        self._subagent_indexes.clear()

    def snapshot(self, include: Callable[[AgentEventSchema], bool] | None = None) -> list[AgentEventSchema]:
        if include is None:
            return list(self._events)
        return [event for event in self._events if include(event)]

    def apply(self, event: AgentEventSchema) -> None:
        if isinstance(event, (TextDeltaEvent, TextCompleteEvent, ThinkingDeltaEvent, ThinkingCompleteEvent)):
            self._apply_segment(event)
            return
        if isinstance(event, (ToolCallEvent, ToolResultEvent)):
            self._apply_tool(event)
            return
        if isinstance(event, SubagentTaskEvent):
            self._apply_subagent(event)
            return
        if isinstance(event, DoneEvent):
            self._events.append(event)
            return
        if isinstance(event, (UserMessageEvent, TurnBoundaryEvent, ErrorEvent, RunStateEvent)):
            self._events.append(event)

    def _apply_segment(
        self,
        event: TextDeltaEvent | TextCompleteEvent | ThinkingDeltaEvent | ThinkingCompleteEvent,
    ) -> None:
        key = _SegmentKey(
            event_type="thinking" if event.type in {"thinking_delta", "thinking_complete"} else "text",
            segment_id=event.segment_id,
            nested_for=event.nested_for,
            nested_call_id=event.nested_call_id,
        )
        index = self._segment_indexes.get(key)
        if index is None:
            self._segment_indexes[key] = len(self._events)
            self._events.append(_projected_segment_event(event, _segment_text(event)))
            return

        current = self._events[index]
        text = getattr(event, "text", None)
        if text is None:
            text = f"{_segment_text(current)}{event.delta}"
        self._events[index] = _projected_segment_event(event, text)

    def _apply_tool(self, event: ToolCallEvent | ToolResultEvent) -> None:
        key = (event.type, event.call_id, event.nested_for, event.nested_call_id)
        index = self._tool_indexes.get(key)
        if index is None:
            self._tool_indexes[key] = len(self._events)
            self._events.append(event)
            return
        self._events[index] = event

    def _apply_subagent(self, event: SubagentTaskEvent) -> None:
        index = self._subagent_indexes.get(event.run_id)
        if index is None:
            self._subagent_indexes[event.run_id] = len(self._events)
            self._events.append(event)
            return
        self._events[index] = event


def _segment_complete_event(
    event: TextDeltaEvent | TextCompleteEvent | ThinkingDeltaEvent | ThinkingCompleteEvent,
    text: str,
) -> TextCompleteEvent | ThinkingCompleteEvent:
    if event.type in {"thinking_delta", "thinking_complete"}:
        return ThinkingCompleteEvent(
            created_at=event.created_at,
            agent_name=event.agent_name,
            nested_for=event.nested_for,
            nested_call_id=event.nested_call_id,
            segment_id=event.segment_id,
            text=text,
        )
    return TextCompleteEvent(
        created_at=event.created_at,
        agent_name=event.agent_name,
        nested_for=event.nested_for,
        nested_call_id=event.nested_call_id,
        segment_id=event.segment_id,
        text=text,
    )


def _projected_segment_event(
    event: TextDeltaEvent | TextCompleteEvent | ThinkingDeltaEvent | ThinkingCompleteEvent,
    text: str,
) -> TextCompleteEvent | ThinkingCompleteEvent:
    return _segment_complete_event(event, text)


def _segment_text(event: AgentEventSchema) -> str:
    value = getattr(event, "text", None)
    if isinstance(value, str):
        return value
    value = getattr(event, "delta", None)
    return value if isinstance(value, str) else ""
