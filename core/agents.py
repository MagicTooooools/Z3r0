"""Agent declarations and lazy SDK Agent construction. Edit `_AGENT_SPECS` to add or modify agents."""

import asyncio
from dataclasses import dataclass
from typing import Any

from agents import Agent, RunContextWrapper, Runner, Tool, function_tool
from agents.extensions.models.litellm_model import LitellmModel
from agents.stream_events import AgentUpdatedStreamEvent

from config import AgentConfig, WORKSPACE, get_config
from core.context import AgentRuntimeContext
from core.events import event_from_sdk_stream
from core.session import Z3r0Session
from core.tools import execute_command
from database import get_engine
from logger import get_logger
from schema.agent_event_schema import AgentEventSchema, ErrorEvent


logger = get_logger(__name__)

DEFAULT_AGENT_CODE = "cso"


@dataclass(frozen=True, slots=True)
class SubagentMount:
    code: str
    tool_name: str
    tool_description: str


@dataclass(frozen=True, slots=True)
class AgentSpec:
    code: str
    tools: tuple[Tool, ...] = ()
    subagents: tuple[SubagentMount, ...] = ()


_AGENT_SPECS: tuple[AgentSpec, ...] = (
    AgentSpec(
        code="cso",
        subagents=(
            SubagentMount(
                code="cse",
                tool_name="consult_cse",
                tool_description=(
                    "Delegate a concrete offensive-security task (recon, exploitation, "
                    "post-exploit) to Fr4nk. Provide a self-contained brief; Fr4nk does "
                    "not see your prior conversation. Returns Fr4nk's final report as a string."
                ),
            ),
        ),
    ),
    AgentSpec(
        code="cse",
        tools=(execute_command,),
    ),
)


class AgentRegistry:
    def __init__(self, specs: tuple[AgentSpec, ...] = _AGENT_SPECS) -> None:
        self._specs: dict[str, AgentSpec] = {spec.code: spec for spec in specs}
        self._agents: dict[str, Agent] = {}
        self._building: set[str] = set()
        self._codes_cache: tuple[str, ...] | None = None
        self._code_to_name_cache: dict[str, str] | None = None

    def codes(self) -> list[str]:
        if self._codes_cache is None:
            configured = set(get_config().agents.keys())
            self._codes_cache = tuple(code for code in self._specs if code in configured)
        return list(self._codes_cache)

    def code_to_name(self) -> dict[str, str]:
        if self._code_to_name_cache is None:
            cfg = get_config()
            self._code_to_name_cache = {code: cfg.agents[code].name for code in self.codes()}
        return self._code_to_name_cache

    def has(self, agent_code: str) -> bool:
        return agent_code in self.codes()

    def get(self, agent_code: str) -> Agent:
        cached = self._agents.get(agent_code)
        if cached is not None:
            return cached
        if agent_code in self._building:
            raise ValueError(f"circular subagent mount detected at {agent_code}")

        spec = self._specs.get(agent_code)
        if spec is None:
            raise ValueError(f"agent spec not declared for code: {agent_code}")
        cfg = get_config().agents.get(agent_code)
        if cfg is None:
            raise ValueError(f"agent config missing for code: {agent_code}")

        self._building.add(agent_code)
        try:
            agent = self._build(spec, cfg)
            self._agents[agent_code] = agent
            return agent
        finally:
            self._building.discard(agent_code)

    def _build(self, spec: AgentSpec, cfg: AgentConfig) -> Agent:
        agent_path = WORKSPACE / "agents" / spec.code
        soul = (agent_path / "SOUL.md").read_text(encoding="utf-8").strip()
        rules = (agent_path / "AGENTS.md").read_text(encoding="utf-8").strip()

        tools: list[Tool] = list(spec.tools)
        for mount in spec.subagents:
            if mount.code == spec.code:
                raise ValueError(f"agent {spec.code} cannot mount itself as a subagent")
            self.get(mount.code)  # eager build catches circular mounts at boot
            tools.append(_build_subagent_tool(spec.code, mount, registry=self))

        return Agent(
            name=cfg.name,
            model=LitellmModel(base_url=cfg.base_url, api_key=cfg.api_key, model=cfg.model),
            instructions=f"{soul}\n\n{rules}",
            tools=tools,
        )


def _build_subagent_tool(parent_code: str, mount: SubagentMount, *, registry: AgentRegistry) -> Tool:
    """Synchronous subagent delegation tool: streams nested events to the parent's emitter,
    persists via Z3r0Session(nested_for=parent) so the subagent can recall it later."""

    async def _delegate(ctx: RunContextWrapper[AgentRuntimeContext], brief: str) -> str:
        child_agent = registry.get(mount.code)
        nested_call_id = getattr(ctx, "tool_call_id", "") or ""
        nested_session = Z3r0Session(
            session_id=ctx.context.session_id,
            engine=get_engine(),
            viewing_agent_code=mount.code,
            agent_code_to_name=registry.code_to_name(),
            nested_for_agent_code=parent_code,
            nested_call_id=nested_call_id,
        )
        emitter = ctx.context.event_emitter

        def _emit(event: AgentEventSchema) -> None:
            if emitter is None:
                return
            emitter(_tag_nested(event, parent_code, nested_call_id))

        try:
            stream = Runner.run_streamed(
                starting_agent=child_agent,
                input=brief,
                session=nested_session,
                context=ctx.context,
            )
            async for sdk_event in stream.stream_events():
                if isinstance(sdk_event, AgentUpdatedStreamEvent):
                    continue
                event = event_from_sdk_stream(sdk_event, child_agent.name)
                if event is not None:
                    _emit(event)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("nested subagent %s failed", mount.code)
            _emit(ErrorEvent(agent_name=child_agent.name, message=f"Subagent failed: {exc}"))
            return f"Subagent {mount.code} failed: {exc}"
        return _final_text(stream)

    _delegate.__name__ = mount.tool_name
    _delegate.__doc__ = mount.tool_description
    return function_tool(
        _delegate,
        name_override=mount.tool_name,
        description_override=mount.tool_description,
    )


def _tag_nested(event: AgentEventSchema, parent_code: str, nested_call_id: str) -> AgentEventSchema:
    if not hasattr(event, "nested_for"):
        return event
    return event.model_copy(update={"nested_for": parent_code, "nested_call_id": nested_call_id})


def _final_text(result: Any) -> str:
    output = getattr(result, "final_output", None)
    if output is None:
        return ""
    return output if isinstance(output, str) else str(output)
