"""知识库 API（J040）。

文本按段落切 chunk；仅 PUBLISHED 进入检索；发布记录审核人/时间。
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.access_policy import require_admin
from app.core.database import get_db
from app.models import DeviceModel, KnowledgeChunk, KnowledgeDocument, User
from app.schemas.common import Page
from app.schemas.knowledge import (
    KnowledgeChunkOut,
    KnowledgeDocCreate,
    KnowledgeDocOut,
    KnowledgeDocPatch,
)
from app.services.audit_service import write_audit

router = APIRouter(prefix="/api/admin", tags=["knowledge"])


def _split_chunks(text: str) -> list[str]:
    """按段落切分（空行分段），过滤空白。"""
    parts = [p.strip() for p in text.replace("\r\n", "\n").split("\n\n")]
    return [p for p in parts if p]


def _build_out(doc: KnowledgeDocument, db: Session) -> KnowledgeDocOut:
    chunks = (
        db.query(KnowledgeChunk)
        .filter(KnowledgeChunk.document_id == doc.id)
        .order_by(KnowledgeChunk.chunk_no)
        .all()
    )
    out = KnowledgeDocOut.model_validate(doc)
    out.chunks = [KnowledgeChunkOut.model_validate(c) for c in chunks]
    return out


@router.get("/knowledge-documents", response_model=Page[KnowledgeDocOut])
def list_docs(
    device_model_id: uuid.UUID | None = None,
    review_status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(KnowledgeDocument)
    if device_model_id:
        q = q.filter(KnowledgeDocument.device_model_id == device_model_id)
    if review_status:
        q = q.filter(KnowledgeDocument.review_status == review_status)
    total = q.count()
    items = q.order_by(KnowledgeDocument.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Page[KnowledgeDocOut](
        items=[_build_out(d, db) for d in items],
        total=total, page=page, page_size=page_size,
    )


@router.post("/knowledge-documents", response_model=KnowledgeDocOut, status_code=status.HTTP_201_CREATED)
def create_doc(
    body: KnowledgeDocCreate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(DeviceModel).filter(DeviceModel.id == body.device_model_id).first() is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "型号不存在", "details": None})
    doc = KnowledgeDocument(
        device_model_id=body.device_model_id,
        guide_id=body.guide_id,
        title=body.title,
        version=body.version,
        review_status="DRAFT",
        source_url=body.source_url,
    )
    db.add(doc)
    db.flush()
    for i, chunk_text in enumerate(_split_chunks(body.text), start=1):
        db.add(KnowledgeChunk(document_id=doc.id, chunk_no=i, text=chunk_text))
    write_audit(db, user.id, "KNOWLEDGE_CREATE", "knowledge_document", doc.id, {"version": doc.version})
    db.commit()
    db.refresh(doc)
    return _build_out(doc, db)


@router.get("/knowledge-documents/{doc_id}", response_model=KnowledgeDocOut)
def get_doc(
    doc_id: uuid.UUID,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "文档不存在", "details": None})
    return _build_out(doc, db)


@router.patch("/knowledge-documents/{doc_id}", response_model=KnowledgeDocOut)
def patch_doc(
    doc_id: uuid.UUID,
    body: KnowledgeDocPatch,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "文档不存在", "details": None})
    if doc.review_status != "DRAFT":
        raise HTTPException(status_code=409, detail={"code": "ALREADY_PUBLISHED", "message": "已发布文档不可原地修改", "details": None})

    if body.title is not None:
        doc.title = body.title
    if body.source_url is not None:
        doc.source_url = body.source_url
    if body.text is not None:
        db.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == doc.id).delete()
        for i, chunk_text in enumerate(_split_chunks(body.text), start=1):
            db.add(KnowledgeChunk(document_id=doc.id, chunk_no=i, text=chunk_text))
    if body.review_action == "APPROVE":
        doc.review_status = "REVIEWED"
        doc.reviewed_by = user.id
        doc.reviewed_at = datetime.now(timezone.utc)
        write_audit(db, user.id, "KNOWLEDGE_REVIEW", "knowledge_document", doc.id, {"version": doc.version})

    db.commit()
    db.refresh(doc)
    return _build_out(doc, db)


@router.post("/knowledge-documents/{doc_id}/publish", response_model=KnowledgeDocOut)
def publish_doc(
    doc_id: uuid.UUID,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "文档不存在", "details": None})
    if doc.review_status != "REVIEWED":
        raise HTTPException(status_code=409, detail={"code": "NOT_REVIEWED", "message": "须先完成医学审核才能发布", "details": None})
    doc.review_status = "PUBLISHED"
    doc.published_by = user.id
    doc.published_at = datetime.now(timezone.utc)
    write_audit(db, user.id, "KNOWLEDGE_PUBLISH", "knowledge_document", doc.id, {"version": doc.version})
    db.commit()
    db.refresh(doc)
    return _build_out(doc, db)
