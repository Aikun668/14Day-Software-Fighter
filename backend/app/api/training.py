"""训练自检 API（J022）。"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.access_policy import get_patient_for_clinician
from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models import Patient, TrainingSession, TrainingStepResult, User
from app.schemas.common import Page
from app.schemas.training import (
    TrainingSessionCreate,
    TrainingSessionOut,
    TrainingStepOut,
)

router = APIRouter(prefix="/api", tags=["training"])


def _build_out(session: TrainingSession, db: Session) -> TrainingSessionOut:
    steps = (
        db.query(TrainingStepResult)
        .filter(TrainingStepResult.session_id == session.id)
        .order_by(TrainingStepResult.id)
        .all()
    )
    out = TrainingSessionOut.model_validate(session)
    out.step_results = [TrainingStepOut.model_validate(s) for s in steps]
    return out


@router.post("/training-sessions", response_model=TrainingSessionOut, status_code=status.HTTP_201_CREATED)
def create_training_session(
    body: TrainingSessionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # source 服务端固定：患者=PATIENT_REPORT，医护=CLINICIAN_OBSERVED
    if user.role == "PATIENT":
        source = "PATIENT_REPORT"
        patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
        if patient is None:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "未绑定患者档案", "details": None})
        evaluator_id = None
    elif user.role in ("CLINICIAN", "ADMIN"):
        source = "CLINICIAN_OBSERVED"
        if body.patient_id is None:
            raise HTTPException(status_code=422, detail={"code": "PATIENT_REQUIRED", "message": "医护评估须指定患者", "details": None})
        patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
        if patient is None:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "患者不存在", "details": None})
        # 归属校验
        if user.role == "CLINICIAN" and patient.assigned_clinician_id != user.id:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "资源不可访问", "details": None})
        evaluator_id = user.id
    else:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "无权操作", "details": None})

    # 拒绝客户端伪造 DEVICE
    if body.source == "DEVICE":
        raise HTTPException(status_code=422, detail={"code": "INVALID_SOURCE", "message": "不支持设备来源", "details": None})

    # 校验 guide 存在且属于该 device_model，且 step_id 属于该 guide（避免外键 500）
    from app.models import DeviceGuide, GuideStep

    guide = db.query(DeviceGuide).filter(DeviceGuide.id == body.guide_id).first()
    if guide is None or guide.device_model_id != body.device_model_id:
        raise HTTPException(status_code=422, detail={"code": "GUIDE_MISMATCH", "message": "指导与型号不匹配", "details": None})
    valid_step_ids = {s.id for s in db.query(GuideStep).filter(GuideStep.guide_id == guide.id).all()}
    for sr in body.step_results:
        if sr.step_id not in valid_step_ids:
            raise HTTPException(status_code=422, detail={"code": "STEP_MISMATCH", "message": "步骤不属于该指导", "details": None})

    session = TrainingSession(
        patient_id=patient.id,
        device_model_id=body.device_model_id,
        guide_id=body.guide_id,
        source=source,
        result=body.result,
        evaluator_id=evaluator_id,
    )
    db.add(session)
    db.flush()
    for sr in body.step_results:
        db.add(
            TrainingStepResult(
                session_id=session.id,
                step_id=sr.step_id,
                check_state=sr.check_state,
                note=sr.note,
            )
        )
    db.commit()
    db.refresh(session)
    return _build_out(session, db)


@router.get("/me/training-sessions", response_model=Page[TrainingSessionOut])
def list_my_training_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "未绑定患者档案", "details": None})
    q = db.query(TrainingSession).filter(TrainingSession.patient_id == patient.id)
    total = q.count()
    items = q.order_by(TrainingSession.submit_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Page[TrainingSessionOut](
        items=[_build_out(s, db) for s in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/patients/{patient_id}/training-sessions", response_model=Page[TrainingSessionOut])
def list_patient_training_sessions(
    patient_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source: str | None = None,
    patient: Patient = Depends(get_patient_for_clinician),
    db: Session = Depends(get_db),
):
    q = db.query(TrainingSession).filter(TrainingSession.patient_id == patient_id)
    if source:
        q = q.filter(TrainingSession.source == source)
    total = q.count()
    items = q.order_by(TrainingSession.submit_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Page[TrainingSessionOut](
        items=[_build_out(s, db) for s in items],
        total=total,
        page=page,
        page_size=page_size,
    )
