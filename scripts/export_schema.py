import json
import sys
from pathlib import Path
from typing import Any


ROOT_PATH = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT_PATH / "web" / "openapi.json"


def export_openapi_schema() -> Path:
    if str(ROOT_PATH) not in sys.path:
        sys.path.insert(0, str(ROOT_PATH))

    from app import create_app

    app = create_app()
    schema = app.openapi()
    _patch_auth_contracts(app, schema)
    _patch_validation_contracts(schema)
    _patch_error_contracts(schema)
    _register_extra_schemas(schema)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(schema, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return OUTPUT_PATH


def _patch_auth_contracts(app: Any, schema: dict[str, Any]) -> None:
    """drive OpenAPI security from the FastAPI dependency tree.

    routes that depend on require_user get BearerAuth + 401; routes that
    additionally depend on require_admin also get 403."""
    from middleware.auth import require_admin, require_user

    components = schema.setdefault("components", {})
    schemas = components.setdefault("schemas", {})
    schemas.setdefault("CommonResponse_Any_", _common_response_any_schema())
    components.setdefault("securitySchemes", {})["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
    }

    paths = schema.get("paths", {})
    for route in app.routes:
        path = getattr(route, "path", "")
        methods = getattr(route, "methods", None)
        if not methods or path not in paths:
            continue

        deps = _route_dependency_funcs(route)
        if not (require_user in deps or require_admin in deps):
            continue

        for method in methods:
            operation = paths[path].get(method.lower())
            if operation is None:
                continue
            operation["security"] = [{"BearerAuth": []}]
            responses = operation.setdefault("responses", {})
            responses["401"] = _common_response_ref("Unauthorized")
            if require_admin in deps:
                responses["403"] = _common_response_ref("Forbidden")


def _route_dependency_funcs(route: Any) -> set:
    funcs: set = set()
    dependant = getattr(route, "dependant", None)
    if dependant is not None:
        _walk_dependant(dependant, funcs)
    return funcs


def _walk_dependant(dependant: Any, funcs: set) -> None:
    if dependant.call is not None:
        funcs.add(dependant.call)
    for sub in dependant.dependencies:
        _walk_dependant(sub, funcs)


def _patch_validation_contracts(schema: dict[str, Any]) -> None:
    """rewrite FastAPI's default 422 docs to the runtime CommonResponse shape"""
    for methods in schema.get("paths", {}).values():
        for operation in methods.values():
            responses = operation.get("responses")
            if isinstance(responses, dict) and "422" in responses:
                _ensure_common_response(responses["422"], "Validation Error")


def _patch_error_contracts(schema: dict[str, Any]) -> None:
    """normalize documented error responses to the runtime CommonResponse shape"""
    descriptions = {
        "400": "Bad Request",
        "401": "Unauthorized",
        "403": "Forbidden",
        "404": "Not Found",
        "422": "Validation Error",
    }
    for methods in schema.get("paths", {}).values():
        for operation in methods.values():
            responses = operation.get("responses")
            if not isinstance(responses, dict):
                continue
            for status_code, description in descriptions.items():
                response = responses.get(status_code)
                if isinstance(response, dict):
                    _ensure_common_response(response, description)


def _register_extra_schemas(schema: dict[str, Any]) -> None:
    """publish ws contracts as OpenAPI components so the frontend can derive types"""
    from pydantic import TypeAdapter
    from schema.agent_event_schema import (
        AgentStreamCommandSchema,
        AgentStreamInterruptCommand,
        AgentStreamSendCommand,
        DoneEvent,
    )

    components = schema.setdefault("components", {})
    schemas = components.setdefault("schemas", {})

    extras = {
        "DoneEvent": DoneEvent,
        "AgentStreamSendCommand": AgentStreamSendCommand,
        "AgentStreamInterruptCommand": AgentStreamInterruptCommand,
        "AgentStreamCommandSchema": AgentStreamCommandSchema,
    }
    for name, model in extras.items():
        body = TypeAdapter(model).json_schema(ref_template="#/components/schemas/{model}")
        for nested_name, nested_body in body.pop("$defs", {}).items():
            schemas.setdefault(nested_name, nested_body)
        schemas[name] = body


def _common_response_ref(description: str) -> dict[str, Any]:
    return {
        "description": description,
        "content": {
            "application/json": {
                "schema": {"$ref": "#/components/schemas/CommonResponse_Any_"},
            },
        },
    }


def _ensure_common_response(response: dict[str, Any], description: str) -> None:
    response["description"] = response.get("description") or description
    content = response.setdefault("content", {})
    json_content = content.setdefault("application/json", {})
    json_content["schema"] = {"$ref": "#/components/schemas/CommonResponse_Any_"}


def _common_response_any_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "title": "CommonResponse[Any]",
        "properties": {
            "code": {"type": "integer", "title": "Code", "default": 200},
            "message": {"type": "string", "title": "Message", "default": "success"},
            "data": {"title": "Data"},
        },
    }


if __name__ == "__main__":
    output_path = export_openapi_schema()
    print(f"OpenAPI schema exported to {output_path}")
