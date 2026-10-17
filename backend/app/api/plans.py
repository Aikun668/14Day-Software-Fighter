"""用药计划 API（J027）。"""
import uuid
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.access_policy import get_patient_for_clinician
from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models import (
    MedicationEvent,
    MedicationPlan,
    Patient,
    PlanDailyTime,
    PlannedSlot,
    User,
)
from app.schemas.common import Page
from app.schemas.plan import (
    DailyTimeOut,
    PlanCreate,
    PlanOut,
    PlanRevision,
    PlannedSlotOut,
)
from app.services.audit_service import write_audit
from app.services.plan_service import ensure_slots

router = APIRouter(prefix="/api", tags=["plans"])


def _build_plan_out(plan: MedicationPlan, db: Session) -> PlanOut:
    daily_times = db.query(PlanDailyTime).filter(PlanDailyTime.plan_id == plan.id).all()
    out = PlanOut.model_validate(plan)
    out.daily_times = [DailyTimeOut.model_validate(d) for d in daily_times]
    return out


@router.get("/patients/{patient_id}/medication-plans", response_model=Page[PlanOut])
def list_plans(
    patient_id: uuid.UUID,
    include_history: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    patient: Patient = Depends(get_patient_for_clinician),
    db: Session = Depends(get_db),
):
    q = db.query(MedicationPlan).filter(MedicationPlan.patient_id == patient_id)
    if not include_history:
        now = datetime.now(timezone.utc)
        q = q.filter(
            (MedicationPlan.ends_at.is_(None)) | (MedicationPlan.ends_at > now)
        )
    total = q.count()
    items = q.order_by(MedicationPlan.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Page[PlanOut](
        items=[_build_plan_out(p, db) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/patients/{patient_id}/medication-plans", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
def create_plan(
    body: PlanCreate,
    patient: Patient = Depends(get_patient_for_clinician),
    db: Session = Depends(get_db),
):
    # REGULAR 至少一个 daily_times；PRN 不配时点
    if body.plan_type == "REGULAR" and len(body.daily_times) == 0:
        raise HTTPException(status_code=422, detail={"code": "DAILY_TIMES_REQUIRED", "message": "固定计划至少配置一个每日时点", "details": None})
    if body.plan_type == "PRN" and len(body.daily_times) > 0:
        raise HTTPException(status_code=422, detail={"code": "PRN_NO_TIMES", "message": "按需计划不配置时点", "details": None})

    plan = MedicationPlan(
        patient_id=patient.id,
        device_model_id=body.device_model_id,
        plan_group_id=uuid.uuid4(),
        version=1,
        drug_label=body.drug_label,
        plan_type=body.plan_type,
        timezone=body.timezone,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
    )
    db.add(plan)
    db.flush()
    for dt in body.daily_times:
        h, m = dt.local_time.split(":")
        db.add(PlanDailyTime(plan_id=plan.id, local_time=datetime(2000, 1, 1, int(h), int(m)).time(), label=dt.label, is_enabled=True))
    write_audit(db, patient.assigned_clinician_id, "PLAN_CREATE", "medication_plan", plan.id, {"plan_type": plan.plan_type})
    db.commit()
    db.refresh(plan)
    return _build_plan_out(plan, db)


@router.post("/medication-plans/{plan_id}/revisions", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
def create_revision(
    plan_id: uuid.UUID,
    body: PlanRevision,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    old = db.query(MedicationPlan).filter(MedicationPlan.id == plan_id).first()
    if old is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "计划不存在", "details": None})
    # 归属校验
    if user.role == "CLINICIAN":
        patient = db.query(Patient).filter(Patient.id == old.patient_id).first()
        if patient is None or patient.assigned_clinician_id != user.id:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "资源不可访问", "details": None})

    # 同组版本不重叠
    overlap = (
        db.query(MedicationPlan)
        .filter(
            MedicationPlan.plan_group_id == old.plan_group_id,
            MedicationPlan.id != old.id,
            MedicationPlan.ends_at.is_(None) | (MedicationPlan.ends_at > body.starts_at),
        )
        .first()
    )
    if overlap:
        raise HTTPException(status_code=409, detail={"code": "PLAN_VERSION_CONFLICT", "message": "版本生效区间重叠", "details": None})

    # 旧版 ends_at = 新版本 starts_at
    old.ends_at = body.starts_at

    new = MedicationPlan(
        patient_id=old.patient_id,
        device_model_id=body.device_model_id or old.device_model_id,
        plan_group_id=old.plan_group_id,
        version=old.version + 1,
        drug_label=body.drug_label or old.drug_label,
        plan_type=old.plan_type,
        timezone=old.timezone,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
    )
    db.add(new)
    db.flush()
    if body.daily_times is not None:
        for dt in body.daily_times:
            h, m = dt.local_time.split(":")
            db.add(PlanDailyTime(plan_id=new.id, local_time=datetime(2000, 1, 1, int(h), int(m)).time(), label=dt.label, is_enabled=True))
    # 旧版未来未登记 slot 置 CANCELLED
    db.query(PlannedSlot).filter(
        PlannedSlot.plan_id == old.id,
        PlannedSlot.state == "ACTIVE",
        PlannedSlot.scheduled_at >= body.starts_at,
    ).update({"state": "CANCELLED"})
    write_audit(db, user.id, "PLAN_REVISION", "medication_plan", new.id, {"old_version": old.version})
    db.commit()
    db.refresh(new)
    return _build_plan_out(new, db)


@router.get("/me/medication-plans", response_model=Page[PlanOut])
def get_my_plans(
    include_history: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "未绑定患者档案", "details": None})
    q = db.query(MedicationPlan).filter(MedicationPlan.patient_id == patient.id)
    if not include_history:
        now = datetime.now(timezone.utc)
        q = q.filter((MedicationPlan.ends_at.is_(None)) | (MedicationPlan.ends_at > now))
    items = q.order_by(MedicationPlan.created_at.desc()).all()
    return Page[PlanOut](items=[_build_plan_out(p, db) for p in items], total=len(items), page=1, page_size=20)


