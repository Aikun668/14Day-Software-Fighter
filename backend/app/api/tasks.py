"""待核查任务 API（J035）。"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.auth.access_policy import require_clinician
from app.core.database import get_db
from app.models import Patient, Task, User
from app.schemas.common import Page

router = APIRouter(prefix="/api", tags=["tasks"])


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    task_type: str
    status: str
    assigned_to: uuid.UUID | None
    due_at: datetime | None
    closed_at: datetime | None
    created_at: datetime


class TaskPatch(BaseModel):
    status: str  # 仅允许 IN_PROGRESS


@router.get("/tasks", response_model=Page[TaskOut])
def list_tasks(
    status_filter: str | None = Query(None, alias="status"),
    patient_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_clinician),
    db: Session = Depends(get_db),
):
    """只读取已物化任务，无写入副作用。"""
    # 只返回本医护负责患者的任务
    q = (
        db.query(Task)
        .join(Patient, Task.patient_id == Patient.id)
        .filter(Patient.assigned_clinician_id == user.id)
    )
    if status_filter:
        q = q.filter(Task.status == status_filter)
    if patient_id:
        q = q.filter(Task.patient_id == patient_id)
    total = q.count()
    items = q.order_by(Task.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Page[TaskOut](
        items=[TaskOut.model_validate(t) for t in items],
        total=total, page=page, page_size=page_size,
    )


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def patch_task(
    task_id: uuid.UUID,
    body: TaskPatch,
    user: User = Depends(require_clinician),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "任务不存在", "details": None})
    # 归属校验
    patient = db.query(Patient).filter(Patient.id == task.patient_id).first()
    if patient is None or patient.assigned_clinician_id != user.id:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "资源不可访问", "details": None})
    if task.status == "CLOSED":
        raise HTTPException(status_code=409, detail={"code": "ALREADY_CLOSED", "message": "任务已关闭，不可重开", "details": None})
    if body.status != "IN_PROGRESS":
        raise HTTPException(status_code=422, detail={"code": "INVALID_STATUS", "message": "本版仅允许转 IN_PROGRESS；关闭请走随访", "details": None})
    task.status = "IN_PROGRESS"
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)
