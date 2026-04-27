from http import HTTPStatus

from model.system_user_model import SystemUser, SystemUserRole
from schema.response_schema import CommonResponse
from schema.system_user_schema import (
    CreateSystemUserRequest,
    DeleteSystemUserResponse,
    QuerySystemUsersResponse,
    SystemUserLoginRequest,
    SystemUserLoginResponse,
    SystemUserSchema,
    UpdateSystemUserRequest,
)
from service.system_user_service import (
    create_system_user,
    delete_system_user,
    query_system_users,
    system_user_login,
    update_system_user,
)


def _to_system_user_schema(system_user: SystemUser) -> SystemUserSchema:
    """convert database model to public system user schema"""
    return SystemUserSchema.model_validate(system_user)


async def create_system_user_handler(request: CreateSystemUserRequest) -> CommonResponse:
    """create system user"""
    system_user = await create_system_user(
        username=request.username,
        password=request.password,
        email=request.email,
        role=SystemUserRole(request.role.value),
    )
    return CommonResponse(data=_to_system_user_schema(system_user))


async def delete_system_user_handler(id: int) -> CommonResponse:
    """delete system user"""
    deleted = await delete_system_user(id)
    if not deleted:
        return CommonResponse(
            code=HTTPStatus.NOT_FOUND.value,
            message="system user not found",
            data=DeleteSystemUserResponse(id=id, deleted=False),
        )

    return CommonResponse(data=DeleteSystemUserResponse(id=id, deleted=True))


async def update_system_user_handler(id: int, request: UpdateSystemUserRequest) -> CommonResponse:
    """update system user"""
    role = SystemUserRole(request.role.value) if request.role is not None else None
    system_user = await update_system_user(
        id=id,
        username=request.username,
        password=request.password,
        email=request.email,
        role=role,
    )
    if system_user is None:
        return CommonResponse(
            code=HTTPStatus.NOT_FOUND.value,
            message="system user not found",
        )

    return CommonResponse(data=_to_system_user_schema(system_user))


async def query_system_users_handler(page: int = 1, size: int = 100, keyword: str = "") -> CommonResponse:
    """query system users"""
    if page < 1:
        return CommonResponse(
            code=HTTPStatus.BAD_REQUEST.value,
            message="page must be greater than or equal to 1",
        )
    if size < 1 or size > 100:
        return CommonResponse(
            code=HTTPStatus.BAD_REQUEST.value,
            message="size must be between 1 and 100",
        )

    system_users = await query_system_users(page=page, size=size, keyword=keyword)
    data = QuerySystemUsersResponse(
        page=page,
        size=size,
        items=[_to_system_user_schema(system_user) for system_user in system_users],
    )
    return CommonResponse(data=data)


async def system_user_login_handler(request: SystemUserLoginRequest) -> CommonResponse:
    """system user login"""
    token = await system_user_login(email=request.email, password=request.password)
    if token is None:
        return CommonResponse(
            code=HTTPStatus.UNAUTHORIZED.value,
            message="invalid email or password",
        )

    return CommonResponse(data=SystemUserLoginResponse(token=token))
