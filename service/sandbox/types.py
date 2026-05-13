from dataclasses import dataclass
from typing import Literal

from model.sandbox.containers import SandboxContainer
from schema.sandbox.containers import SandboxContainerPortMapping


SandboxContainerProtocol = Literal["tcp", "udp"]


@dataclass(frozen=True)
class SandboxContainerRecord:
    container: SandboxContainer
    image_name: str
    owner_username: str


@dataclass(frozen=True)
class SandboxContainerMutationResult:
    record: SandboxContainerRecord | None
    changed: bool
    message: str = ""
    not_found: bool = False


@dataclass(frozen=True)
class SandboxContainerDefaultPortMappingsResult:
    port_mappings: list[SandboxContainerPortMapping]
    ok: bool
    message: str = ""
    not_found: bool = False


@dataclass(frozen=True)
class SandboxContainerCommandResult:
    output: str
    exit_code: int


@dataclass(frozen=True)
class SandboxContainerToolBinding:
    id: int
    generation: int
