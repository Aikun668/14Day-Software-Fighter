"""患者站内提醒 API（J037/REM-01）。

合并「今日计划动态派生」+「持久复训/随访提醒」，不泄露医护内部 tasks。
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models import (
    MedicationEvent,
    MedicationPlan,
    Patient,
    PatientReminder,
    PlannedSlot,
    User,
)
from app.schemas.followup import ReminderOut

router = APIRouter(prefix="/api/me", tags=["reminders"])


@router.get("/reminders")
def get_my_reminders(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "未绑定患者档案", "details": None})

    tz = ZoneInfo("Asia/Shanghai")
    now = datetime.now(timezone.utc)
    today_local = datetime.now(tz).date()
    day_start = datetime.combine(today_local, datetime.min.time(), tzinfo=tz).astimezone(ZoneInfo("UTC"))
    day_end = (datetime.combine(today_local, datetime.min.time(), tzinfo=tz) + timedelta(days=1)).astimezone(ZoneInfo("UTC"))

    items: list[dict] = []

    # 1) 派生：今日待登记时点（未登记且已到时点）
    slots = (
        db.query(PlannedSlot)
        .filter(
            PlannedSlot.patient_id == patient.id,
            PlannedSlot.state == "ACTIVE",
            PlannedSlot.scheduled_at >= day_start,
            PlannedSlot.scheduled_at < day_end,
        )
        .order_by(PlannedSlot.scheduled_at)
        .all()
    )
    for s in slots:
        has = (
            db.query(MedicationEvent)
            .filter(MedicationEvent.slot_id == s.id, MedicationEvent.status == "ACTIVE")
            .first()
            is not None
        )
        if not has:
            local_time = s.scheduled_at.astimezone(tz).strftime("%H:%M")
            items.append({
                "id": f"slot-{s.id}",
                "kind": "MEDICATION_DUE",
                "title": f"待登记：{local_time} 时点",
                "due_at": s.scheduled_at,
                "status": "PENDING",
                "source_type": "DERIVED_SLOT",
                "related_id": str(s.id),
            })

    # 2) 持久：复训/随访提醒
    reminders = (
        db.query(PatientReminder)
        .filter(PatientReminder.patient_id == patient.id)
        .order_by(PatientReminder.created_at.desc())
        .all()
    )
    for r in reminders:
        if r.status != "PENDING":
            continue
        items.append({
            "id": str(r.id),
            "kind": r.kind,
            "title": r.title,
            "due_at": r.due_at,
            "status": r.status,
            "source_type": "PERSISTENT",
            "related_id": str(r.related_followup_id) if r.related_followup_id else None,
        })

    return {"items": items}
