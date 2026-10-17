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


class PatientCoverageRow(BaseModel):
    """工作台概览：单个患者的覆盖率行（按缺失数降序 = 紧急程度）。"""
    patient_id: str
    patient_code: str
    display_name: str
    N: int
    M: int
    coverage_rate: float | None
    missing_count: int


class OverviewResponse(BaseModel):
    """医护工作台概览：负责患者的聚合统计（PRD STAT-01 的聚合视图）。"""
    from_: str
    to: str
    timezone: str
    patient_count: int          # 负责患者总数
    planned_count: int          # 其中有固定计划在统计窗口内产生时点的人数
    total_N: int                # 聚合应记录时点
    total_M: int                # 聚合有效已登记时点
    coverage_rate: float | None # 聚合覆盖率 = total_M / total_N
    rows: list[PatientCoverageRow]  # 按缺失数降序（紧急在前）
    disclaimer: str = "基于登记记录的覆盖率，不等于实际服药依从性"
