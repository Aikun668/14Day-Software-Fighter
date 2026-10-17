"""待核查任务服务（J035）。

规则（TECH_DESIGN §4.4）：
- 触发：患者连续 3 个已到期固定计划时点无有效登记。
- 去重：trigger_key = SHA256(patient_id:task_type:newest_missing_slot_id) 唯一；
  同患者同类型已有 OPEN/IN_PROGRESS 不新建。
- 关闭后不因同一批旧缺失重建；新增缺失时点才产生新 trigger_key。
"""
import hashlib
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import MedicationEvent, MedicationPlan, Patient, PlannedSlot, Task

TASK_TYPE = "MISSED_MEDICATION"
CONSECUTIVE_THRESHOLD = 3


def _build_trigger_key(patient_id: uuid.UUID, task_type: str, newest_slot_id: uuid.UUID) -> str:
    raw = f"{patient_id}:{task_type}:{newest_slot_id}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _missing_slots_ordered(db: Session, patient_id: uuid.UUID, now: datetime) -> list[PlannedSlot]:
    """按 scheduled_at 升序返回已到期、无有效登记的固定时点。"""
    # 已到期 ACTIVE REGULAR 时点
    slots = (
        db.query(PlannedSlot)
        .join(MedicationPlan, PlannedSlot.plan_id == MedicationPlan.id)
        .filter(
            PlannedSlot.patient_id == patient_id,
            PlannedSlot.state == "ACTIVE",
            PlannedSlot.scheduled_at <= now,
            MedicationPlan.plan_type == "REGULAR",
        )
        .order_by(PlannedSlot.scheduled_at, PlannedSlot.id)
        .all()
    )
    # 有 ACTIVE 登记的 slot 集合
    slot_ids = [s.id for s in slots]
    if not slot_ids:
        return []
    covered = {
        row[0]
        for row in db.query(MedicationEvent.slot_id)
        .filter(
            MedicationEvent.slot_id.in_(slot_ids),
            MedicationEvent.status == "ACTIVE",
        )
        .all()
    }
    return [s for s in slots if s.id not in covered]


def _consecutive_tail_missing(missing: list[PlannedSlot]) -> list[PlannedSlot]:
    """返回按时间排序后末尾的连续缺失段（从后往前，遇到已登记即停）。

    由于 missing 已剔除有登记的时点，这里按 scheduled_at 判断是否连续：
    以最后一个缺失时点为锚，向前找"时间上连续"（相邻时点间隔不超过合理窗口）的缺失。
    简化实现（与 PRD 口径一致）：只要缺失时点数量 >= 3，取最后 3 个作为触发段。
    """
    if len(missing) < CONSECUTIVE_THRESHOLD:
        return []
    # 取末尾连续段：从最后一个开始向前，遇到间隔异常则截断
    tail = [missing[-1]]
    for i in range(len(missing) - 2, -1, -1):
        prev, cur = missing[i], tail[0]
        gap = (cur.scheduled_at - prev.scheduled_at).total_seconds()
        # 相邻时点间隔不超过 36 小时视为连续（覆盖每日 1-2 次计划）
        if gap <= 36 * 3600:
            tail.insert(0, prev)
        else:
            break
    return tail if len(tail) >= CONSECUTIVE_THRESHOLD else []


def reconcile_due_slots(db: Session, now: datetime | None = None) -> dict:
    """扫描所有患者，按规则物化待核查任务（幂等）。"""
    now = now or datetime.now(timezone.utc)
    created = 0
    patients = db.query(Patient).all()
    for patient in patients:
        missing = _missing_slots_ordered(db, patient.id, now)
        segment = _consecutive_tail_missing(missing)
        if not segment:
            continue
        newest_slot = segment[-1]
        trigger_key = _build_trigger_key(patient.id, TASK_TYPE, newest_slot.id)

        # 已有同类未关闭任务 → 不新建
        open_task = (
            db.query(Task)
            .filter(
                Task.patient_id == patient.id,
                Task.task_type == TASK_TYPE,
                Task.status.in_(["OPEN", "IN_PROGRESS"]),
            )
            .first()
        )
        if open_task is not None:
            continue
        # trigger_key 已存在（历史处理过）→ 不重建
        if db.query(Task).filter(Task.trigger_key == trigger_key).first() is not None:
            continue

        db.add(
            Task(
                patient_id=patient.id,
                task_type=TASK_TYPE,
                trigger_key=trigger_key,
                status="OPEN",
                assigned_to=patient.assigned_clinician_id,
            )
        )
        created += 1
    db.commit()
    return {"scanned_patients": len(patients), "tasks_created": created}
