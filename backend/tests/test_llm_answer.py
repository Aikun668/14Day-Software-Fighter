"""AI 问答接入外部模型的测试（03 C-2、C-3）。

网络边界统一为 app.rag.service._post_chat，全部用 monkeypatch 替换，不发起真实请求。
"""
import json
import urllib.error
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.core.config import Settings
from app.models import DeviceModel, KnowledgeChunk, KnowledgeDocument, Patient, PatientDevice
from app.rag import service
from app.rag.service import ask

TEST_KEY = "sk-test-placeholder-not-real"
TEST_PASSWORD = "Test-1234"
PATIENT_ACCOUNT = "test_patient_llm"


@pytest.fixture
def settings_no_llm(monkeypatch):
    settings = Settings(_env_file=None, llm_api_key=None)
    monkeypatch.setattr(service, "get_settings", lambda: settings)
    return settings


@pytest.fixture
def settings_llm(monkeypatch):
    settings = Settings(
        _env_file=None,
        llm_api_key=TEST_KEY,
        llm_base_url="https://llm.example/v1",
        llm_model="test-model",
        llm_timeout_seconds=5,
    )
    monkeypatch.setattr(service, "get_settings", lambda: settings)
    return settings


def _capture_post(monkeypatch, reply=None, error=None):
    """替换网络边界，记录每次请求体；返回的列表长度即 LLM 调用次数。"""
    calls = []

    def fake_post(payload, settings):
        calls.append(payload)
        if error is not None:
            raise error
        return {"choices": [{"message": {"content": reply}}]}

    monkeypatch.setattr(service, "_post_chat", fake_post)
    return calls


def _hit(text="使用前请先摇匀吸入器。", title="A 型号操作说明", version="v1"):
    return [(SimpleNamespace(text=text, chunk_no=1), SimpleNamespace(title=title, version=version))]


def _device_model(db, name):
    model = DeviceModel(category="pMDI", brand="测试品牌", model_name=name)
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


