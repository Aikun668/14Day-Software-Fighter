"""患者档案 API（J015）。"""
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.access_policy import (
    get_current_patient,
    get_patient_for_clinician,
    require_clinician,
)
from app.auth.dependencies import get_current_user
from app.auth.security import hash_password
from app.core.database import get_db
from app.models import Patient, PatientDevice, User
from app.services.audit_service import write_audit
from app.schemas.admin import (
    CreatePatientRequest,
    PatchPatientRequest,
)
from app.schemas.auth import UserBrief
from app.schemas.common import Page
from app.schemas.patient import (
    BindDeviceRequest,
    CreatePatientAccountRequest,
    DeviceSummary,
    PatientBrief,
    PatientDetail,
    PatientWithDevices,
)

router = APIRouter(prefix="/api", tags=["patients"])


@router.get("/patients", response_model=Page[PatientBrief])
def list_patients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    user: User = Depends(require_clinician),
    db: Session = Depends(get_db),
):
    q = db.query(Patient).filter(Patient.assigned_clinician_id == user.id)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Patient.patient_code.ilike(like)) | (Patient.display_name.ilike(like))
        )
    total = q.count()
    items = q.order_by(Patient.created_at).offset((page - 1) * page_size).limit(page_size).all()
    return Page[PatientBrief](
        items=[PatientBrief.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/patients", response_model=PatientBrief, status_code=status.HTTP_201_CREATED)
def create_patient(
    body: CreatePatientRequest,
    user: User = Depends(require_clinician),
    db: Session = Depends(get_db),
):
    if db.query(Patient).filter(Patient.patient_code == body.patient_code).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "PATIENT_CODE_EXISTS", "message": "患者编号已存在", "details": None},
        )
    patient = Patient(
        patient_code=body.patient_code,
        display_name=body.display_name,
        diagnosis_label=body.diagnosis_label,
        note=body.note,
        assigned_clinician_id=user.id,
    )
    db.add(patient)
    db.flush()
    write_audit(db, user.id, "PATIENT_CREATE", "patient", patient.id, {"code": patient.patient_code})
    db.commit()
    db.refresh(patient)
    return PatientBrief.model_validate(patient)


@router.get("/patients/{patient_id}", response_model=PatientDetail)
def get_patient(
    patient: Patient = Depends(get_patient_for_clinician),
):
    return PatientDetail.model_validate(patient)


@router.patch("/patients/{patient_id}", response_model=PatientBrief)
def patch_patient(
    body: PatchPatientRequest,
    patient: Patient = Depends(get_patient_for_clinician),
    db: Session = Depends(get_db),
):
    if body.display_name is not None:
        patient.display_name = body.display_name
    if body.diagnosis_label is not None:
        patient.diagnosis_label = body.diagnosis_label
    if body.note is not None:
        patient.note = body.note
    db.commit()
    db.refresh(patient)
    return PatientBrief.model_validate(patient)


@router.get("/me/patient", response_model=PatientWithDevices)
def get_my_patient(
    patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    devices = db.query(PatientDevice).filter(PatientDevice.patient_id == patient.id).all()
    return PatientWithDevices(
        **PatientDetail.model_validate(patient).model_dump(),
        current_devices=[DeviceSummary.model_validate(d) for d in devices],
    )


@router.post("/patients/{patient_id}/account", status_code=status.HTTP_201_CREATED)
def create_patient_account(
    body: CreatePatientAccountRequest,
    patient: Patient = Depends(get_patient_for_clinician),
    db: Session = Depends(get_db),
):
    if patient.account_user_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ACCOUNT_ALREADY_BOUND", "message": "患者已绑定账号", "details": None},
        )
    existing = db.query(User).filter(User.account == body.account).first()
    if existing:
        # 复用已存在但未绑定的 PATIENT 账号（如种子数据预置的患者账号）
        if existing.role != "PATIENT":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "ACCOUNT_EXISTS", "message": "账号已存在且非患者角色", "details": None},
            )
        bound = db.query(Patient).filter(Patient.account_user_id == existing.id).first()
        if bound is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "ACCOUNT_ALREADY_BOUND", "message": "账号已绑定其他患者", "details": None},
            )
        patient.account_user_id = existing.id
        write_audit(db, patient.assigned_clinician_id, "PATIENT_ACCOUNT_BIND", "patient", patient.id, {"account": existing.account})
        db.commit()
        return {
            "patient_id": patient.id,
            "user": UserBrief.model_validate(existing).model_dump(),
            "temporary_password": None,
        }
    temp = body.initial_password or secrets.token_urlsafe(12)
    user = User(
        account=body.account,
        password_hash=hash_password(temp),
        role="PATIENT",
        status="ACTIVE",
        must_change_password=True,
    )
    db.add(user)
    db.flush()
    patient.account_user_id = user.id
    write_audit(db, patient.assigned_clinician_id, "PATIENT_ACCOUNT_BIND", "patient", patient.id, {"account": user.account})
    db.commit()
    return {
        "patient_id": patient.id,
        "user": UserBrief.model_validate(user).model_dump(),
        "temporary_password": temp if not body.initial_password else None,
    }


@router.get("/patients/{patient_id}/devices")
def list_patient_devices(
    patient: Patient = Depends(get_patient_for_clinician),
    db: Session = Depends(get_db),
):
    devices = db.query(PatientDevice).filter(PatientDevice.patient_id == patient.id).all()
    return {
        "items": [DeviceSummary.model_validate(d) for d in devices],
        "total": len(devices),
    }


@router.post("/patients/{patient_id}/devices", status_code=status.HTTP_201_CREATED)
def bind_patient_device(
    body: BindDeviceRequest,
    patient: Patient = Depends(get_patient_for_clinician),
    db: Session = Depends(get_db),
):
    # 关闭旧装置生效期（同一患者切换装置，历史训练不改写）
    db.query(PatientDevice).filter(
        PatientDevice.patient_id == patient.id,
        PatientDevice.effective_to.is_(None),
    ).update({"effective_to": body.effective_from})
    device = PatientDevice(
        patient_id=patient.id,
        device_model_id=body.device_model_id,
        effective_from=body.effective_from,
    )
    db.add(device)
    db.flush()
    write_audit(db, patient.assigned_clinician_id, "DEVICE_BIND", "patient_device", device.id, {"model": str(body.device_model_id)})
    db.commit()
    db.refresh(device)
    return DeviceSummary.model_validate(device)
