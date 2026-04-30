from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


DEFAULT_SANDBOX_CONTAINER_COMMAND = "trap 'exit 0' TERM INT; while :; do sleep 3600; done"


class SandboxContainerStatus(StrEnum):
    CREATED = "created"
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"


# sandbox container port mapping schema
class SandboxContainerPortMapping(BaseModel):
    container_port: int = Field(ge=1, le=65535)
    host_port: int = Field(ge=1, le=65535)
    protocol: Literal["tcp", "udp"] = "tcp"

    @field_validator("protocol", mode="before")
    @classmethod
    def normalize_protocol(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip().lower()
        return value


# sandbox container public data schema
class SandboxContainerSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    container_name: str
    container_hash: str
    image_id: int
    image_name: str
    container_command: str
    port_mappings: list[SandboxContainerPortMapping]
    status: SandboxContainerStatus
    owner_id: int
    owner_username: str
    created_at: datetime
    updated_at: datetime


# create sandbox container request schema
class CreateSandboxContainerRequest(BaseModel):
    image_id: int = Field(gt=0)
    container_command: str = Field(default=DEFAULT_SANDBOX_CONTAINER_COMMAND, min_length=1, max_length=2000)
    port_mappings: list[SandboxContainerPortMapping] = Field(default_factory=list, max_length=32)

    @field_validator("container_command", mode="before")
    @classmethod
    def normalize_container_command(cls, value: Any) -> Any:
        if value is None:
            return DEFAULT_SANDBOX_CONTAINER_COMMAND
        if isinstance(value, str):
            command = value.strip()
            return command or DEFAULT_SANDBOX_CONTAINER_COMMAND
        return value

    @model_validator(mode="after")
    def validate_unique_port_mappings(self):
        container_ports: set[tuple[int, str]] = set()
        host_ports: set[tuple[int, str]] = set()
        for mapping in self.port_mappings:
            container_key = (mapping.container_port, mapping.protocol)
            host_key = (mapping.host_port, mapping.protocol)
            if container_key in container_ports:
                raise ValueError("container ports must be unique per protocol")
            if host_key in host_ports:
                raise ValueError("host ports must be unique per protocol")
            container_ports.add(container_key)
            host_ports.add(host_key)
        return self


# delete sandbox container response schema (presence implies success)
class DeleteSandboxContainerResponse(BaseModel):
    id: int


# query sandbox containers response schema
class QuerySandboxContainersResponse(BaseModel):
    page: int
    size: int
    items: list[SandboxContainerSchema]
