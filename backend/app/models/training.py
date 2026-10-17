"""训练自检（training_sessions / training_step_results）。"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), nullable=False)
    device_model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("device_models.id"), nullable=False
    )
    guide_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("device_guides.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False)  # PATIENT_REPORT/CLINICIAN_OBSERVED
    submit_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    result: Mapped[str | None] = mapped_column(String(40), nullable=True)
    evaluator_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class TrainingStepResult(Base):
    __tablename__ = "training_step_results"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("training_sessions.id"), nullable=False
    )
    step_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("guide_steps.id"), nullable=False)
    check_state: Mapped[str] = mapped_column(String(20), nullable=False)  # DONE/DIFFICULT/NOT_DONE
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
