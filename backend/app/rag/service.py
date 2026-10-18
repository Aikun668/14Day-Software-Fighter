"""RAG 检索与问答服务（J041）。

原则（TECH_DESIGN §6）：
- 只检索该型号「已发布」知识片段；
- 无充分证据 → NO_EVIDENCE；剂量/诊断/急症 → OUT_OF_SCOPE；
- 引用由服务端基于真实命中片段组装，拒绝模型虚构；
- 未配置 LLM 时使用「抽取式回答」（基于已审片段，可追溯），不编造步骤。
"""
import re

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import KnowledgeChunk, KnowledgeDocument

TOP_K = 3

# 越界关键词（剂量调整 / 诊断 / 急症）
_OUT_OF_SCOPE_PATTERNS = [
    r"加倍|加大|增加|减少|调整?剂[量量]|剂[量量]够不够|多吃|少吃|停药",
    r"诊断|我是不是|得了什么病|什么病",
    r"呼吸困难加重|喘不上气|急救|急诊|晕倒|昏厥|大出血|窒息",
]
_SENSITIVE_PATTERNS = [
    r"\d{11}",  # 手机号
    r"\d{15,18}[0-9Xx]",  # 身份证
    r"我叫[\u4e00-\u9fa5]{2,4}",  # 姓名自述
]


def _is_out_of_scope(question: str) -> bool:
    return any(re.search(p, question) for p in _OUT_OF_SCOPE_PATTERNS)


def _contains_sensitive(question: str) -> bool:
    return any(re.search(p, question) for p in _SENSITIVE_PATTERNS)


def _tokenize(text: str) -> set[str]:
    """极简中文/英文分词：按标点切分 + 2-gram，用于关键词匹配打分。"""
    cleaned = re.sub(r"[^\w\u4e00-\u9fa5]", " ", text)
    tokens: set[str] = set()
    for word in cleaned.split():
        if len(word) <= 1:
            continue
        tokens.add(word)
        for i in range(len(word) - 1):
            tokens.add(word[i : i + 2])
    return tokens


def _latest_published_docs(db: Session, device_model_id) -> list[KnowledgeDocument]:
    """该型号下每个标题只取最新一次发布版本。

    知识文档的「发布」是追加式的（已发布不可原地修改，新版本另建文档），
    所以同一 title 可能同时存在多个 PUBLISHED 版本；检索必须只用最新版，
    否则旧版步骤会和新版一起被引用，患者会同时看到两套操作要求。
    """
    docs = (
        db.query(KnowledgeDocument)
        .filter(
            KnowledgeDocument.device_model_id == device_model_id,
            KnowledgeDocument.review_status == "PUBLISHED",
        )
        .all()
    )
    latest: dict[str, KnowledgeDocument] = {}
    for doc in docs:
        key = doc.title.strip()
        cur = latest.get(key)
        if cur is None:
            latest[key] = doc
            continue
        # 以发布时间为准；缺失时退回创建时间，再退回 id 保证确定性
        doc_key = (doc.published_at or doc.created_at, str(doc.id))
        cur_key = (cur.published_at or cur.created_at, str(cur.id))
        if doc_key > cur_key:
            latest[key] = doc
    return list(latest.values())


def retrieve_published_chunks(db: Session, device_model_id, question: str, top_k: int = TOP_K):
    """只在该型号「最新已发布」文档的片段中检索（型号 + 发布状态 + 版本三重过滤）。"""
    docs = _latest_published_docs(db, device_model_id)
    if not docs:
        return []
    doc_by_id = {d.id: d for d in docs}
    rows = (
        db.query(KnowledgeChunk)
        .filter(KnowledgeChunk.document_id.in_(list(doc_by_id)))
        .all()
    )
    if not rows:
        return []

    q_tokens = _tokenize(question)
    scored = []
    for chunk in rows:
        doc = doc_by_id[chunk.document_id]
        c_tokens = _tokenize(chunk.text)
        if not c_tokens:
            continue
        overlap = len(q_tokens & c_tokens)
        if overlap > 0:
            scored.append((overlap, chunk, doc))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [(chunk, doc) for _, chunk, doc in scored[:top_k]]


def _extractive_answer(question: str, hits) -> str:
    """未配置 LLM 时的抽取式回答：直接引用已审片段要点，不编造。"""
    lines = ["根据该型号已发布的操作资料："]
    for i, (chunk, doc) in enumerate(hits, start=1):
        lines.append(f"{i}. {chunk.text}")
    return "\n".join(lines)


def ask(db: Session, device_model_id, question: str) -> dict:
    """返回 {status, answer, citations}。"""
    # 1) 敏感信息拦截
    if _contains_sensitive(question):
        return {
            "status": "OUT_OF_SCOPE",
            "answer": "请勿输入个人身份或病历信息。如需帮助，请联系医护人员。",
            "citations": [],
        }
    # 2) 越界（剂量/诊断/急症）
    if _is_out_of_scope(question):
        return {
            "status": "OUT_OF_SCOPE",
            "answer": "这属于诊疗决策，超出本助手范围。请及时联系您的医护人员；如出现急性症状，请立即就医。",
            "citations": [],
        }
    # 3) 受限检索
    hits = retrieve_published_chunks(db, device_model_id, question)
    if not hits:
        return {
            "status": "NO_EVIDENCE",
            "answer": "资料不足，请咨询医护人员。",
            "citations": [],
        }

    settings = get_settings()
    # 4) 有 LLM 则调用（此处保留适配位；失败由 API 层转 503）
    if settings.llm_api_key:
        answer = _extractive_answer(question, hits)  # 适配器占位：真实实现替换为 LLM 调用
    else:
        answer = _extractive_answer(question, hits)

    # 5) 引用由服务端基于真实命中片段组装（不接受模型虚构）
    citations = []
    for chunk, doc in hits:
        citations.append(
            {
                "document_title": doc.title,
                "version": doc.version,
                "step_ref": f"片段 {chunk.chunk_no}",
            }
        )
    return {"status": "ANSWERED", "answer": answer, "citations": citations}
