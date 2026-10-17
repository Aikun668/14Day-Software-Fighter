"""装置目录与指导 API（J019）。"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.access_policy import (
    get_current_patient,
    require_admin,
    require_clinician,
)
from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models import DeviceGuide, DeviceModel, GuideStep, PatientDevice, User
from app.schemas.common import Page
from app.schemas.device import (
    DeviceModelBrief,
    DeviceModelCreate,
    GuideCreate,
    GuideOut,
    GuidePatch,
    GuideStepOut,
)
from app.services.audit_service import write_audit

router = APIRouter(prefix="/api", tags=["device"])


# ---------- 型号目录 ----------
@router.get("/device-models", response_model=Page[DeviceModelBrief])
def list_device_models(
    category: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """患者/医护查询可用型号（只返回可用型号，不含草稿指导）。"""
    q = db.query(DeviceModel).filter(DeviceModel.status == "ACTIVE")
    if category:
        q = q.filter(DeviceModel.category == category)
    total = q.count()
    items = q.order_by(DeviceModel.created_at).offset((page - 1) * page_size).limit(page_size).all()
    return Page[DeviceModelBrief](
        items=[DeviceModelBrief.model_validate(m) for m in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/device-models/{model_id}/guide", response_model=GuideOut)
def get_published_guide(
    model_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取型号当前已发布指导；未发布 404。"""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if model is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "型号不存在", "details": None})

    # 患者：型号须为本人当前绑定之一
    if user.role == "PATIENT":
        bound = (
            db.query(PatientDevice)
            .filter(
                PatientDevice.patient_id == user.id,
                PatientDevice.device_model_id == model_id,
            )
            .first()
        )
        # 注意：patient_id 是患者表 id，患者用户需通过 account_user_id 关联
        from app.models import Patient

        patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
        if patient is None:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "无权访问", "details": None})
        bound = (
            db.query(PatientDevice)
            .filter(
                PatientDevice.patient_id == patient.id,
                PatientDevice.device_model_id == model_id,
            )
            .first()
        )
        if bound is None:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "该型号未绑定到本人", "details": None})

    guide = (
        db.query(DeviceGuide)
        .filter(
            DeviceGuide.device_model_id == model_id,
            DeviceGuide.review_status == "PUBLISHED",
        )
        .order_by(DeviceGuide.published_at.desc())
        .first()
    )
    if guide is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "暂无已发布指导", "details": None})

    steps = db.query(GuideStep).filter(GuideStep.guide_id == guide.id).order_by(GuideStep.step_no).all()
    out = GuideOut.model_validate(guide)
    out.steps = [GuideStepOut.model_validate(s) for s in steps]
    return out


