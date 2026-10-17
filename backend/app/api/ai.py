"""AI 型号限定问答 API（J041）。"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models import Patient, PatientDevice, User
from app.rag.service import ask
from app.schemas.knowledge import AskRequest, AskResponse

router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/ai/ask", response_model=AskResponse)
def ai_ask(
    body: AskRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 患者：型号须为本人当前绑定之一
    if user.role == "PATIENT":
        patient = db.query(Patient).filter(Patient.account_user_id == user.id).first()
        if patient is None:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "未绑定患者档案", "details": None})
        bound = (
            db.query(PatientDevice)
            .filter(
                PatientDevice.patient_id == patient.id,
                PatientDevice.device_model_id == body.device_model_id,
            )
            .first()
        )
        if bound is None:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "该型号未绑定到本人", "details": None})

    try:
        result = ask(db, body.device_model_id, body.question)
    except Exception:
        # LLM 不可用：局部失败，不影响其他功能
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "LLM_UNAVAILABLE", "message": "AI 服务暂不可用，请稍后重试", "details": {"ai_status": "ERROR"}},
        )

    return AskResponse(
        status=result["status"],
        answer=result["answer"],
        citations=result["citations"],
        device_model_id=body.device_model_id,
    )
