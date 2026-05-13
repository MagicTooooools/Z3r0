from datetime import datetime

from sqlmodel import Field, SQLModel

from schema.work_project.projects import WorkProjectStatus, WorkProjectType


class WorkProject(SQLModel, table=True):
    __tablename__ = "work_projects"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(default="")
    session_id: str = Field(default="")
    description: str = Field(default="")
    status: WorkProjectStatus = Field(default=WorkProjectStatus.WORKING)
    type: WorkProjectType = Field(default=WorkProjectType.PENETRATION_TEST)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
