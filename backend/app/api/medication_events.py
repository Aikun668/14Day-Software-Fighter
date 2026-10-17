"""用药登记与撤销 API（J029）。"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.access_policy import get_patient_for_clinician
from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models import (
    MedicationEvent,
    MedicationPlan,
    Patient,
    PlannedSlot,
    User,
)
from app.schemas.common import Page
from app.schemas.medication import (
    MedicationEventCreate,
    MedicationEventCreateResp,
    MedicationEventOut,
    RevokeRequest,
)
from app.services.audit_service import write_audit

router = APIRouter(prefix="/api", tags=["medication"])


@router.post("/medication-events", response_model=MedicationEventCreateResp, status_code=status.HTTP_201_CREATED)
def create_event(
    body: MedicationEventCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 确定 patient + source
    if user.role == "PATIENT":
        patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
        if patient is None:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "未绑定患者档案", "details": None})
        source = "PATIENT_REPORT"
    elif user.role in ("CLINICIAN", "ADMIN"):
        if body.patient_id is None:
            raise HTTPException(status_code=422, detail={"code": "PATIENT_REQUIRED", "message": "医护登记须指定患者", "details": None})
        patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
        if patient is None:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "患者不存在", "details": None})
        if user.role == "CLINICIAN" and patient.assigned_clinician_id != user.id:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "资源不可访问", "details": None})
        source = "CLINICIAN_OBSERVED"
    else:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "无权操作", "details": None})

    if body.source == "DEVICE":
        raise HTTPException(status_code=422, detail={"code": "INVALID_SOURCE", "message": "不支持设备来源", "details": None})

    # 校验计划归属
    plan = db.query(MedicationPlan).filter(MedicationPlan.id == body.plan_id).first()
    if plan is None or plan.patient_id != patient.id:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "计划不存在或不属于该患者", "details": None})

    # REGULAR 必须有 slot；PRN 必须 null
    if plan.plan_type == "REGULAR":
        if body.slot_id is None:
            raise HTTPException(status_code=422, detail={"code": "SLOT_REQUIRED", "message": "固定计划须关联时点", "details": None})
        slot = db.query(PlannedSlot).filter(PlannedSlot.id == body.slot_id).first()
        if slot is None or slot.plan_id != plan.id or slot.patient_id != patient.id:
            raise HTTPException(status_code=422, detail={"code": "SLOT_MISMATCH", "message": "时点与计划/患者不一致", "details": None})
    else:  # PRN
        if body.slot_id is not None:
            raise HTTPException(status_code=422, detail={"code": "PRN_NO_SLOT", "message": "按需登记不能关联时点", "details": None})

    # 重复判定：同 slot 已有 ACTIVE 记录
    is_duplicate = False
    if body.slot_id is not None:
        dup = (
            db.query(MedicationEvent)
            .filter(
                MedicationEvent.slot_id == body.slot_id,
                MedicationEvent.status == "ACTIVE",
            )
            .first()
        )
        is_duplicate = dup is not None

    event = MedicationEvent(
        patient_id=patient.id,
        plan_id=plan.id,
        slot_id=body.slot_id,
        source=source,
        occurred_at=body.occurred_at,
        recorded_at=datetime.now(timezone.utc),
        status="ACTIVE",
        note=body.note,
    )
    db.add(event)
    db.flush()
    write_audit(db, user.id, "MEDICATION_RECORD", "medication_event", event.id, {"source": source})
    db.commit()
    db.refresh(event)
    return MedicationEventCreateResp(event=MedicationEventOut.model_validate(event), is_duplicate=is_duplicate)


@router.get("/me/medication-events", response_model=Page[MedicationEventOut])
def list_my_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "未绑定患者档案", "details": None})
    q = db.query(MedicationEvent).filter(MedicationEvent.patient_id == patient.id)
    total = q.count()
    items = q.order_by(MedicationEvent.recorded_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Page[MedicationEventOut](
        items=[MedicationEventOut.model_validate(e) for e in items],
        total=total, page=page, page_size=page_size,
    )


@router.get("/patients/{patient_id}/medication-events", response_model=Page[MedicationEventOut])
def list_patient_events(
    patient_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    patient: Patient = Depends(get_patient_for_clinician),
    db: Session = Depends(get_db),
):
    q = db.query(MedicationEvent).filter(MedicationEvent.patient_id == patient_id)
    if status_filter:
        q = q.filter(MedicationEvent.status == status_filter)
    total = q.count()
    items = q.order_by(MedicationEvent.recorded_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Page[MedicationEventOut](
        items=[MedicationEventOut.model_validate(e) for e in items],
        total=total, page=page, page_size=page_size,
    )


@router.post("/medication-events/{event_id}/revoke", response_model=MedicationEventOut)
def revoke_event(
    event_id: uuid.UUID,
    body: RevokeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(MedicationEvent).filter(MedicationEvent.id == event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "记录不存在", "details": None})
    if event.status == "REVOKED":
        raise HTTPException(status_code=409, detail={"code": "ALREADY_REVOKED", "message": "记录已撤销", "details": None})
    # 权限：记录所属患者或所属医护
    if user.role == "PATIENT":
        patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
        if patient is None or patient.id != event.patient_id:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "资源不可访问", "details": None})
    elif user.role == "CLINICIAN":
        patient = db.query(Patient).filter(Patient.id == event.patient_id).first()
        if patient is None or patient.assigned_clinician_id != user.id:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "资源不可访问", "details": None})

    event.status = "REVOKED"
    event.revoked_by = user.id
    event.revoked_at = datetime.now(timezone.utc)
    event.revoke_reason = body.reason
    write_audit(db, user.id, "MEDICATION_REVOKE", "medication_event", event.id, {"reason": body.reason})
    db.commit()
    db.refresh(event)
    return MedicationEventOut.model_validate(event)
