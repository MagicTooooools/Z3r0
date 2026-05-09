import asyncio
import re
import shlex

from agents import RunContextWrapper, function_tool

from core.context import AgentRuntimeContext
from schema.tool_result_schema import ToolResultSchema, ToolResultStatusSchema, ToolResultTypeSchema
from service.sandbox_container_service import execute_sandbox_container_command
from utils.markdown import markdown_body_without_front_matter


_SKILL_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")
SANDBOX_SKILLS_DIR = "/root/.agents/skills"


@function_tool
async def execute_command(ctx: RunContextWrapper[AgentRuntimeContext], command: str) -> str:
    """Execute a command in the selected sandbox container.
    
    Args:
        command: The command to execute.

    Returns:
        The result of the command execution.
    """
    container_id = ctx.context.sandbox_container_id
    if container_id is None:
        return ToolResultSchema(
            status=ToolResultStatusSchema.ERROR,
            type=ToolResultTypeSchema.COMMAND_EXECUTION,
            output="No sandbox container selected.",
        ).model_dump_json()

    try:
        result = await execute_sandbox_container_command(id=container_id, command=command)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        return ToolResultSchema(
            status=ToolResultStatusSchema.ERROR,
            type=ToolResultTypeSchema.COMMAND_EXECUTION,
            output=str(exc) or "Command execution failed.",
        ).model_dump_json()

    return ToolResultSchema(
        status=ToolResultStatusSchema.SUCCESS if result.exit_code == 0 else ToolResultStatusSchema.ERROR,
        type=ToolResultTypeSchema.COMMAND_EXECUTION,
        output=result.output,
        exit_code=result.exit_code,
    ).model_dump_json()


@function_tool
async def load_skill(ctx: RunContextWrapper[AgentRuntimeContext], name: str) -> str:
    """Load the body of a named skill from the selected sandbox container.

    Args:
        name: Skill directory name under /root/.agents/skills.

    Returns:
        The skill detail markdown body without YAML Front Matter.
    """
    container_id = ctx.context.sandbox_container_id
    if container_id is None:
        return ToolResultSchema(
            status=ToolResultStatusSchema.ERROR,
            type=ToolResultTypeSchema.SKILL_DETAIL,
            output="No sandbox container selected.",
        ).model_dump_json()

    skill_name = name.strip()
    if not _SKILL_NAME_PATTERN.fullmatch(skill_name):
        return ToolResultSchema(
            status=ToolResultStatusSchema.ERROR,
            type=ToolResultTypeSchema.SKILL_DETAIL,
            output="Skill name must contain only letters, numbers, dot, underscore, or dash.",
        ).model_dump_json()

    skill_path = f"{SANDBOX_SKILLS_DIR}/{skill_name}/SKILL.md"
    command = f"test -f {shlex.quote(skill_path)} && cat {shlex.quote(skill_path)}"
    try:
        result = await execute_sandbox_container_command(id=container_id, command=command)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        return ToolResultSchema(
            status=ToolResultStatusSchema.ERROR,
            type=ToolResultTypeSchema.SKILL_DETAIL,
            output=str(exc) or "Skill loading failed.",
        ).model_dump_json()

    if result.exit_code != 0:
        return ToolResultSchema(
            status=ToolResultStatusSchema.ERROR,
            type=ToolResultTypeSchema.SKILL_DETAIL,
            output=f"Skill not found: {skill_name}",
            exit_code=result.exit_code,
        ).model_dump_json()

    return ToolResultSchema(
        status=ToolResultStatusSchema.SUCCESS,
        type=ToolResultTypeSchema.SKILL_DETAIL,
        output=markdown_body_without_front_matter(result.output),
        exit_code=result.exit_code,
    ).model_dump_json()
