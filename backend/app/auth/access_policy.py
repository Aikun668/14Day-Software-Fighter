"""访问控制依赖（J012）。

统一权限链：鉴权 → 角色 → 找资源 → 验证患者归属 → 校验状态 → 执行业务。
角色以数据库当前状态为权威；客户端提交的 patient_id/source 等不被信任。
"""
import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models import Patient, User

# 角色枚举
ROLE_PATIENT = "PATIENT"
ROLE_CLINICIAN = "CLINICIAN"
ROLE_ADMIN = "ADMIN"


def _forbidden(msg: str = "无权访问该资源") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "FORBIDDEN", "message": msg, "details": None},
    )


def _not_found(msg: str = "资源不可访问") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "NOT_FOUND", "message": msg, "details": None},
    )


def require_clinician(user: User = Depends(get_current_user)) -> User:
    """要求医护或管理员角色。"""
    if user.role not in (ROLE_CLINICIAN, ROLE_ADMIN):
        raise _forbidden("需要医护权限")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """仅管理员。"""
    if user.role != ROLE_ADMIN:
        raise _forbidden("需要管理员权限")
    return user


def get_patient_for_clinician(
    patient_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Patient:
    """医护访问患者：验证归属；越权返回 404（避免存在性泄露）。"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        raise _not_found()
    # Admin 默认不继承患者临床记录读取权（除非显式授权，这里一律拒绝）
    if user.role == ROLE_CLINICIAN:
        if patient.assigned_clinician_id != user.id:
            raise _not_found()
    elif user.role == ROLE_ADMIN:
        # 管理员原则上有管理能力，但 PRD 规定 Admin 不默认享有临床详情
        raise _not_found("管理员不默认访问患者临床档案")
    else:
        # 患者角色不能通过此依赖访问他人
        raise _forbidden()
    return patient


def get_current_patient(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Patient:
    """患者访问本人档案（/api/me/*）。"""
    patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
    if patient is None:
        raise _not_found("未绑定患者档案")
    return patient
