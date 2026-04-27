from enum import StrEnum
from datetime import datetime

from sqlmodel import Field, SQLModel

from logger import get_logger


logger = get_logger(__name__)


# system user role enum
class SystemUserRole(StrEnum):
    ADMIN = "admin"
    USER = "user"


# system user database model
class SystemUser(SQLModel, table=True):
    __tablename__ = "system_users"

    id: int | None = Field(default=None, primary_key=True)
    role: SystemUserRole = Field(default=SystemUserRole.USER)
    email: str = Field(default="")
    username: str = Field(default="")
    password: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
