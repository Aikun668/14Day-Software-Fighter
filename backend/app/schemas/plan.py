"""用药计划 Schema（J027）。"""
import uuid
from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field


class DailyTimeIn(BaseModel):
    local_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    label: str | None = None


class PlanCreate(BaseModel):
    device_model_id: uuid.UUID
    drug_label: str
    plan_type: str = Field(pattern="^(REGULAR|PRN)$")
    timezone: str = "Asia/Shanghai"
    starts_at: datetime
    ends_at: datetime | None = None
    daily_times: list[DailyTimeIn] = []


class PlanRevision(BaseModel):
    starts_at: datetime
    ends_at: datetime | None = None
    drug_label: str | None = None
    device_model_id: uuid.UUID | None = None
    daily_times: list[DailyTimeIn] | None = None


class DailyTimeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    local_time: time
    label: str | None
    is_enabled: bool


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    device_model_id: uuid.UUID
    plan_group_id: uuid.UUID
    version: int
    drug_label: str
    plan_type: str
    timezone: str
    starts_at: datetime
    ends_at: datetime | None
    daily_times: list[DailyTimeOut] = []


class PlannedSlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    plan_id: uuid.UUID
    patient_id: uuid.UUID
    scheduled_at: datetime
    state: str
    has_active_record: bool = False
