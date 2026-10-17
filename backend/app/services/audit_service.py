"""审计日志服务（J018）。

关键写操作与业务同事务写入 audit_logs；detail 只存结构化最小摘要，
不存密码、Token、AI 问答原文。
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import AuditLog


def write_audit(
    db: Session,
    actor_id: uuid.UUID | None,
    action: str,
    resource_type: str,
    resource_id: uuid.UUID,
    detail: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        detail=detail or {},
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    return entry