@router.get("/me/daily-slots")
def get_my_daily_slots(
    date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    from_: str | None = Query(None, alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "未绑定患者档案", "details": None})

    tz = ZoneInfo("Asia/Shanghai")
    if date:
        day = datetime.strptime(date, "%Y-%m-%d").date()
        date_from = datetime.combine(day, time(0, 0), tzinfo=tz)
        date_to = date_from + timedelta(days=1)
    elif from_ and to:
        date_from = datetime.strptime(from_, "%Y-%m-%d").replace(tzinfo=tz)
        date_to = datetime.strptime(to, "%Y-%m-%d").replace(tzinfo=tz)
    else:
        today = datetime.now(tz).date()
        date_from = datetime.combine(today, time(0, 0), tzinfo=tz)
        date_to = date_from + timedelta(days=1)

    # 跨度限制 ≤ 31 天
    if (date_to - date_from).days > 31:
        raise HTTPException(status_code=422, detail={"code": "RANGE_TOO_LARGE", "message": "日期跨度最多 31 天", "details": None})

    # 为当前有效 REGULAR 计划确保时点
    plans = db.query(MedicationPlan).filter(
        MedicationPlan.patient_id == patient.id,
        MedicationPlan.plan_type == "REGULAR",
        (MedicationPlan.ends_at.is_(None)) | (MedicationPlan.ends_at > date_from),
    ).all()
    for p in plans:
        ensure_slots(db, p, date_from, date_to)
    db.commit()

    # 查询区间内 ACTIVE slot，附 has_active_record
    from_utc = date_from.astimezone(ZoneInfo("UTC"))
    to_utc = date_to.astimezone(ZoneInfo("UTC"))
    slots = (
        db.query(PlannedSlot)
        .filter(
            PlannedSlot.patient_id == patient.id,
            PlannedSlot.state == "ACTIVE",
            PlannedSlot.scheduled_at >= from_utc,
            PlannedSlot.scheduled_at < to_utc,
        )
        .order_by(PlannedSlot.scheduled_at)
        .all()
    )
    result = []
    for s in slots:
        has = (
            db.query(MedicationEvent)
            .filter(
                MedicationEvent.slot_id == s.id,
                MedicationEvent.status == "ACTIVE",
            )
            .first()
            is not None
        )
        out = PlannedSlotOut.model_validate(s)
        out.has_active_record = has
        result.append(out)
    return {"items": result, "timezone": "Asia/Shanghai"}
