"""认证相关 Pydantic Schema（J010）。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account: str
    role: str
    status: str
    must_change_password: bool


class LoginRequest(BaseModel):
    account: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserBrief


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ChangePasswordResponse(BaseModel):
    password_changed: bool = True
    relogin_required: bool = True
