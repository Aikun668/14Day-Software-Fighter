"""统计服务与 API（J031）。

严格按 TECH_DESIGN §4.3.2 口径：
N = 窗口内已到期、有效 REGULAR 时点数
M = 其中存在 ACTIVE 登记的不同 slot_id 数
coverage_rate = ROUND(M/N*100, 1)（N=0 时 null）
source_breakdown = 有效登记事件按来源计数（非去重时点数、不含撤销）
"""
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.access_policy import get_patient_for_clinician
from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models import MedicationEvent, Patient, PlannedSlot, User
from app.schemas.stats import (
    MatrixResponse,
    MissingSlot,
    OverviewResponse,
    PatientCoverageRow,
    StatsResponse,
    TrendPoint,
    TrendResponse,
)
from app.services.stats_matrix import build_coverage_matrix

router = APIRouter(prefix="/api", tags=["stats"])

TZ_NAME = "Asia/Shanghai"
MAX_RANGE_DAYS = 92  # 趋势与覆盖矩阵共用的区间上限


def _parse_window(from_date: str, to_date: str) -> tuple[datetime, datetime]:
    """解析并校验统计区间（左闭右开，按业务时区换算成 UTC）。"""
    tz = ZoneInfo(TZ_NAME)
    try:
        date_from = datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=tz)
        date_to = datetime.strptime(to_date, "%Y-%m-%d").replace(tzinfo=tz)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_RANGE", "message": "日期格式应为 YYYY-MM-DD", "details": None},
        )
    if date_to <= date_from:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_RANGE", "message": "结束日期必须晚于开始日期", "details": None},
        )
    return date_from.astimezone(ZoneInfo("UTC")), date_to.astimezone(ZoneInfo("UTC"))


def _window_days(from_date: str, to_date: str, max_days: int = MAX_RANGE_DAYS) -> list[date]:
    """区间内的业务日列表（左闭右开）；超过上限返回 422 RANGE_TOO_LARGE（先判跨度，再建列表）。"""
    from_utc, to_utc = _parse_window(from_date, to_date)
    tz = ZoneInfo(TZ_NAME)
    start_day = from_utc.astimezone(tz).date()
    end_day = to_utc.astimezone(tz).date()
    span = (end_day - start_day).days
    if span > max_days:
        raise HTTPException(
            status_code=422,
            detail={"code": "RANGE_TOO_LARGE", "message": f"区间最多 {max_days} 天", "details": None},
        )
    return [start_day + timedelta(days=i) for i in range(span)]


def _assigned_patients(db: Session, user: User) -> list[Patient]:
    """医护负责的患者，按编号排序。"""
    return (
        db.query(Patient)
        .filter(Patient.assigned_clinician_id == user.id)
        .order_by(Patient.patient_code)
        .all()
    )


def _load_slots(db: Session, patient_ids: list[uuid.UUID], from_utc: datetime, to_utc: datetime) -> list[PlannedSlot]:
    """窗口内「已到期、有效 REGULAR」的时点（分母集合 S）。"""
    if not patient_ids:
        return []
    now = datetime.now(timezone.utc)
    return (
        db.query(PlannedSlot)
        .filter(
            PlannedSlot.patient_id.in_(patient_ids),
            PlannedSlot.state == "ACTIVE",
            PlannedSlot.scheduled_at >= from_utc,
            PlannedSlot.scheduled_at < to_utc,
            PlannedSlot.scheduled_at <= now,  # 已到期
        )
        .order_by(PlannedSlot.scheduled_at)
        .all()
    )


def _load_events(db: Session, slot_ids: set[uuid.UUID]) -> list[MedicationEvent]:
    """分母集合上的 ACTIVE 登记（分子与来源分布都从这里取）。"""
    if not slot_ids:
        return []
    return (
        db.query(MedicationEvent)
        .filter(
            MedicationEvent.status == "ACTIVE",
            MedicationEvent.slot_id.in_(slot_ids),
        )
        .all()
    )


def _compute_stats(db: Session, patient_id: uuid.UUID, from_date: str, to_date: str, tz_name: str = TZ_NAME) -> StatsResponse:
    from_utc, to_utc = _parse_window(from_date, to_date)

    slots = _load_slots(db, [patient_id], from_utc, to_utc)
    slot_ids = {s.id for s in slots}
    N = len(slot_ids)

    active_events = _load_events(db, slot_ids)
    covered_slots = {e.slot_id for e in active_events if e.slot_id is not None}
    M = len(covered_slots)

    coverage_rate = round(M / N * 100, 1) if N > 0 else None

    missing_slots = [
        MissingSlot(slot_id=str(s.id), scheduled_at=s.scheduled_at)
        for s in slots
        if s.id not in covered_slots
    ]

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


