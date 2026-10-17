"""管理员账号管理 API（J011）。"""
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.access_policy import require_admin
from app.auth.security import hash_password
from app.core.database import get_db
from app.models import User
from app.schemas.admin import (
    CreateUserRequest,
    CreateUserResponse,
    PatchUserRequest,
)
from app.schemas.auth import UserBrief
from app.schemas.common import Page

router = APIRouter(prefix="/api/admin", tags=["admin-users"])


@router.get("/users", response_model=Page[UserBrief])
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: str | None = None,
    status: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if status:
        q = q.filter(User.status == status)
    total = q.count()
    items = q.order_by(User.created_at).offset((page - 1) * page_size).limit(page_size).all()
    return Page[UserBrief](
        items=[UserBrief.model_validate(u) for u in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/users", response_model=CreateUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.role not in ("CLINICIAN", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_ROLE", "message": "角色仅支持 CLINICIAN/ADMIN", "details": None},
        )
    if db.query(User).filter(User.account == body.account).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ACCOUNT_EXISTS", "message": "账号已存在", "details": None},
        )
    # 初始密码：传入则用，否则生成一次性临时密码（仅本次响应展示一次）
    temp = body.initial_password or secrets.token_urlsafe(12)
    user = User(
        account=body.account,
        password_hash=hash_password(temp),
        role=body.role,
        status="ACTIVE",
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return CreateUserResponse(
        id=user.id,
        account=user.account,
        role=user.role,
        status=user.status,
        must_change_password=True,
        temporary_password=temp if not body.initial_password else None,
    )


@router.patch("/users/{user_id}", response_model=UserBrief)
def patch_user(
    user_id: uuid.UUID,
    body: PatchUserRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "用户不存在", "details": None},
        )
    user.status = body.status
    db.commit()
    db.refresh(user)
    return UserBrief.model_validate(user)
