import asyncio
import re
import secrets
import socket as py_socket
from datetime import datetime

import docker
from sqlmodel import select

from database import get_async_session
from logger import get_logger
from model.sandbox.containers import SandboxContainer
from model.sandbox.images import SandboxImage
from model.system_user.users import SystemUser
from schema.sandbox.containers import (
    DEFAULT_SANDBOX_CONTAINER_COMMAND,
    SandboxContainerPortMapping,
    SandboxContainerStatus,
)
from schema.sandbox.images import SandboxImageStatus
from service.sandbox.docker_ops import (
    image_ref as docker_image_ref,
    inspect_image_exposed_ports_sync,
    create_container_sync,
    start_container_sync,
    stop_container_sync,
    remove_container_sync,
)
from service.sandbox.records import load_sandbox_container_record
from service.sandbox.status import (
    ContainerStatusSnapshot,
    save_sandbox_container_status,
    sync_container_status,
    invalidate_agent_tool_bindings,
)
from service.sandbox.types import (
    SandboxContainerDefaultPortMappingsResult,
    SandboxContainerMutationResult,
    SandboxContainerProtocol,
)


logger = get_logger(__name__)

_RANDOM_HOST_PORT_MIN = 49152
_RANDOM_HOST_PORT_MAX = 65535
_RANDOM_HOST_PORT_ATTEMPTS = 128


def _container_name_prefix(image_name: str) -> str:
    short_name = image_name.rsplit("/", 1)[-1].split("@", 1)[0].split(":", 1)[0]
    normalized = re.sub(r"[^a-zA-Z0-9_.-]+", "-", short_name).strip("-.")
    return normalized or "sandbox"

def _serialize_port_mappings(port_mappings: list[SandboxContainerPortMapping]) -> list[dict]:
    return [mapping.model_dump() for mapping in port_mappings]

def _is_host_port_available(host_port: int, protocol: SandboxContainerProtocol) -> bool:
    socket_type = py_socket.SOCK_STREAM if protocol == "tcp" else py_socket.SOCK_DGRAM
    with py_socket.socket(py_socket.AF_INET, socket_type) as sock:
        try:
            sock.bind(("0.0.0.0", host_port))
        except OSError:
            return False
    return True

def _random_host_port(
    protocol: SandboxContainerProtocol,
    reserved: set[tuple[int, SandboxContainerProtocol]],
) -> int:
    port_count = _RANDOM_HOST_PORT_MAX - _RANDOM_HOST_PORT_MIN + 1
    for _ in range(_RANDOM_HOST_PORT_ATTEMPTS):
        host_port = _RANDOM_HOST_PORT_MIN + secrets.randbelow(port_count)
        key = (host_port, protocol)
        if key in reserved:
            continue
        if _is_host_port_available(host_port, protocol):
            reserved.add(key)
            return host_port
    raise RuntimeError("failed to allocate host port")

async def _load_reserved_host_ports() -> set[tuple[int, SandboxContainerProtocol]]:
    async with get_async_session() as session:
        result = await session.exec(select(SandboxContainer.port_mappings))
        rows = result.all()

    reserved: set[tuple[int, SandboxContainerProtocol]] = set()
    for mappings in rows:
        if not isinstance(mappings, list):
            continue
        for mapping in mappings:
            if not isinstance(mapping, dict):
                continue
            host_port = mapping.get("host_port")
            protocol = mapping.get("protocol")
            if isinstance(host_port, int) and protocol in {"tcp", "udp"}:
                reserved.add((host_port, protocol))
    return reserved