# ---------- 后台管理（Admin） ----------
@router.get("/admin/device-models", response_model=Page[DeviceModelBrief])
def admin_list_device_models(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(DeviceModel)
    if search:
        like = f"%{search}%"
        q = q.filter((DeviceModel.model_name.ilike(like)) | (DeviceModel.brand.ilike(like)))
    total = q.count()
    items = q.order_by(DeviceModel.created_at).offset((page - 1) * page_size).limit(page_size).all()
    return Page[DeviceModelBrief](
        items=[DeviceModelBrief.model_validate(m) for m in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/admin/device-models", response_model=DeviceModelBrief, status_code=status.HTTP_201_CREATED)
def admin_create_device_model(
    body: DeviceModelCreate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    model = DeviceModel(
        category=body.category,
        brand=body.brand,
        model_name=body.model_name,
        manufacturer=body.manufacturer,
        status="ACTIVE",
    )
    db.add(model)
    db.flush()
    write_audit(db, user.id, "DEVICE_MODEL_CREATE", "device_model", model.id, {"model_name": model.model_name})
    db.commit()
    db.refresh(model)
    return DeviceModelBrief.model_validate(model)


# ---------- 指导草稿/发布（Admin / 授权医护） ----------
@router.get("/admin/device-guides", response_model=Page[GuideOut])
def admin_list_guides(
    device_model_id: uuid.UUID | None = None,
    review_status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(DeviceGuide)
    if device_model_id:
        q = q.filter(DeviceGuide.device_model_id == device_model_id)
    if review_status:
        q = q.filter(DeviceGuide.review_status == review_status)
    total = q.count()
    items = q.order_by(DeviceGuide.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    result = []
    for g in items:
        steps = db.query(GuideStep).filter(GuideStep.guide_id == g.id).order_by(GuideStep.step_no).all()
        out = GuideOut.model_validate(g)
        out.steps = [GuideStepOut.model_validate(s) for s in steps]
        result.append(out)
    return Page[GuideOut](items=result, total=total, page=page, page_size=page_size)


@router.post("/admin/device-guides", response_model=GuideOut, status_code=status.HTTP_201_CREATED)
def admin_create_guide(
    body: GuideCreate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(DeviceModel).filter(DeviceModel.id == body.device_model_id).first() is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "型号不存在", "details": None})
    if (
        db.query(DeviceGuide)
        .filter(DeviceGuide.device_model_id == body.device_model_id, DeviceGuide.version == body.version)
        .first()
    ):
        raise HTTPException(status_code=409, detail={"code": "VERSION_EXISTS", "message": "该型号此版本已存在", "details": None})
    guide = DeviceGuide(
        device_model_id=body.device_model_id,
        version=body.version,
        title=body.title,
        source_title=body.source_title,
        source_url=body.source_url,
        review_status="DRAFT",
    )
    db.add(guide)
    db.flush()
    for s in body.steps:
        db.add(GuideStep(guide_id=guide.id, step_no=s.step_no, text=s.text, error_notes=s.error_notes, image_path=s.image_path))
    write_audit(db, user.id, "GUIDE_CREATE", "device_guide", guide.id, {"version": guide.version})
    db.commit()
    db.refresh(guide)
    steps = db.query(GuideStep).filter(GuideStep.guide_id == guide.id).order_by(GuideStep.step_no).all()
    out = GuideOut.model_validate(guide)
    out.steps = [GuideStepOut.model_validate(s) for s in steps]
    return out


@router.patch("/admin/device-guides/{guide_id}", response_model=GuideOut)
def admin_patch_guide(
    guide_id: uuid.UUID,
    body: GuidePatch,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    guide = db.query(DeviceGuide).filter(DeviceGuide.id == guide_id).first()
    if guide is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "指导不存在", "details": None})
    if guide.review_status != "DRAFT":
        raise HTTPException(status_code=409, detail={"code": "ALREADY_PUBLISHED", "message": "已发布版本不可修改，请新建版本", "details": None})

    if body.title is not None:
        guide.title = body.title
    if body.source_title is not None:
        guide.source_title = body.source_title
    if body.source_url is not None:
        guide.source_url = body.source_url
    if body.steps is not None:
        db.query(GuideStep).filter(GuideStep.guide_id == guide.id).delete()
        for s in body.steps:
            db.add(GuideStep(guide_id=guide.id, step_no=s.step_no, text=s.text, error_notes=s.error_notes, image_path=s.image_path))
    # 审核动作：记录真实审核人与时间
    if body.review_action == "APPROVE":
        guide.review_status = "REVIEWED"
        guide.reviewed_by = user.id
        guide.reviewed_at = datetime.now(timezone.utc)
        write_audit(db, user.id, "GUIDE_REVIEW", "device_guide", guide.id, {"version": guide.version})

    db.commit()
    db.refresh(guide)
    steps = db.query(GuideStep).filter(GuideStep.guide_id == guide.id).order_by(GuideStep.step_no).all()
    out = GuideOut.model_validate(guide)
    out.steps = [GuideStepOut.model_validate(s) for s in steps]
    return out


@router.post("/admin/device-guides/{guide_id}/publish", response_model=GuideOut)
def admin_publish_guide(
    guide_id: uuid.UUID,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    guide = db.query(DeviceGuide).filter(DeviceGuide.id == guide_id).first()
    if guide is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "指导不存在", "details": None})
    # 必须已完成医学审核（review_status == REVIEWED）才可发布
    if guide.review_status != "REVIEWED":
        raise HTTPException(status_code=409, detail={"code": "NOT_REVIEWED", "message": "须先完成医学审核才能发布", "details": None})
    guide.review_status = "PUBLISHED"
    guide.published_by = user.id
    guide.published_at = datetime.now(timezone.utc)
    write_audit(db, user.id, "GUIDE_PUBLISH", "device_guide", guide.id, {"version": guide.version})
    db.commit()
    db.refresh(guide)
    steps = db.query(GuideStep).filter(GuideStep.guide_id == guide.id).order_by(GuideStep.step_no).all()
    out = GuideOut.model_validate(guide)
    out.steps = [GuideStepOut.model_validate(s) for s in steps]
    return out
