"""知识库与 AI 问答 Schema（J040/J041）。"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class KnowledgeDocCreate(BaseModel):
    device_model_id: uuid.UUID
    guide_id: uuid.UUID | None = None
    title: str
    version: str
    source_url: str | None = None
    text: str


class KnowledgeDocPatch(BaseModel):
    title: str | None = None
    source_url: str | None = None
    text: str | None = None
    review_action: str | None = None  # APPROVE


class KnowledgeChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chunk_no: int
    text: str


class KnowledgeDocOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_model_id: uuid.UUID
    guide_id: uuid.UUID | None
    title: str
    version: str
    review_status: str
    source_url: str | None
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    published_by: uuid.UUID | None
    published_at: datetime | None
    chunks: list[KnowledgeChunkOut] = []


class AskRequest(BaseModel):
    device_model_id: uuid.UUID
    question: str


class Citation(BaseModel):
    document_title: str
    version: str
    step_ref: str


class AskResponse(BaseModel):
    status: str  # ANSWERED/NO_EVIDENCE/OUT_OF_SCOPE/ERROR
    answer: str
    citations: list[Citation] = []
    device_model_id: uuid.UUID
