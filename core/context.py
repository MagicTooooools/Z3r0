from collections.abc import Callable
from dataclasses import dataclass, field

from schema.agent_event_schema import AgentEventSchema
from schema.system_user_schema import SystemUserRole


@dataclass(frozen=True)
class AgentUserContext:
    id: int
    username: str
    email: str
    role: SystemUserRole


@dataclass
class AgentRuntimeContext:
    session_id: str
    user: AgentUserContext
    sandbox_container_id: int | None = None
    # in-process only: nested function tools push events back to the active turn here
    event_emitter: Callable[[AgentEventSchema], None] | None = field(
        default=None, repr=False, compare=False,
    )
