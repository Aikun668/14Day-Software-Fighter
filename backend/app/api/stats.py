"""统计服务与 API（J031）。

严格按 TECH_DESIGN §4.3.2 口径：
N = 窗口内已到期、有效 REGULAR 时点数
M = 其中存在 ACTIVE 登记的不同 slot_id 数
coverage_rate = ROUND(M/N*100, 1)（N=0 时 null）
source_breakdown = 有效登记事件按来源计数（非去重时点数、不含撤销）
"""
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.access_policy import get_patient_for_clinician
from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models import MedicationEvent, MedicationPlan, Patient, PlannedSlot, User
from app.schemas.stats import MissingSlot, OverviewResponse, PatientCoverageRow, StatsResponse

router = APIRouter(prefix="/api", tags=["stats"])


def _compute_stats(db: Session, patient_id: uuid.UUID, from_date: str, to_date: str, tz_name: str = "Asia/Shanghai") -> StatsResponse:
    tz = ZoneInfo(tz_name)
    date_from = datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=tz)
    date_to = datetime.strptime(to_date, "%Y-%m-%d").replace(tzinfo=tz)
    from_utc = date_from.astimezone(ZoneInfo("UTC"))
    to_utc = date_to.astimezone(ZoneInfo("UTC"))

    # 分母集合 S：窗口内已到期、有效 REGULAR 时点（排除 CANCELLED 和未来时点）
    now = datetime.now(timezone.utc)
    slots = (
        db.query(PlannedSlot)
        .filter(
            PlannedSlot.patient_id == patient_id,
            PlannedSlot.state == "ACTIVE",
            PlannedSlot.scheduled_at >= from_utc,
            PlannedSlot.scheduled_at < to_utc,
            PlannedSlot.scheduled_at <= now,  # 已到期
        )
        .order_by(PlannedSlot.scheduled_at)
        .all()
    )
    slot_ids = {s.id for s in slots}
    N = len(slot_ids)

    # M：有 ACTIVE 登记的不同 slot_id 数
    active_events = (
        db.query(MedicationEvent)
        .filter(
            MedicationEvent.patient_id == patient_id,
            MedicationEvent.status == "ACTIVE",
            MedicationEvent.slot_id.in_(slot_ids) if slot_ids else MedicationEvent.slot_id.is_(None),
        )
        .all()
    )
    covered_slots = {e.slot_id for e in active_events if e.slot_id is not None}
    M = len(covered_slots)

    coverage_rate = round(M / N * 100, 1) if N > 0 else None

    # 缺失时点
    missing = [s for s in slots if s.id not in covered_slots]
    missing_slots = [MissingSlot(slot_id=str(s.id), scheduled_at=s.scheduled_at) for s in missing]

    # source_breakdown：有效登记事件按来源计数（非去重时点数、不含撤销）
    source_breakdown: dict[str, int] = {}
    for e in active_events:
        if e.slot_id in slot_ids:  # 只统计属于分母集合的
            source_breakdown[e.source] = source_breakdown.get(e.source, 0) + 1

    return StatsResponse(
        from_=from_date,
        to=to_date,
        timezone=tz_name,
        N=N,
        M=M,
        coverage_rate=coverage_rate,
        missing_slots=missing_slots,
        source_breakdown=source_breakdown,
    )


@router.get("/me/stats", response_model=StatsResponse)
def get_my_stats(
    from_: str = Query(..., alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "未绑定患者档案", "details": None})
    return _compute_stats(db, patient.id, from_, to)


@router.get("/patients/{patient_id}/stats", response_model=StatsResponse)
def get_patient_stats(
    patient_id: uuid.UUID,
    from_: str = Query(..., alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    patient: Patient = Depends(get_patient_for_clinician),
    db: Session = Depends(get_db),
):
    return _compute_stats(db, patient_id, from_, to)


@router.get("/stats/overview", response_model=OverviewResponse)
def get_overview(
    from_: str = Query(..., alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """医护工作台概览：聚合负责患者的覆盖率，按缺失数降序（紧急在前）。

    权限：仅 CLINICIAN/ADMIN；数据范围严格限定为本人负责的患者。
    """
    if user.role not in ("CLINICIAN", "ADMIN"):
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "仅医护可访问", "details": None})

    patients = (
        db.query(Patient)
        .filter(Patient.assigned_clinician_id == user.id)
        .order_by(Patient.patient_code)
        .all()
    )

    rows: list[PatientCoverageRow] = []
    total_N = 0
    total_M = 0
    planned_count = 0
    for p in patients:
        s = _compute_stats(db, p.id, from_, to)
        if s.N > 0:
            planned_count += 1
            total_N += s.N
            total_M += s.M
        rows.append(PatientCoverageRow(
            patient_id=str(p.id),
            patient_code=p.patient_code,
            display_name=p.display_name or p.patient_code,
            N=s.N,
            M=s.M,
            coverage_rate=s.coverage_rate,
            missing_count=len(s.missing_slots),
        ))

    # 紧急排序：缺失多在前；无计划（N=0）垫底
    rows.sort(key=lambda r: (r.missing_count, r.patient_code), reverse=True)
    rows.sort(key=lambda r: r.N == 0)  # 稳定排序：N=0 的排后面

    coverage = round(total_M / total_N * 100, 1) if total_N > 0 else None
    return OverviewResponse(
        from_=from_, to=to, timezone="Asia/Shanghai",
        patient_count=len(patients), planned_count=planned_count,
        total_N=total_N, total_M=total_M, coverage_rate=coverage,
        rows=rows,
    )
