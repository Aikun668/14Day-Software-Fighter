"""验证管理端知识内容闭环：新建 → 审核 → 发布 → AI 可引用。

注意：本系统没有「删除知识文档」接口（发布即留痕），所以脚本结束时
直连库清理自己创建的全部文档，避免测试内容留在演示库里被患者端 AI 引用。
"""
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _db import cleanup_knowledge_by_title  # noqa: E402

BASE = "http://127.0.0.1:8010"
PASSED = 0
FAILED = 0

# 每次运行唯一的标题前缀，既用于断言，也用于收尾清理
MARKER = f"闭环验证知识（DEMO）t{str(int(time.time()))[-8:]}"


def req(method, path, body=None, tok=None, expect=None):
    global PASSED, FAILED
    r = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {tok}"} if tok else {})},
        method=method,
    )
    try:
        resp = urllib.request.urlopen(r, timeout=15)
        code, data = resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        code, data = e.code, json.loads(e.read().decode() or "{}")
    ok = expect is None or code == expect
    if ok:
        PASSED += 1
        print(f"PASS {method:5} {path[:60]} -> {code}")
    else:
        FAILED += 1
        print(f"FAIL {method:5} {path[:60]} -> {code} 期望 {expect} {str(data)[:120]}")
    return code, data


def check(name, cond, detail=""):
    global PASSED, FAILED
    if cond:
        PASSED += 1
        print(f"PASS {name}")
    else:
        FAILED += 1
        print(f"FAIL {name} {detail}")


admin = req("POST", "/api/auth/login", {"account": "admin", "password": "123"})[1]["access_token"]
clin = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})[1]["access_token"]
ptok = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})[1]["access_token"]

# 患者端查型号（用于对照：AI 只引用已发布知识）
_, me = req("GET", "/api/me/patient", tok=ptok)
model_id = me["current_devices"][0]["device_model_id"]

try:
    print("=== 1) 新建知识草稿 ===")
    code, doc = req("POST", "/api/admin/knowledge-documents", {
        "device_model_id": model_id,
        "title": MARKER,
        "version": "test-1",
        # 分块规则：按空行分段（\n\n），每段一个检索片段
        "text": ("闭环验证要点一：本条由管理端知识闭环测试创建。\n\n"
                 "闭环验证要点二：发布后 AI 助手应能引用本条内容。\n\n"
                 "闭环验证要点三：知识发布同样留痕，可追溯。"),
    }, tok=admin, expect=201)
    doc_id = doc["id"]
    check("初始状态为 DRAFT", doc["review_status"] == "DRAFT")
    check("按段落自动分块 = 3", len(doc["chunks"]) == 3)

    print("\n=== 2) 草稿阶段 AI 不可引用（T12 前提）===")
    code, ans = req("POST", "/api/ai/ask", {"device_model_id": model_id, "question": "闭环验证要点一是什么"}, tok=clin)
    refs = json.dumps(ans.get("citations", []), ensure_ascii=False)
    check("AI 引用不含该草稿（按唯一标题）", MARKER not in refs)

    print("\n=== 3) 审核通过 ===")
    code, doc = req("PATCH", f"/api/admin/knowledge-documents/{doc_id}", {"review_action": "APPROVE"}, tok=admin, expect=200)
    check("状态变为 REVIEWED", doc["review_status"] == "REVIEWED")

    print("\n=== 4) 发布 ===")
    code, doc = req("POST", f"/api/admin/knowledge-documents/{doc_id}/publish", tok=admin, expect=200)
    check("状态变为 PUBLISHED", doc["review_status"] == "PUBLISHED")

    print("\n=== 5) 发布后 AI 可引用（T12）===")
    code, ans = req("POST", "/api/ai/ask", {"device_model_id": model_id, "question": "闭环验证要点二是什么"}, tok=clin)
    refs = json.dumps(ans.get("citations", []), ensure_ascii=False)
    check("AI 状态 ANSWERED", ans.get("status") == "ANSWERED", str(ans.get("status")))
    check("AI 引用含新发布文档", MARKER in refs, refs[:200])

    print("\n=== 6) 已发布不可原地修改 ===")
    code, _ = req("PATCH", f"/api/admin/knowledge-documents/{doc_id}", {"title": "改不动"}, tok=admin, expect=409)
    check("已发布修改被拒 409", True)

    print("\n=== 7) 同标题多版本：检索只用最新发布版 ===")
    # 已发布不可原地改，新版本另建文档 → 同标题会并存两个 PUBLISHED
    code, doc2 = req("POST", "/api/admin/knowledge-documents", {
        "device_model_id": model_id,
        "title": MARKER,                      # 同一标题
        "version": "test-2",
        "text": "闭环验证要点二：新版内容（v2），旧版步骤已废弃。",
    }, tok=admin, expect=201)
    doc2_id = doc2["id"]
    req("PATCH", f"/api/admin/knowledge-documents/{doc2_id}", {"review_action": "APPROVE"}, tok=admin, expect=200)
    req("POST", f"/api/admin/knowledge-documents/{doc2_id}/publish", tok=admin, expect=200)
    code, ans = req("POST", "/api/ai/ask", {"device_model_id": model_id, "question": "闭环验证要点二是什么"}, tok=clin)
    versions = [c.get("version") for c in ans.get("citations", []) if c.get("document_title") == MARKER]
    check("同标题只引用最新版本 test-2", versions == ["test-2"], f"实际 {versions}")
    check("旧版内容不再进入回答", "本条由管理端知识闭环测试创建" not in ans.get("answer", ""))
finally:
    removed = cleanup_knowledge_by_title(MARKER)
    print(f"\n[清理] 已删除测试知识文档 {removed} 份（含片段）")

print(f"\n=== 结果：{PASSED} PASS, {FAILED} FAIL ===")
raise SystemExit(0 if FAILED == 0 else 1)