@router.get("/patients/{patient_id}/stats/trend", response_model=TrendResponse)
def get_patient_trend(
    patient_id: uuid.UUID,
    from_: str = Query(..., alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    patient: Patient = Depends(get_patient_for_clinician),
    db: Session = Depends(get_db),
):
    """逐日覆盖率趋势：一次查询覆盖整个区间，按业务时区按天分组。

    比「前端按天并发调 N 次 /patients/{id}/stats」少 N 倍请求与查询。
    N=0 的日子返回 rate=null（无计划时点，不是 0%）。
    """
    from_utc, to_utc = _parse_window(from_, to)
    days = _window_days(from_, to)

    slots = _load_slots(db, [patient_id], from_utc, to_utc)
    active_events = _load_events(db, {s.id for s in slots})
    covered = {e.slot_id for e in active_events if e.slot_id is not None}

    tz = ZoneInfo(TZ_NAME)
    per_day_n: dict[date, int] = defaultdict(int)
    per_day_m: dict[date, int] = defaultdict(int)
    for s in slots:
        day = s.scheduled_at.astimezone(tz).date()
        per_day_n[day] += 1
        if s.id in covered:
            per_day_m[day] += 1

    points = []
    for day in days:
        n = per_day_n.get(day, 0)
        m = per_day_m.get(day, 0)
        points.append(TrendPoint(
            day=day.isoformat(),
            N=n,
            M=m,
            coverage_rate=round(m / n * 100, 1) if n > 0 else None,
        ))

    return TrendResponse(
        from_=from_, to=to, timezone=TZ_NAME,
        points=points,
        disclaimer="基于登记记录的覆盖率，不等于实际服药依从性",
    )


@router.get("/stats/overview", response_model=OverviewResponse)
def get_overview(
    from_: str = Query(..., alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """医护工作台概览：聚合负责患者的覆盖率，按缺失数降序（紧急在前）。

    权限：仅 CLINICIAN。管理员按 PRD 不继承患者临床数据访问权，直接 403
    （此前放行 ADMIN 但按归属过滤，只会返回 200 + 空列表，容易被误当成「无数据」）。
    """
    if user.role != "CLINICIAN":
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "仅医护可访问", "details": None})

    from_utc, to_utc = _parse_window(from_, to)

    patients = _assigned_patients(db, user)

    # 两次查询覆盖全部负责患者，避免「每个患者各查 2 次」的 N+1
    patient_ids = [p.id for p in patients]
    slots = _load_slots(db, patient_ids, from_utc, to_utc)
    active_events = _load_events(db, {s.id for s in slots})
    covered = {e.slot_id for e in active_events if e.slot_id is not None}

    per_patient_n: dict[uuid.UUID, int] = defaultdict(int)
    per_patient_m: dict[uuid.UUID, int] = defaultdict(int)
    per_patient_missing: dict[uuid.UUID, int] = defaultdict(int)
    for s in slots:
        per_patient_n[s.patient_id] += 1
        if s.id in covered:
            per_patient_m[s.patient_id] += 1
        else:
            per_patient_missing[s.patient_id] += 1

    rows: list[PatientCoverageRow] = []
    total_N = 0
    total_M = 0
    planned_count = 0
    for p in patients:
        n = per_patient_n.get(p.id, 0)
        m = per_patient_m.get(p.id, 0)
        if n > 0:
            planned_count += 1
            total_N += n
            total_M += m
        rows.append(PatientCoverageRow(
            patient_id=str(p.id),
            patient_code=p.patient_code,
            display_name=p.display_name or p.patient_code,
            N=n,
            M=m,
            coverage_rate=round(m / n * 100, 1) if n > 0 else None,
            missing_count=per_patient_missing.get(p.id, 0),
        ))

    # 紧急排序：缺失多在前；无计划（N=0）垫底；同缺失数按编号正序
    rows.sort(key=lambda r: (r.N == 0, -r.missing_count, r.patient_code))

    coverage = round(total_M / total_N * 100, 1) if total_N > 0 else None
    return OverviewResponse(
        from_=from_, to=to, timezone=TZ_NAME,
        patient_count=len(patients), planned_count=planned_count,
        total_N=total_N, total_M=total_M, coverage_rate=coverage,
        rows=rows,
    )


@router.get("/stats/matrix", response_model=MatrixResponse)
def get_coverage_matrix(
    from_: str = Query(..., alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """负责患者 × 日期的覆盖矩阵（03 A-1）。

    权限：仅 CLINICIAN（与 overview 一致）。口径与 overview 相同：只统计已到期时点，
    未到期日期的格子 N=0、coverage_rate=null（显示为空白，不是 0%）。
    """
    if user.role != "CLINICIAN":
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "仅医护可访问", "details": None})

    from_utc, to_utc = _parse_window(from_, to)
    days = _window_days(from_, to)

    patients = _assigned_patients(db, user)
    slots = _load_slots(db, [p.id for p in patients], from_utc, to_utc)
    active_events = _load_events(db, {s.id for s in slots})
    covered = {e.slot_id for e in active_events if e.slot_id is not None}

    return build_coverage_matrix(
        from_str=from_,
        to_str=to,
        patients=patients,
        slots=slots,
        covered_slot_ids=covered,
        days=days,
        tz_name=TZ_NAME,
    )
