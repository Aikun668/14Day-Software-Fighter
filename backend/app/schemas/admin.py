"""管理员相关 Schema（J011/J015）。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CreateUserRequest(BaseModel):
    account: str = Field(min_length=2, max_length=80)
    initial_password: str | None = Field(default=None, min_length=8)
    role: str = "CLINICIAN"  # 仅允许 CLINICIAN/ADMIN，默认 CLINICIAN


class CreateUserResponse(BaseModel):
    id: uuid.UUID
    account: str
    role: str
    status: str
    must_change_password: bool
    temporary_password: str | None = None


class PatchUserRequest(BaseModel):
    status: str  # ACTIVE / DISABLED


class PatientAssignment(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    patient_id: uuid.UUID
    patient_code: str
    assigned_clinician_id: uuid.UUID | None


class AssignPatientRequest(BaseModel):
    assigned_clinician_id: uuid.UUID


class CreatePatientRequest(BaseModel):
    patient_code: str = Field(min_length=1, max_length=40)
    display_name: str = Field(min_length=1, max_length=80)
    diagnosis_label: str | None = None
    note: str | None = None


class PatchPatientRequest(BaseModel):
    display_name: str | None = None
    diagnosis_label: str | None = None
    note: str | None = None
