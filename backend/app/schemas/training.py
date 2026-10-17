"""训练自检 Schema（J022）。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TrainingStepIn(BaseModel):
    step_id: uuid.UUID
    check_state: str = Field(pattern="^(DONE|DIFFICULT|NOT_DONE)$")
    note: str | None = None


class TrainingSessionCreate(BaseModel):
    patient_id: uuid.UUID | None = None  # 医护观察时用；患者自检留空（服务端从 token 取）
    device_model_id: uuid.UUID
    guide_id: uuid.UUID
    result: str | None = None
    step_results: list[TrainingStepIn]
    source: str | None = None  # 服务端重写，不信任客户端


class TrainingStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    step_id: uuid.UUID
    check_state: str
    note: str | None


class TrainingSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    device_model_id: uuid.UUID
    guide_id: uuid.UUID
    source: str
    submit_at: datetime
    result: str | None
    evaluator_id: uuid.UUID | None
    step_results: list[TrainingStepOut] = []
