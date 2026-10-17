"""装置与指导 Schema（J019）。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeviceModelBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: str
    brand: str
    model_name: str
    manufacturer: str | None
    status: str


class DeviceModelCreate(BaseModel):
    category: str = Field(pattern="^(pMDI|DPI|SMI)$")
    brand: str
    model_name: str
    manufacturer: str | None = None


class GuideStepIn(BaseModel):
    step_no: int
    text: str
    error_notes: str | None = None
    image_path: str | None = None


class GuideStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    step_no: int
    text: str
    error_notes: str | None
    image_path: str | None


class GuideCreate(BaseModel):
    device_model_id: uuid.UUID
    version: str
    title: str
    source_title: str | None = None
    source_url: str | None = None
    steps: list[GuideStepIn]


class GuidePatch(BaseModel):
    title: str | None = None
    source_title: str | None = None
    source_url: str | None = None
    steps: list[GuideStepIn] | None = None
    review_action: str | None = None  # APPROVE


class GuideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_model_id: uuid.UUID
    version: str
    title: str
    source_title: str | None
    source_url: str | None
    review_status: str
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    published_by: uuid.UUID | None
    published_at: datetime | None
    steps: list[GuideStepOut] = []
