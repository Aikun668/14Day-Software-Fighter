"""审计日志 API（J018 骨架）。"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.auth.access_policy import require_admin
from app.core.database import get_db
from app.models import AuditLog, User
from app.schemas.common import Page


class AuditLogBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: uuid.UUID | None
    action: str
    resource_type: str
    resource_id: uuid.UUID
    detail: dict | None
    created_at: datetime


router = APIRouter(prefix="/api/admin", tags=["audit"])


@router.get("/audit-logs", response_model=Page[AuditLogBrief])
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    actor_id: uuid.UUID | None = None,
    resource_type: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if actor_id:
        q = q.filter(AuditLog.actor_id == actor_id)
    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)
    total = q.count()
    items = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Page[AuditLogBrief](
        items=[AuditLogBrief.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
    )
