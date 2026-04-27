from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


# system user role public schema
class SystemUserRoleSchema(StrEnum):
    ADMIN = "admin"
    USER = "user"


# system user public data schema
class SystemUserSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: SystemUserRoleSchema
    email: str
    username: str
    created_at: datetime
    updated_at: datetime


# create system user request schema
class CreateSystemUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)
    email: str = Field(default="", max_length=255)
    role: SystemUserRoleSchema = SystemUserRoleSchema.USER


# delete system user response schema
class DeleteSystemUserResponse(BaseModel):
    id: int
    deleted: bool

    
# update system user request schema
class UpdateSystemUserRequest(BaseModel):
    username: str | None = Field(default=None, min_length=1, max_length=64)
    password: str | None = Field(default=None, min_length=1, max_length=128)
    email: str | None = Field(default=None, max_length=255)
    role: SystemUserRoleSchema | None = None

    @model_validator(mode="after")
    def validate_has_updates(self):
        if all(
            value is None
            for value in (self.username, self.password, self.email, self.role)
        ):
            raise ValueError("at least one field must be provided")
        return self


# query system users response schema
class QuerySystemUsersResponse(BaseModel):
    page: int
    size: int
    items: list[SystemUserSchema]


# system user login request schema
class SystemUserLoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)


# system user login response schema
class SystemUserLoginResponse(BaseModel):
    token: str
