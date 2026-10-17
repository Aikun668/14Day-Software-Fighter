"""统一模型导入（J004）。

Alembic autogenerate 依赖此模块导入所有 ORM 模型。
"""
from app.models.user import AuthSession, User
from app.models.patient import Patient, PatientDevice
from app.models.device import DeviceGuide, DeviceModel, GuideStep
from app.models.medication import (
    MedicationEvent,
    MedicationPlan,
    PlanDailyTime,
    PlannedSlot,
)
from app.models.training import TrainingSession, TrainingStepResult
from app.models.task import Followup, PatientReminder, Task
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument
from app.models.audit import AuditLog

__all__ = [
    "User",
    "AuthSession",
    "Patient",
    "PatientDevice",
    "DeviceModel",
    "DeviceGuide",
    "GuideStep",
    "MedicationPlan",
    "PlanDailyTime",
    "PlannedSlot",
    "MedicationEvent",
    "TrainingSession",
    "TrainingStepResult",
    "Task",
    "Followup",
    "PatientReminder",
    "KnowledgeDocument",
    "KnowledgeChunk",
    "AuditLog",
]