def _seed_published(db, model_id, title, version, texts):
    doc = KnowledgeDocument(
        device_model_id=model_id,
        title=title,
        version=version,
        review_status="PUBLISHED",
        published_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.flush()
    for no, text in enumerate(texts, start=1):
        db.add(KnowledgeChunk(document_id=doc.id, chunk_no=no, text=text))
    db.commit()
    return doc


def _bind_patient(db, make_user, model_id):
    user = make_user(PATIENT_ACCOUNT, "PATIENT")
    patient = Patient(patient_code="P-LLM-001", display_name="王小明", account_user_id=user.id)
    db.add(patient)
    db.flush()
    db.add(PatientDevice(patient_id=patient.id, device_model_id=model_id, effective_from=datetime.now(timezone.utc)))
    db.commit()
    return str(patient.id)


def _login(client):
    resp = client.post("/api/auth/login", json={"account": PATIENT_ACCOUNT, "password": TEST_PASSWORD})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ---------- C-2：_llm_answer 与 _post_chat ----------


def test_llm_answer_returns_model_text(settings_llm, monkeypatch):
    _capture_post(monkeypatch, reply="请先摇匀吸入器。")
    assert service._llm_answer("使用前要做什么", _hit()) == ("请先摇匀吸入器。", False)


def test_request_body_contains_only_question_and_hit_texts(settings_llm, monkeypatch):
    calls = _capture_post(monkeypatch, reply="ok")
    service._llm_answer("使用前要做什么", _hit(text="片段正文ZZ", title="标题XX"))
    body = json.dumps(calls[0], ensure_ascii=False)
    assert "使用前要做什么" in body
    assert "片段正文ZZ" in body
    assert "标题XX" not in body  # 文档标题属于服务端引用，不外发


def test_system_prompt_forbids_dosage_diagnosis_and_emergency(settings_llm, monkeypatch):
    calls = _capture_post(monkeypatch, reply="ok")
    service._llm_answer("使用前要做什么", _hit())
    system = calls[0]["messages"][0]["content"]
    for keyword in ("只能依据", "剂量", "诊断", "急症"):
        assert keyword in system


@pytest.mark.parametrize("reply", ["建议您加大剂量。", "诊断为哮喘。", "出现这种情况请急诊就医。"])
def test_unsafe_model_output_is_replaced_with_refusal(settings_llm, monkeypatch, reply):
    _capture_post(monkeypatch, reply=reply)
    assert service._llm_answer("使用前要做什么", _hit()) == (service._OUT_OF_SCOPE_ANSWER, True)


def test_empty_model_output_raises(settings_llm, monkeypatch):
    _capture_post(monkeypatch, reply="   ")
    with pytest.raises(RuntimeError):
        service._llm_answer("使用前要做什么", _hit())


def test_missing_base_url_raises_before_any_request(monkeypatch):
    settings = Settings(_env_file=None, llm_api_key=TEST_KEY, llm_base_url=None, llm_model="m")
    monkeypatch.setattr(service, "get_settings", lambda: settings)
    calls = _capture_post(monkeypatch, reply="x")
    with pytest.raises(RuntimeError):
        service._llm_answer("使用前要做什么", _hit())
    assert calls == []


def test_timeout_propagates_to_caller(settings_llm, monkeypatch):
    _capture_post(monkeypatch, error=TimeoutError("timed out"))
    with pytest.raises(TimeoutError):
        service._llm_answer("使用前要做什么", _hit())


def test_post_chat_uses_stdlib_urlopen_with_configured_timeout(settings_llm, monkeypatch):
    seen = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            return json.dumps({"choices": [{"message": {"content": "ok"}}]}).encode()

    def fake_open(req, timeout):
        seen.update(url=req.full_url, timeout=timeout, body=req.data, auth=req.get_header("Authorization"))
        return FakeResponse()

    class FakeOpener:
        def open(self, req, timeout):
            return fake_open(req, timeout)

    monkeypatch.setattr(service, "_LLM_OPENER", FakeOpener())
    assert service._llm_answer("使用前要做什么", _hit()) == ("ok", False)
    assert seen["timeout"] == 5
    assert seen["url"] == "https://llm.example/v1/chat/completions"
    assert seen["auth"] == f"Bearer {TEST_KEY}"
    assert TEST_KEY.encode() not in seen["body"]  # key 只进请求头，不进请求体


def test_redirect_is_refused_so_key_is_never_forwarded():
    handler = service._NoRedirectHandler()
    with pytest.raises(urllib.error.HTTPError) as exc:
        handler.redirect_request(
            SimpleNamespace(), None, 302, "Found", {}, "http://evil.example/steal"
        )
    assert exc.value.code == 302
    assert service._LLM_OPENER.handlers  # 自定义 opener 已挂载禁止重定向的处理器
    assert any(isinstance(h, service._NoRedirectHandler) for h in service._LLM_OPENER.handlers)


# ---------- C-3：ask() 级别 ----------


def test_ask_with_key_uses_llm_and_server_side_citations(db, settings_llm, monkeypatch):
    model = _device_model(db, "型号A")
    _seed_published(db, model.id, "A 型号操作说明", "v1", ["使用前请先摇匀吸入器并取下保护帽。"])
    _capture_post(monkeypatch, reply="请先摇匀吸入器。参见资料 FAKE-999 第 9 页。")

    result = ask(db, model.id, "使用前要做什么")

    assert result["status"] == "ANSWERED"
    assert result["answer"] == "请先摇匀吸入器。参见资料 FAKE-999 第 9 页。"
    assert result["citations"] == [{"document_title": "A 型号操作说明", "version": "v1", "step_ref": "片段 1"}]


def test_model_output_refusal_is_reported_as_out_of_scope_without_citations(db, settings_llm, monkeypatch):
    model = _device_model(db, "型号A")
    _seed_published(db, model.id, "A 型号操作说明", "v1", ["使用前请先摇匀吸入器。"])
    _capture_post(monkeypatch, reply="建议您加大剂量。")

    result = ask(db, model.id, "使用前要做什么")

    assert result["status"] == "OUT_OF_SCOPE"
    assert result["answer"] == service._OUT_OF_SCOPE_ANSWER
    assert result["citations"] == []


def test_ask_without_key_labels_extractive_answer_and_skips_llm(db, settings_no_llm, monkeypatch):
    model = _device_model(db, "型号A")
    _seed_published(db, model.id, "A 型号操作说明", "v1", ["使用前请先摇匀吸入器并取下保护帽。"])
    calls = _capture_post(monkeypatch, reply="不应被调用")

    result = ask(db, model.id, "使用前要做什么")

    assert result["status"] == "ANSWERED"
    assert result["answer"].startswith(service._NO_LLM_LABEL)
    assert "使用前请先摇匀吸入器并取下保护帽。" in result["answer"]
    assert result["citations"] == [{"document_title": "A 型号操作说明", "version": "v1", "step_ref": "片段 1"}]
    assert calls == []


@pytest.mark.parametrize("question", ["我可以加倍剂量吗", "我是不是得了哮喘", "喘不上气要急救吗"])
def test_out_of_scope_question_is_refused_before_llm(db, settings_llm, monkeypatch, question):
    model = _device_model(db, "型号A")
    _seed_published(db, model.id, "A 型号操作说明", "v1", ["使用前请先摇匀吸入器。"])
    calls = _capture_post(monkeypatch, reply="不应被调用")

    result = ask(db, model.id, question)

    assert result["status"] == "OUT_OF_SCOPE"
    assert calls == []


@pytest.mark.parametrize(
    "question",
    [
        "我叫张三 13800138000",
        "13800138000 怎么用",
        "身份证110101199001011234",
        "138-0013-8000 怎么用",
        "138 0013 8000 怎么用",
        "我姓王，使用前要做什么",
    ],
)
def test_sensitive_question_is_refused_before_llm(db, settings_llm, monkeypatch, question):
    model = _device_model(db, "型号A")
    _seed_published(db, model.id, "A 型号操作说明", "v1", ["使用前请先摇匀吸入器。"])
    calls = _capture_post(monkeypatch, reply="不应被调用")

    result = ask(db, model.id, question)

    assert result["status"] == "OUT_OF_SCOPE"
    assert calls == []


def test_chunks_from_other_device_model_are_never_cited(db, settings_no_llm):
    model_a = _device_model(db, "型号A")
    model_b = _device_model(db, "型号B")
    _seed_published(db, model_a.id, "A 型号操作说明", "v1", ["使用前请先摇匀吸入器。"])
    _seed_published(db, model_b.id, "B 型号操作说明", "v1", ["使用前请先检查 B 型号储药仓。"])

    result = ask(db, model_a.id, "使用前要做什么")

    assert [c["document_title"] for c in result["citations"]] == ["A 型号操作说明"]
    assert "储药仓" not in result["answer"]


# ---------- C-3：API 级别（超时 503、请求体不含身份） ----------


def test_llm_timeout_returns_503_and_core_endpoints_still_work(client, db, make_user, monkeypatch, settings_llm):
    model = _device_model(db, "型号A")
    _seed_published(db, model.id, "A 型号操作说明", "v1", ["使用前请先摇匀吸入器。"])
    _bind_patient(db, make_user, model.id)
    headers = _login(client)
    _capture_post(monkeypatch, error=TimeoutError("timed out"))

    resp = client.post(
        "/api/ai/ask",
        json={"device_model_id": str(model.id), "question": "使用前要做什么"},
        headers=headers,
    )

    assert resp.status_code == 503
    assert resp.json()["detail"]["code"] == "LLM_UNAVAILABLE"
    assert "answer" not in resp.json()  # 不静默回落到抽取式回答
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/me/patient", headers=headers).status_code == 200


def test_api_request_body_excludes_patient_identity(client, db, make_user, monkeypatch, settings_llm):
    model = _device_model(db, "型号A")
    _seed_published(db, model.id, "A 型号操作说明", "v1", ["使用前请先摇匀吸入器。"])
    patient_id = _bind_patient(db, make_user, model.id)
    headers = _login(client)
    calls = _capture_post(monkeypatch, reply="请先摇匀吸入器。")

    resp = client.post(
        "/api/ai/ask",
        json={"device_model_id": str(model.id), "question": "使用前要做什么"},
        headers=headers,
    )

    assert resp.status_code == 200
    assert resp.json()["status"] == "ANSWERED"
    body = json.dumps(calls[0], ensure_ascii=False)
    for forbidden in (patient_id, "P-LLM-001", "王小明", PATIENT_ACCOUNT):
        assert forbidden not in body
