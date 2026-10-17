"""患者档案 Schema（J015）。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PatientBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_code: str
    display_name: str
    diagnosis_label: str | None
    assigned_clinician_id: uuid.UUID | None
    account_user_id: uuid.UUID | None


class PatientDetail(PatientBrief):
    note: str | None = None


class DeviceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_model_id: uuid.UUID
    effective_from: datetime
    effective_to: datetime | None


class PatientWithDevices(PatientDetail):
    current_devices: list[DeviceSummary] = []


class CreatePatientAccountRequest(BaseModel):
    account: str
    initial_password: str | None = None


class PatientAccountResponse(BaseModel):
    patient_id: uuid.UUID
    user: "object"  # 由 UserBrief 填充，此处占位
    temporary_password: str | None = None


class BindDeviceRequest(BaseModel):
    device_model_id: uuid.UUID
    effective_from: datetime
