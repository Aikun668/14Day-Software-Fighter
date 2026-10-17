"""用药计划、时点、登记（medication_plans / plan_daily_times / planned_slots / medication_events）。"""
import uuid
from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MedicationPlan(Base):
    __tablename__ = "medication_plans"
    __table_args__ = (
        UniqueConstraint("plan_group_id", "version", name="uq_plan_group_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), nullable=False)
    device_model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("device_models.id"), nullable=False
    )
    plan_group_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    drug_label: Mapped[str] = mapped_column(String(160), nullable=False)
    plan_type: Mapped[str] = mapped_column(String(20), nullable=False)  # REGULAR/PRN
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Shanghai")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class PlanDailyTime(Base):
    __tablename__ = "plan_daily_times"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medication_plans.id"), nullable=False)
    local_time: Mapped[time] = mapped_column(Time, nullable=False)
    label: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class PlannedSlot(Base):
    __tablename__ = "planned_slots"
    __table_args__ = (
        UniqueConstraint("plan_id", "scheduled_at", name="uq_plan_slot_scheduled"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medication_plans.id"), nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")  # ACTIVE/CANCELLED
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MedicationEvent(Base):
    __tablename__ = "medication_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medication_plans.id"), nullable=False)
    slot_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("planned_slots.id"), nullable=True
    )  # PRN 为 NULL
    source: Mapped[str] = mapped_column(String(30), nullable=False)  # PATIENT_REPORT/CLINICIAN_OBSERVED
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")  # ACTIVE/REVOKED
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    revoked_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoke_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
