from enum import StrEnum
from pydantic import BaseModel


class ToolResultStatusSchema(StrEnum):
    SUCCESS = "success"
    ERROR = "error"


class ToolResultTypeSchema(StrEnum):
    COMMAND_EXECUTION = "command_execution"
    SKILL_DETAIL = "skill_detail"


class ToolResultSchema(BaseModel):
    status: ToolResultStatusSchema
    type: ToolResultTypeSchema
    output: str = ""
    exit_code: int | None = None
