"""随访 API（J037）。

POST /api/followups：保存随访、可选关闭任务、可选创建复训提醒，同事务提交。
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.access_policy import get_patient_for_clinician, require_clinician
from app.core.database import get_db
from app.models import Followup, Patient, PatientReminder, Task, User
from app.schemas.common import Page
from app.schemas.followup import FollowupCreate, FollowupOut
from app.services.audit_service import write_audit

router = APIRouter(prefix="/api", tags=["followups"])


@router.post("/followups", status_code=status.HTTP_201_CREATED)
def create_followup(
    body: FollowupCreate,
    user: User = Depends(require_clinician),
    db: Session = Depends(get_db),
):
    # 归属校验
    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "患者不存在", "details": None})
    if user.role == "CLINICIAN" and patient.assigned_clinician_id != user.id:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "资源不可访问", "details": None})

    try:
        # 1) 保存随访
        followup = Followup(
            patient_id=patient.id,
            task_id=body.task_id,
            clinician_id=user.id,
            followed_at=body.followed_at,
            feedback=body.feedback,
            action_taken=body.action_taken,
            next_plan=body.next_plan,
        )
        db.add(followup)
        db.flush()

        # 2) 可选关闭任务
        result_task = None
        if body.close_task and body.task_id is not None:
            task = db.query(Task).filter(Task.id == body.task_id).first()
            if task is None:
                raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "任务不存在", "details": None})
            if task.patient_id != patient.id:
                raise HTTPException(status_code=422, detail={"code": "TASK_MISMATCH", "message": "任务与患者不匹配", "details": None})
            if task.status == "CLOSED":
                raise HTTPException(status_code=409, detail={"code": "ALREADY_CLOSED", "message": "任务已关闭", "details": None})
            task.status = "CLOSED"
            task.closed_at = datetime.now(timezone.utc)
            result_task = task

        # 3) 可选创建复训提醒
        reminder = None
        if body.create_retraining_reminder:
            reminder = PatientReminder(
                patient_id=patient.id,
                kind="RETRAIN",
                title="请完成一次操作复训",
                status="PENDING",
                related_followup_id=followup.id,
                created_by=user.id,
            )
            db.add(reminder)

        write_audit(db, user.id, "FOLLOWUP_CREATE", "followup", followup.id, {"close_task": body.close_task})
        db.commit()
        db.refresh(followup)
        return {
            "followup": FollowupOut.model_validate(followup).model_dump(),
            "task": None if result_task is None else {"id": str(result_task.id), "status": result_task.status},
            "reminder": None if reminder is None else {"id": str(reminder.id), "kind": reminder.kind, "status": reminder.status},
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.get("/followups", response_model=Page[FollowupOut])
def list_my_followups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_clinician),
    db: Session = Depends(get_db),
):
    """当前医护负责患者的随访（工作台「近期随访」），按时间倒序。

    一次查询替代「先拉患者列表、再逐个患者请求随访」的 N+1 请求。
    仅 CLINICIAN：管理员按 PRD 不继承患者临床数据访问权（返回空列表会被误读为「没有随访」）。
    """
    if user.role != "CLINICIAN":
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "仅医护可访问", "details": None})
    q = (
        db.query(Followup)
        .join(Patient, Followup.patient_id == Patient.id)
        .filter(Patient.assigned_clinician_id == user.id)
    )
    total = q.count()
    items = q.order_by(Followup.followed_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Page[FollowupOut](
        items=[FollowupOut.model_validate(f) for f in items],
        total=total, page=page, page_size=page_size,
    )


@router.get("/patients/{patient_id}/followups", response_model=Page[FollowupOut])
def list_followups(
    patient_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    patient: Patient = Depends(get_patient_for_clinician),
    db: Session = Depends(get_db),
):
    q = db.query(Followup).filter(Followup.patient_id == patient_id)
    total = q.count()
    items = q.order_by(Followup.followed_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Page[FollowupOut](
        items=[FollowupOut.model_validate(f) for f in items],
        total=total, page=page, page_size=page_size,
    )
