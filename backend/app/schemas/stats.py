"""统计 Schema（J031）。"""
from datetime import datetime

from pydantic import BaseModel


class MissingSlot(BaseModel):
    slot_id: str
    scheduled_at: datetime


class StatsResponse(BaseModel):
    from_: str
    to: str
    timezone: str
    N: int
    M: int
    coverage_rate: float | None
    missing_slots: list[MissingSlot]
    source_breakdown: dict[str, int]
    source_breakdown_basis: str = "ACTIVE_EVENT_COUNTS"
    disclaimer: str = "基于登记记录的覆盖率，不等于实际服药依从性"
