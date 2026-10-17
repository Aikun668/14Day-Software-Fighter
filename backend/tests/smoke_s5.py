"""S5 后端冒烟测试（J035/J037/J040/J041）。T10-T13。"""
import json
import urllib.request

BASE = "http://127.0.0.1:8010"


def req(method, path, body=None, token=None, expect=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            code = resp.status
            raw = resp.read().decode()
    except urllib.error.HTTPError as e:
        code = e.code
        raw = e.read().decode()
    ok = "PASS" if (expect is None or code == expect) else "FAIL"
    print(f"{ok} {method:6} {path:50} -> {code} {raw[:130]}")
    return code, raw


_, r = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})
clin = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "admin", "password": "123"})
admin = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})
pat = json.loads(r)["access_token"]

print("\n=== T10 待核查任务 ===")
import datetime as _dt

code, r = req("GET", "/api/tasks", token=clin, expect=200)
tasks = json.loads(r)["items"]
print(f"  任务数: {len(tasks)}, 状态: {[t['status'] for t in tasks]}")
# 优先取未关闭任务（演示数据中可能已存在 CLOSED 任务）
open_task = next((t for t in tasks if t["status"] == "OPEN"), None)
task_id = open_task["id"] if open_task else None
if task_id:
    req("PATCH", f"/api/tasks/{task_id}", {"status": "IN_PROGRESS"}, token=clin, expect=200)

print("\n=== T11 随访闭环 ===")
# 随访必须关联「任务所属的患者」，否则触发 TASK_MISMATCH 校验
if task_id:
    code, r = req("GET", "/api/patients?page_size=100", token=clin, expect=200)
    patients = {p["id"]: p for p in json.loads(r)["items"]}
    followup_pid = open_task["patient_id"]
    assert followup_pid in patients, "任务所属患者应在本医护负责范围内"
else:
    followup_pid = None

if followup_pid:
    _today = _dt.date.today().isoformat()
    code, r = req("POST", "/api/followups", {
        "patient_id": followup_pid,
        "task_id": task_id,
        "followed_at": f"{_today}T10:00:00+08:00",
        "feedback": "已电话联系患者",
        "action_taken": "再次演示吸入步骤",
        "next_plan": "一周后复查",
        "close_task": True,
        "create_retraining_reminder": True,
    }, token=clin, expect=201)
    print(f"  随访结果: {r[:200]}")

print("\n=== 任务关闭后状态 ===")
code, r = req("GET", "/api/tasks?status=CLOSED", token=clin, expect=200)
print(f"  已关闭任务数: {json.loads(r)['total']}")

print("\n=== REM-01 患者站内提醒 ===")
code, r = req("GET", "/api/me/reminders", token=pat, expect=200)
reminders = json.loads(r)["items"]
print(f"  提醒数: {len(reminders)}")
for x in reminders:
    print(f"    - {x['kind']}: {x['title']}")

print("\n=== J040 知识库 ===")
code, r = req("GET", "/api/device-models?page_size=100", token=admin, expect=200)
mid = json.loads(r)["items"][0]["id"]
code, r = req("POST", "/api/admin/knowledge-documents", {
    "device_model_id": mid,
    "title": "测试知识文档",
    "version": "1.0",
    "text": "使用前请摇匀吸入器。\n\n呼气后含住吸嘴缓慢吸气。\n\n使用后漱口。",
}, token=admin, expect=201)
doc = json.loads(r)
doc_id = doc["id"]
print(f"  文档片段数: {len(doc['chunks'])}")

print("\n=== 未发布不可检索（T12）===")
code, r = req("POST", "/api/ai/ask", {"device_model_id": mid, "question": "使用前要做什么"}, token=pat, expect=200)
print(f"  草稿阶段: status={json.loads(r)['status']}")

print("\n=== 审核发布 ===")
req("PATCH", f"/api/admin/knowledge-documents/{doc_id}", {"review_action": "APPROVE"}, token=admin, expect=200)
req("POST", f"/api/admin/knowledge-documents/{doc_id}/publish", token=admin, expect=200)

print("\n=== 发布后检索（T12 型号限定）===")
code, r = req("POST", "/api/ai/ask", {"device_model_id": mid, "question": "使用前要做什么"}, token=pat, expect=200)
res = json.loads(r)
print(f"  status={res['status']}, citations={len(res['citations'])}")

print("\n=== T13 越界拒答（剂量）===")
code, r = req("POST", "/api/ai/ask", {"device_model_id": mid, "question": "我可以加倍剂量吗"}, token=pat, expect=200)
print(f"  status={json.loads(r)['status']}")

print("\n=== T13 急症兜底 ===")
code, r = req("POST", "/api/ai/ask", {"device_model_id": mid, "question": "呼吸困难加重怎么办"}, token=pat, expect=200)
print(f"  status={json.loads(r)['status']}")

print("\n=== 测试完成 ===")
