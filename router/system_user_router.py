from fastapi import APIRouter, Query

from handler.system_user_handler import (
    create_system_user_handler,
    delete_system_user_handler,
    query_system_users_handler,
    system_user_login_handler,
    update_system_user_handler,
)
from middleware.auth import admin_required, auth_whitelist
from schema.response_schema import CommonResponse
from schema.system_user_schema import (
    DeleteSystemUserResponse,
    QuerySystemUsersResponse,
    SystemUserLoginResponse,
    SystemUserSchema,
)


COMMON_ERROR_RESPONSES = {
    401: {
        "description": "Unauthorized",
        "model": CommonResponse,
    },
    403: {
        "description": "Forbidden",
        "model": CommonResponse,
    },
    422: {
        "description": "Validation Error",
        "model": CommonResponse,
    },
}
NOT_FOUND_RESPONSE = {
    404: {
        "description": "System user not found",
        "model": CommonResponse,
    },
}
LOGIN_ERROR_RESPONSES = {
    401: {
        "description": "Invalid email or password",
        "model": CommonResponse,
    },
    422: {
        "description": "Validation Error",
        "model": CommonResponse,
    },
}


router = APIRouter(prefix="/system-users", tags=["system-users"])


async def query_system_users_route(
    page: int = Query(default=1),
    size: int = Query(default=100),
    keyword: str = Query(default=""),
) -> CommonResponse[QuerySystemUsersResponse]:
    """query system users"""
    return await query_system_users_handler(page=page, size=size, keyword=keyword)

router.add_api_route(
    "",
    admin_required(create_system_user_handler),
    methods=["POST"],
    response_model=CommonResponse[SystemUserSchema],
    responses=COMMON_ERROR_RESPONSES,
)

router.add_api_route(
    "/login",
    auth_whitelist(system_user_login_handler),
    methods=["POST"],
    response_model=CommonResponse[SystemUserLoginResponse],
    responses=LOGIN_ERROR_RESPONSES,
)

router.add_api_route(
    "/{id}",
    admin_required(delete_system_user_handler),
    methods=["DELETE"],
    response_model=CommonResponse[DeleteSystemUserResponse],
    responses={**COMMON_ERROR_RESPONSES, **NOT_FOUND_RESPONSE},
)

router.add_api_route(
    "/{id}",
    admin_required(update_system_user_handler),
    methods=["PATCH"],
    response_model=CommonResponse[SystemUserSchema],
    responses={**COMMON_ERROR_RESPONSES, **NOT_FOUND_RESPONSE},
)

router.add_api_route(
    "",
    admin_required(query_system_users_route),
    methods=["GET"],
    response_model=CommonResponse[QuerySystemUsersResponse],
    responses=COMMON_ERROR_RESPONSES,
)