async def create_sandbox_container(
    image_id: int,
    owner_id: int,
    port_mappings: list[SandboxContainerPortMapping],
    novnc_support: bool = False,
    novnc_port: int = 0,
    container_command: str = DEFAULT_SANDBOX_CONTAINER_COMMAND,
) -> SandboxContainerMutationResult:
    container_command = container_command.strip()
    novnc_port = novnc_port if novnc_support else 0

    async with get_async_session() as session:
        sandbox_image = await session.get(SandboxImage, image_id)
        if sandbox_image is None:
            return SandboxContainerMutationResult(
                record=None,
                changed=False,
                message="sandbox image not found",
                not_found=True,
            )
        if sandbox_image.status != SandboxImageStatus.READY:
            return SandboxContainerMutationResult(
                record=None,
                changed=False,
                message="only ready sandbox images can create containers",
            )

        owner = await session.get(SystemUser, owner_id)
        if owner is None:
            return SandboxContainerMutationResult(
                record=None,
                changed=False,
                message="system user not found",
                not_found=True,
            )

        image_ref = docker_image_ref(sandbox_image)
        container_name_prefix = _container_name_prefix(sandbox_image.image_name)

    try:
        container_hash, container_name = await asyncio.to_thread(
            create_container_sync,
            image_ref,
            container_name_prefix,
            container_command,
            port_mappings,
        )
    except Exception:
        logger.exception("sandbox container create failed for image: %s", image_id)
        return SandboxContainerMutationResult(
            record=None,
            changed=False,
            message="failed to create sandbox container",
        )

    now = datetime.now()
    sandbox_container = SandboxContainer(
        container_name=container_name,
        container_hash=container_hash,
        container_command=container_command,
        owner_id=owner_id,
        image_id=image_id,
        port_mappings=_serialize_port_mappings(port_mappings),
        novnc_support=novnc_support,
        novnc_port=novnc_port,
        status=SandboxContainerStatus.CREATED,
        created_at=now,
        updated_at=now,
    )

    try:
        async with get_async_session() as session:
            session.add(sandbox_container)
            await session.commit()
            await session.refresh(sandbox_container)
    except Exception:
        await asyncio.to_thread(remove_container_sync, container_hash)
        raise

    if sandbox_container.id is None:
        await asyncio.to_thread(remove_container_sync, container_hash)
        raise RuntimeError("sandbox container id was not generated")

    logger.info("sandbox container created: %s", sandbox_container.id)
    return SandboxContainerMutationResult(
        record=await load_sandbox_container_record(sandbox_container.id),
        changed=True,
        message="sandbox container created",
    )

async def generate_default_sandbox_container_port_mappings(
    image_id: int,
) -> SandboxContainerDefaultPortMappingsResult:
    async with get_async_session() as session:
        sandbox_image = await session.get(SandboxImage, image_id)
        if sandbox_image is None:
            return SandboxContainerDefaultPortMappingsResult(
                port_mappings=[],
                ok=False,
                message="sandbox image not found",
                not_found=True,
            )
        if sandbox_image.status != SandboxImageStatus.READY:
            return SandboxContainerDefaultPortMappingsResult(
                port_mappings=[],
                ok=False,
                message="only ready sandbox images can generate port mappings",
            )
        image_ref = docker_image_ref(sandbox_image)

    try:
        exposed_ports = await asyncio.to_thread(inspect_image_exposed_ports_sync, image_ref)
    except Exception:
        logger.exception("sandbox image exposed ports inspect failed: %s", image_id)
        return SandboxContainerDefaultPortMappingsResult(
            port_mappings=[],
            ok=False,
            message="failed to inspect sandbox image exposed ports",
        )

    if not exposed_ports:
        return SandboxContainerDefaultPortMappingsResult(
            port_mappings=[],
            ok=True,
            message="sandbox image has no exposed ports",
        )

    reserved = await _load_reserved_host_ports()
    try:
        port_mappings = [
            SandboxContainerPortMapping(
                container_port=exposed.container_port,
                host_port=_random_host_port(exposed.protocol, reserved),
                protocol=exposed.protocol,
            )
            for exposed in exposed_ports
        ]
    except RuntimeError:
        logger.exception("sandbox container host port allocation failed for image: %s", image_id)
        return SandboxContainerDefaultPortMappingsResult(
            port_mappings=[],
            ok=False,
            message="failed to allocate host ports",
        )

    return SandboxContainerDefaultPortMappingsResult(
        port_mappings=port_mappings,
        ok=True,
        message="sandbox container port mappings generated",
    )

