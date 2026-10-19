"""RAG 检索与问答服务（J041）。

原则（TECH_DESIGN §6）：
- 只检索该型号「已发布」知识片段；
- 无充分证据 → NO_EVIDENCE；剂量/诊断/急症 → OUT_OF_SCOPE；
- 引用由服务端基于真实命中片段组装，拒绝模型虚构；
- 未配置 LLM 时使用「抽取式回答」（基于已审片段，可追溯），不编造步骤。
"""
import json
import re
import urllib.request

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import KnowledgeChunk, KnowledgeDocument

TOP_K = 3

_NO_LLM_LABEL = "未启用大模型，基于已审核片段的抽取式回答"
_OUT_OF_SCOPE_ANSWER = "这属于诊疗决策，超出本助手范围。请及时联系您的医护人员；如出现急性症状，请立即就医。"
_SYSTEM_PROMPT = (
    "你是医疗装置操作说明的问答助手。"
    "你只能依据用户消息中给出的资料片段回答，片段之外的内容不得补充，不得编造步骤。"
    "如果片段不足以回答，请说明资料不足，并建议联系医护人员。"
    "涉及剂量调整、诊断或急症时，必须拒绝回答，并引导用户联系医护人员；如出现急性症状，请立即就医。"
)

# 越界关键词（剂量调整 / 诊断 / 急症）
_OUT_OF_SCOPE_PATTERNS = [
    r"加倍|加大|增加|减少|调整?剂[量量]|剂[量量]够不够|多吃|少吃|停药",
    r"诊断|我是不是|得了什么病|什么病",
    r"呼吸困难加重|喘不上气|急救|急诊|晕倒|昏厥|大出血|窒息",
]
_SENSITIVE_PATTERNS = [
    r"(?:\D*\d){11}",  # 手机号（允许中间夹杂空格、连字符等分隔符，宁可误拦）
    r"\d{15,18}[0-9Xx]",  # 身份证
    r"我姓[一-龥]",  # 姓氏自述
    r"名字是[一-龥]{2,4}",  # 姓名自述
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


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """禁止跟随重定向：否则 Authorization 头会被转发到重定向目标。"""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(newurl, code, f"redirect refused: {msg}", headers, fp)


_LLM_OPENER = urllib.request.build_opener(_NoRedirectHandler)


def _post_chat(payload: dict, settings) -> dict:
    """向 OpenAI 兼容的 chat/completions 端点发送一次请求（标准库，不新增依赖）。"""
    req = urllib.request.Request(
        settings.llm_base_url.rstrip("/") + "/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.llm_api_key}",
        },
        method="POST",
    )
    with _LLM_OPENER.open(req, timeout=settings.llm_timeout_seconds) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _llm_answer(question: str, hits) -> tuple[str, bool]:
    """调用外部大模型生成回答，返回 (回答文本, 是否被替换为拒答)。请求体只含问题文本与命中片段正文。

    超时或返回异常直接抛出，由 API 层转 503，不静默回落到抽取式回答。
    """
    settings = get_settings()
    if not settings.llm_base_url or not settings.llm_model:
        raise RuntimeError("LLM 配置不完整：需要 llm_base_url 与 llm_model")
    snippets = "\n".join(f"{i}. {chunk.text}" for i, (chunk, _doc) in enumerate(hits, start=1))
    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": f"资料片段：\n{snippets}\n\n问题：{question}"},
        ],
    }
    body = _post_chat(payload, settings)
    text = str(body["choices"][0]["message"]["content"] or "").strip()
    if not text:
        raise RuntimeError("LLM 返回空内容")
    # 输出后检：模型若越界或带出敏感信息，整段替换为拒答
    if _is_out_of_scope(text) or _contains_sensitive(text):
        return _OUT_OF_SCOPE_ANSWER, True
    return text, False


def ask(db: Session, device_model_id, question: str) -> dict:
    """返回 {status, answer, citations}。"""
    # 1) 敏感信息拦截（先于任何 LLM 调用）
    if _contains_sensitive(question):
        return {
            "status": "OUT_OF_SCOPE",
            "answer": "请勿输入个人身份或病历信息。如需帮助，请联系医护人员。",
            "citations": [],
        }
    # 2) 越界（剂量/诊断/急症，先于任何 LLM 调用）
    if _is_out_of_scope(question):
        return {
            "status": "OUT_OF_SCOPE",
            "answer": _OUT_OF_SCOPE_ANSWER,
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

    # 4) 显式分支：配置了 key 走外部模型（失败抛异常 → API 层 503）；否则抽取式并标注
    if get_settings().llm_api_key:
        answer, refused = _llm_answer(question, hits)
        if refused:
            # 模型输出越界被替换为拒答：不附引用，避免把拒答呈现为有资料依据的回答
            return {"status": "OUT_OF_SCOPE", "answer": answer, "citations": []}
    else:
        answer = f"{_NO_LLM_LABEL}\n{_extractive_answer(question, hits)}"

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
