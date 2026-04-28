from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


# canonical work project status; reused by the model and by the public schema
class WorkProjectStatus(StrEnum):
    WORKING = "working"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


# canonical work project type; reused by the model and by the public schema
class WorkProjectType(StrEnum):
    PENETRATION_TEST = "penetration_test"
    SOURCE_CODE_AUDIT = "source_code_audit"


# work project public data schema
class WorkProjectSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    session_id: str
    description: str
    status: WorkProjectStatus
    type: WorkProjectType
    created_at: datetime
    updated_at: datetime


# create work project request schema
class CreateWorkProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    type: WorkProjectType = WorkProjectType.PENETRATION_TEST

    @field_validator("name", "description", mode="before")
    @classmethod
    def normalize_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value


# delete work project response schema (presence implies success)
class DeleteWorkProjectResponse(BaseModel):
    id: int


# query work projects response schema
class QueryWorkProjectsResponse(BaseModel):
    page: int
    size: int
    items: list[WorkProjectSchema]
