"""认证 API：登录/退出/改密/当前身份（J010）。"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import bearer_scheme, get_current_user
from app.auth.security import (
    create_access_token,
    decode_token,
    hash_password,
    new_jti,
    verify_password,
)
from app.core.database import get_db
from app.models import AuthSession, User
from app.schemas.auth import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    LoginRequest,
    LoginResponse,
    UserBrief,
)

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.account == body.account).first()
    # 统一错误提示：账号不存在与密码错误返回同一 401，避免账号枚举
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "账号或密码错误", "details": None},
        )
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "ACCOUNT_DISABLED", "message": "账号已停用", "details": None},
        )

    jti = new_jti()
    token, expires_at = create_access_token(user.id, jti)
    db.add(
        AuthSession(
            user_id=user.id,
            token_jti=jti,
            expires_at=expires_at,
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    return LoginResponse(access_token=token, expires_at=expires_at, user=UserBrief.model_validate(user))


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    credentials=Depends(bearer_scheme),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 撤销当前会话（从 token 取 jti）
    if credentials is not None:
        try:
            payload = decode_token(credentials.credentials)
            jti = payload.get("jti")
            if jti:
                db.query(AuthSession).filter(AuthSession.token_jti == jti).update(
                    {"revoked_at": datetime.now(timezone.utc)}
                )
                db.commit()
        except Exception:
            db.rollback()
    return None


@router.get("/me", response_model=UserBrief)
def me(user: User = Depends(get_current_user)):
    return UserBrief.model_validate(user)


@router.post("/auth/change-password", response_model=ChangePasswordResponse)
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "WRONG_PASSWORD", "message": "原密码错误", "details": None},
        )
    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    # 撤销该用户所有会话（改密后需重登）
    db.query(AuthSession).filter(AuthSession.user_id == user.id).update(
        {"revoked_at": datetime.now(timezone.utc)}
    )
    db.commit()
    return ChangePasswordResponse(password_changed=True, relogin_required=True)