async def start_sandbox_container(id: int) -> SandboxContainerMutationResult:
    record = await load_sandbox_container_record(id)
    if record is None:
        return SandboxContainerMutationResult(
            record=None,
            changed=False,
            message="sandbox container not found",
            not_found=True,
        )
    if record.container.status not in {SandboxContainerStatus.CREATED, SandboxContainerStatus.STOPPED}:
        return SandboxContainerMutationResult(
            record=record,
            changed=False,
            message="only created or stopped sandbox containers can be started",
        )

    try:
        await asyncio.to_thread(start_container_sync, record.container.container_hash)
        await asyncio.sleep(1)
        await sync_container_status(ContainerStatusSnapshot(
            id=record.container.id or id,
            container_hash=record.container.container_hash,
            status=record.container.status,
        ))
    except docker.errors.NotFound:
        logger.debug("sandbox container instance not found while starting: %s", id)
        return SandboxContainerMutationResult(
            record=await save_sandbox_container_status(id, SandboxContainerStatus.ERROR),
            changed=False,
            message="sandbox container instance not found",
        )
    except Exception:
        logger.exception("sandbox container start failed: %s", id)
        return SandboxContainerMutationResult(
            record=await save_sandbox_container_status(id, SandboxContainerStatus.ERROR),
            changed=False,
            message="failed to start sandbox container",
        )

    next_record = await load_sandbox_container_record(id)
    if next_record is not None and next_record.container.status == SandboxContainerStatus.RUNNING:
        logger.info("sandbox container started: %s", id)
        return SandboxContainerMutationResult(
            record=next_record,
            changed=True,
            message="sandbox container started",
        )

    logger.info("sandbox container exited after start: %s", id)
    return SandboxContainerMutationResult(
        record=next_record,
        changed=False,
        message="sandbox container is not running after start",
    )

async def stop_sandbox_container(id: int) -> SandboxContainerMutationResult:
    record = await load_sandbox_container_record(id)
    if record is None:
        return SandboxContainerMutationResult(
            record=None,
            changed=False,
            message="sandbox container not found",
            not_found=True,
        )
    if record.container.status != SandboxContainerStatus.RUNNING:
        return SandboxContainerMutationResult(
            record=record,
            changed=False,
            message="only running sandbox containers can be stopped",
        )

    try:
        await asyncio.to_thread(stop_container_sync, record.container.container_hash)
    except docker.errors.NotFound:
        logger.debug("sandbox container instance not found while stopping: %s", id)
        return SandboxContainerMutationResult(
            record=await save_sandbox_container_status(id, SandboxContainerStatus.ERROR),
            changed=False,
            message="sandbox container instance not found",
        )
    except Exception:
        logger.exception("sandbox container stop failed: %s", id)
        return SandboxContainerMutationResult(
            record=await save_sandbox_container_status(id, SandboxContainerStatus.ERROR),
            changed=False,
            message="failed to stop sandbox container",
        )

    logger.info("sandbox container stopped: %s", id)
    return SandboxContainerMutationResult(
        record=await save_sandbox_container_status(id, SandboxContainerStatus.STOPPED),
        changed=True,
        message="sandbox container stopped",
    )

async def delete_sandbox_container(id: int) -> bool:
    async with get_async_session() as session:
        sandbox_container = await session.get(SandboxContainer, id)
        if sandbox_container is None:
            return False

        await asyncio.to_thread(remove_container_sync, sandbox_container.container_hash)
        await session.delete(sandbox_container)
        await session.commit()

    await invalidate_agent_tool_bindings(id)
    logger.info("sandbox container deleted: %s", id)
    return True
