import re
from pathlib import Path

from agents import RunContextWrapper, function_tool

from config import WORKSPACE
from core.context import AgentRuntimeContext
from schema.tool_result_schema import ToolResultSchema, ToolResultStatusSchema, ToolResultTypeSchema
from utils.markdown import markdown_body_without_front_matter


_KNOWLEDGE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")
KNOWLEDGES_DIR_NAME = "knowledges"
KNOWLEDGE_EXTENSION = ".md"


@function_tool
async def load_knowledge(ctx: RunContextWrapper[AgentRuntimeContext], name: str) -> str:
    """Load the body of a named knowledge file for the current agent.

    Args:
        name: Knowledge file name without .md under the current agent's knowledges directory.

    Returns:
        The knowledge detail markdown body without YAML Front Matter.
    """
    agent_code = ctx.context.agent_code.strip()
    if not _KNOWLEDGE_NAME_PATTERN.fullmatch(agent_code):
        return ToolResultSchema(
            status=ToolResultStatusSchema.ERROR,
            type=ToolResultTypeSchema.KNOWLEDGE_DETAIL,
            output="No valid agent code is available in runtime context.",
        ).model_dump_json()

    knowledge_name = name.strip()
    if not _KNOWLEDGE_NAME_PATTERN.fullmatch(knowledge_name):
        return ToolResultSchema(
            status=ToolResultStatusSchema.ERROR,
            type=ToolResultTypeSchema.KNOWLEDGE_DETAIL,
            output="Knowledge name must contain only letters, numbers, dot, underscore, or dash.",
        ).model_dump_json()

    knowledge_path = _knowledge_entrypoint_path(agent_code, knowledge_name)
    if not _is_safe_knowledge_path(agent_code, knowledge_path):
        return ToolResultSchema(
            status=ToolResultStatusSchema.ERROR,
            type=ToolResultTypeSchema.KNOWLEDGE_DETAIL,
            output="Knowledge path is outside the current agent knowledges directory.",
        ).model_dump_json()
    if not knowledge_path.is_file():
        return ToolResultSchema(
            status=ToolResultStatusSchema.ERROR,
            type=ToolResultTypeSchema.KNOWLEDGE_DETAIL,
            output=f"Knowledge not found for agent {agent_code}: {knowledge_name}",
            exit_code=1,
        ).model_dump_json()

    try:
        output = knowledge_path.read_text(encoding="utf-8")
    except Exception as exc:
        return ToolResultSchema(
            status=ToolResultStatusSchema.ERROR,
            type=ToolResultTypeSchema.KNOWLEDGE_DETAIL,
            output=str(exc) or "Knowledge loading failed.",
        ).model_dump_json()

    return ToolResultSchema(
        status=ToolResultStatusSchema.SUCCESS,
        type=ToolResultTypeSchema.KNOWLEDGE_DETAIL,
        output=markdown_body_without_front_matter(output),
        exit_code=0,
    ).model_dump_json()


def load_knowledge_metadata(agent_code: str) -> tuple[str, ...]:
    if not _KNOWLEDGE_NAME_PATTERN.fullmatch(agent_code):
        return ()

    knowledges_dir = _agent_knowledges_dir(agent_code)
    if not knowledges_dir.is_dir():
        return ()

    blocks: list[str] = []
    knowledge_files = sorted(knowledges_dir.glob(f"*{KNOWLEDGE_EXTENSION}"), key=lambda path: path.stem)
    for knowledge_file in knowledge_files:
        knowledge_name = knowledge_file.stem
        if not _KNOWLEDGE_NAME_PATTERN.fullmatch(knowledge_name):
            continue
        if not _is_safe_knowledge_path(agent_code, knowledge_file):
            continue
        try:
            front_matter = _front_matter_from_text(knowledge_file.read_text(encoding="utf-8"))
        except OSError:
            continue
        if front_matter is None:
            continue
        blocks.append(f"## {knowledge_name}\n\n```yaml\n{front_matter}\n```")
    return tuple(blocks)


def _knowledge_entrypoint_path(agent_code: str, knowledge_name: str) -> Path:
    return _agent_knowledges_dir(agent_code) / f"{knowledge_name}{KNOWLEDGE_EXTENSION}"


def _agent_knowledges_dir(agent_code: str) -> Path:
    return WORKSPACE / "agents" / agent_code / KNOWLEDGES_DIR_NAME


def _is_safe_knowledge_path(agent_code: str, path: Path) -> bool:
    try:
        return path.resolve().is_relative_to(_agent_knowledges_dir(agent_code).resolve())
    except OSError:
        return False


def _front_matter_from_text(text: str) -> str | None:
    lines = text.splitlines()
    if not lines or lines[0] != "---":
        return None
    for index, line in enumerate(lines[1:], start=1):
        if line == "---":
            return "\n".join(lines[:index + 1]).strip()
    return None
