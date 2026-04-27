from collections.abc import Callable
from http import HTTPStatus
from typing import Any, TypeVar

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response as StarletteResponse
from starlette.routing import Match

from config import get_config
from schema.response_schema import CommonResponse


EndpointT = TypeVar("EndpointT", bound=Callable[..., Any])

_ROLE_ADMIN = "admin"
_VALID_ROLES = {_ROLE_ADMIN, "user"}
_AUTH_HEADER_PREFIX = "Bearer "
_AUTH_WHITELIST_ATTR = "__auth_whitelist__"
_AUTH_REQUIRED_ROLE_ATTR = "__auth_required_role__"
_API_PATH_PREFIX = "/api"


def _error_response(status_code: HTTPStatus, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code.value,
        content=CommonResponse(code=status_code.value, message=message).model_dump(),
    )


def _extract_bearer_token(authorization: str) -> str | None:
    if not authorization.lower().startswith(_AUTH_HEADER_PREFIX.lower()):
        return None

    token = authorization[len(_AUTH_HEADER_PREFIX):].strip()
    return token or None


def _resolve_endpoint(request: Request) -> Callable[..., Any] | None:
    for route in request.app.routes:
        match, _ = route.matches(request.scope)
        if match == Match.FULL:
            return getattr(route, "endpoint", None)
    return None


def _is_auth_whitelisted(endpoint: Callable[..., Any]) -> bool:
    return bool(getattr(endpoint, _AUTH_WHITELIST_ATTR, False))


def _get_required_role(endpoint: Callable[..., Any] | None) -> str | None:
    if endpoint is None:
        return None
    return getattr(endpoint, _AUTH_REQUIRED_ROLE_ATTR, None)


def _is_valid_system_user_payload(payload: Any) -> bool:
    if not isinstance(payload, dict):
        return False

    return (
        isinstance(payload.get("id"), int)
        and payload.get("role") in _VALID_ROLES
        and isinstance(payload.get("email"), str)
        and isinstance(payload.get("username"), str)
        and payload.get("sub") == "z3r0"
    )


def _is_api_request(request: Request) -> bool:
    path = request.url.path
    return path == _API_PATH_PREFIX or path.startswith(f"{_API_PATH_PREFIX}/")


class JwtAuthMiddleware(BaseHTTPMiddleware):
    """validate jwt tokens and attach authenticated user context to request.state"""

    def __init__(self, app) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> StarletteResponse:
        if not _is_api_request(request):
            return await call_next(request)

        endpoint = _resolve_endpoint(request)
        if request.method == "OPTIONS" or endpoint is None or _is_auth_whitelisted(endpoint):
            return await call_next(request)

        token = _extract_bearer_token(request.headers.get("Authorization", ""))
        if token is None:
            return _error_response(HTTPStatus.UNAUTHORIZED, "missing bearer token")

        cfg = get_config()
        try:
            payload = jwt.decode(
                token,
                key=cfg.system.encrypt_key,
                algorithms=["HS256"],
                options={
                    "require": ["exp", "id", "role", "email", "username", "sub"],
                },
            )
        except jwt.ExpiredSignatureError:
            return _error_response(HTTPStatus.UNAUTHORIZED, "token expired")
        except jwt.InvalidTokenError:
            return _error_response(HTTPStatus.UNAUTHORIZED, "invalid token")

        if not _is_valid_system_user_payload(payload):
            return _error_response(HTTPStatus.UNAUTHORIZED, "invalid token payload")

        request.state.system_user = payload
        request.state.system_user_id = payload["id"]
        request.state.system_user_role = payload["role"]
        return await call_next(request)


class RoleAuthMiddleware(BaseHTTPMiddleware):
    """require admin role for protected management endpoints"""

    async def dispatch(self, request: Request, call_next) -> StarletteResponse:
        if not _is_api_request(request):
            return await call_next(request)

        endpoint = _resolve_endpoint(request)
        required_role = _get_required_role(endpoint)
        if request.method == "OPTIONS" or required_role is None:
            return await call_next(request)

        role = getattr(request.state, "system_user_role", None)
        if role is None:
            return _error_response(HTTPStatus.UNAUTHORIZED, "missing authenticated user")
        if role != required_role:
            return _error_response(HTTPStatus.FORBIDDEN, "admin role required")

        return await call_next(request)


def auth_whitelist(endpoint: EndpointT) -> EndpointT:
    """mark endpoint as not requiring jwt authentication"""
    setattr(endpoint, _AUTH_WHITELIST_ATTR, True)
    return endpoint


def admin_required(endpoint: EndpointT) -> EndpointT:
    """mark endpoint as requiring administrator role"""
    setattr(endpoint, _AUTH_REQUIRED_ROLE_ATTR, _ROLE_ADMIN)
    return endpoint
