"""用药登记 Schema（J029）。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MedicationEventCreate(BaseModel):
    patient_id: uuid.UUID | None = None  # 医护登记时用；患者留空（服务端取）
    plan_id: uuid.UUID
    slot_id: uuid.UUID | None = None  # REGULAR 必填，PRN 必须 null
    occurred_at: datetime
    source: str | None = None  # 服务端重写
    note: str | None = None


class MedicationEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    plan_id: uuid.UUID
    slot_id: uuid.UUID | None
    source: str
    occurred_at: datetime
    recorded_at: datetime
    status: str
    note: str | None
    revoked_at: datetime | None


class MedicationEventCreateResp(BaseModel):
    event: MedicationEventOut
    is_duplicate: bool


class RevokeRequest(BaseModel):
    reason: str
