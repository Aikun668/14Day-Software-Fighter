"""计划服务与计划时点生成（J027）。

核心：REGULAR 计划按 plan.timezone 生成 planned_slots（幂等）；
PRN 不生成时点。时点存 UTC，业务日期按计划时区计算。
"""
import uuid
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models import MedicationPlan, PlanDailyTime, PlannedSlot


def ensure_slots(
    db: Session,
    plan: MedicationPlan,
    local_date_from: datetime,
    local_date_to: datetime,
) -> list[PlannedSlot]:
    """为 REGULAR 计划幂等生成 [local_date_from, local_date_to) 区间的时点。

    - 逐日、逐 enabled 每日时点组合，转 UTC 存库。
    - 只生成落在计划有效期 [starts_at, ends_at) 内的时点。
    - 依赖 UNIQUE(plan_id, scheduled_at) 冲突忽略，保证幂等。
    """
    if plan.plan_type != "REGULAR":
        return []

    tz = ZoneInfo(plan.timezone)
    daily_times = (
        db.query(PlanDailyTime)
        .filter(PlanDailyTime.plan_id == plan.id, PlanDailyTime.is_enabled.is_(True))
        .all()
    )
    if not daily_times:
        return []

    created: list[PlannedSlot] = []
    day = local_date_from.date()
    end_day = local_date_to.date()
    starts = plan.starts_at
    if starts.tzinfo is None:
        starts = starts.replace(tzinfo=ZoneInfo("UTC"))
    ends = plan.ends_at
    if ends is not None and ends.tzinfo is None:
        ends = ends.replace(tzinfo=ZoneInfo("UTC"))

    while day < end_day:
        for dt in daily_times:
            local_dt = datetime.combine(day, dt.local_time, tzinfo=tz)
            scheduled_utc = local_dt.astimezone(ZoneInfo("UTC"))
            # 有效期边界：左闭右开 [starts_at, ends_at)
            if scheduled_utc < starts:
                continue
            if ends is not None and scheduled_utc >= ends:
                continue
            # 幂等：已存在则跳过
            exists = (
                db.query(PlannedSlot)
                .filter(PlannedSlot.plan_id == plan.id, PlannedSlot.scheduled_at == scheduled_utc)
                .first()
            )
            if exists is None:
                slot = PlannedSlot(
                    plan_id=plan.id,
                    patient_id=plan.patient_id,
                    scheduled_at=scheduled_utc,
                    state="ACTIVE",
                )
                db.add(slot)
                db.flush()
                created.append(slot)
        day += timedelta(days=1)
    return created
