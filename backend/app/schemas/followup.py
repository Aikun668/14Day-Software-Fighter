"""随访与患者提醒 Schema（J037）。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FollowupCreate(BaseModel):
    patient_id: uuid.UUID
    task_id: uuid.UUID | None = None
    followed_at: datetime
    feedback: str | None = None
    action_taken: str | None = None
    next_plan: str | None = None
    close_task: bool = False
    create_retraining_reminder: bool = False


class FollowupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    task_id: uuid.UUID | None
    clinician_id: uuid.UUID
    followed_at: datetime
    feedback: str | None
    action_taken: str | None
    next_plan: str | None
    created_at: datetime


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    title: str
    due_at: datetime | None
    status: str
    source_type: str
    related_id: uuid.UUID | None = None
