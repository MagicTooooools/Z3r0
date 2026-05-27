from sqlalchemy import String, cast, or_
from sqlmodel import select

from database import get_async_session
from model.sandbox.containers import SandboxContainer
from model.sandbox.images import SandboxImage
from model.system_user.users import SystemUser
from schema.sandbox.containers import SandboxContainerStatus
from schema.system_user.users import SystemUserRole
from service.common.pagination import Page, paginate_statement
from service.sandbox.types import SandboxContainerRecord


async def load_sandbox_container_record(id: int) -> SandboxContainerRecord | None:
    statement = (
        select(SandboxContainer, SandboxImage.image_name, SystemUser.username)
        .join(SandboxImage, SandboxContainer.image_id == SandboxImage.id)
        .join(SystemUser, SandboxContainer.owner_id == SystemUser.id)
        .where(SandboxContainer.id == id)
    )

    async with get_async_session() as session:
        result = await session.exec(statement)
        row = result.first()
        if row is None:
            return None
        return SandboxContainerRecord(container=row[0], image_name=row[1], owner_username=row[2])

async def query_sandbox_containers(
    page: int = 1,
    size: int = 100,
    keyword: str = "",
) -> Page[SandboxContainerRecord]:
    statement = (
        select(SandboxContainer, SandboxImage.image_name, SystemUser.username)
        .join(SandboxImage, SandboxContainer.image_id == SandboxImage.id)
        .join(SystemUser, SandboxContainer.owner_id == SystemUser.id)
        .order_by(SandboxContainer.id)
    )

    keyword = keyword.strip()
    if keyword:
        pattern = f"%{keyword}%"
        statement = statement.where(
            or_(
                SandboxContainer.container_name.ilike(pattern),
                SandboxContainer.container_hash.ilike(pattern),
                SandboxImage.image_name.ilike(pattern),
                SystemUser.username.ilike(pattern),
                cast(SandboxContainer.status, String).ilike(pattern),
                cast(SandboxContainer.port_mappings, String).ilike(pattern),
            )
        )

    page_result = await paginate_statement(statement, page=page, size=size)
    return Page(
        page=page_result.page,
        size=page_result.size,
        total=page_result.total,
        items=[_sandbox_container_record(row) for row in page_result.items],
    )

async def query_available_sandbox_containers(
    user_id: int,
    user_role: SystemUserRole,
    page: int = 1,
    size: int = 100,
    keyword: str = "",
) -> Page[SandboxContainerRecord]:
    statement = (
        select(SandboxContainer, SandboxImage.image_name, SystemUser.username)
        .join(SandboxImage, SandboxContainer.image_id == SandboxImage.id)
        .join(SystemUser, SandboxContainer.owner_id == SystemUser.id)
        .order_by(SandboxContainer.id)
    )

    if user_role != SystemUserRole.ADMIN:
        statement = statement.where(SandboxContainer.owner_id == user_id)
    statement = statement.where(SandboxContainer.status == SandboxContainerStatus.RUNNING)

    keyword = keyword.strip()
    if keyword:
        pattern = f"%{keyword}%"
        statement = statement.where(
            or_(
                SandboxContainer.container_name.ilike(pattern),
                SandboxContainer.container_hash.ilike(pattern),
                SandboxImage.image_name.ilike(pattern),
                SystemUser.username.ilike(pattern),
                cast(SandboxContainer.status, String).ilike(pattern),
                cast(SandboxContainer.port_mappings, String).ilike(pattern),
            )
        )

    page_result = await paginate_statement(statement, page=page, size=size)
    return Page(
        page=page_result.page,
        size=page_result.size,
        total=page_result.total,
        items=[_sandbox_container_record(row) for row in page_result.items],
    )


def _sandbox_container_record(row) -> SandboxContainerRecord:
    return SandboxContainerRecord(container=row[0], image_name=row[1], owner_username=row[2])
