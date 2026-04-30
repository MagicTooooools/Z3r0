from datetime import datetime
from typing import Any

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel

from schema.sandbox_container_schema import SandboxContainerStatus


class SandboxContainer(SQLModel, table=True):
    __tablename__ = "sandbox_containers"

    id: int | None = Field(default=None, primary_key=True)
    container_name: str = Field(default="")
    container_hash: str = Field(default="")
    container_command: str = Field(default="")
    owner_id: int = Field(default=0, foreign_key="system_users.id", index=True)
    image_id: int = Field(default=0, foreign_key="sandbox_images.id", index=True)
    port_mappings: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    status: SandboxContainerStatus = Field(default=SandboxContainerStatus.CREATED)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
