from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

from fastapi import status as http_status


T = TypeVar("T")


# common response schema
class CommonResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    code: int = http_status.HTTP_200_OK
    message: str = "success"
    data: T | None = None
