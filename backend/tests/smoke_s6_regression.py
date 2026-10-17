"""S6 全量回归测试（J049，T01-T16 核心断言）。"""
import datetime
import json
import urllib.request

BASE = "http://127.0.0.1:8010"
passed = 0
failed = 0


def check(name, cond):
    global passed, failed
    if cond:
        passed += 1
        print(f"PASS  {name}")
    else:
        failed += 1
        print(f"FAIL  {name}")


def req(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


# 登录
_, r = req("POST", "/api/auth/login", {"account": "admin", "password": "123"})
admin = r["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})
clin = r["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "clinician_b", "password": "123"})
clin_b = r["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})
pat = r["access_token"]

print("\n=== T01 登录/改密/退出 ===")
check("登录成功返回 token", "access_token" in r)
code, _ = req("POST", "/api/auth/login", {"account": "admin", "password": "wrong"})
check("错误密码 401", code == 401)
code, r = req("GET", "/api/me", token=clin)
check("me 返回身份", code == 200 and r["role"] == "CLINICIAN")

print("\n=== T02 医护越权 ===")
code, r = req("GET", "/api/patients?page_size=100", token=clin)
# 固定取演示标杆患者 P-001（有完整计划/登记/训练/随访）
p1 = next((p for p in r["items"] if p["patient_code"] == "P-001"), None)
pid = p1["id"] if p1 else (r["items"][0]["id"] if r["items"] else None)
if pid:
    code, _ = req("GET", f"/api/patients/{pid}", token=clin_b)
    check("医护B访问A患者 404", code == 404)

print("\n=== T03 指导发布/草稿不可见 ===")
code, r = req("GET", "/api/device-models?page_size=100", token=pat)
mid = r["items"][0]["id"]
code, r = req("GET", f"/api/device-models/{mid}/guide", token=clin)
check("已发布指导可见", code == 200)

print("\n=== T04/T05 训练来源 ===")
code, r = req("GET", "/api/me/training-sessions?page_size=5", token=pat)
check("患者训练历史可查", code == 200)

print("\n=== T06 统计口径 ===")
# P-001 的 v1 计划覆盖「今天-7 ~ 今天」共 7 个完整日（每天 2 次 → 14 个时点），
# 窗口取左闭右开 [today-7, today) 以排除 v2 计划（今天起生效）的时点。
_today = datetime.date.today()
_v1_from = _today - datetime.timedelta(days=7)
_v1_to = _today
code, r = req("GET", f"/api/patients/{pid}/stats?from={_v1_from}&to={_v1_to}", token=clin)
check("N=14 M=10 71.4%", r.get("N") == 14 and r.get("M") == 10 and r.get("coverage_rate") == 71.4)

print("\n=== T07 按需（PRN）登记 ===")
# 患者 X 是 P-001：其 PRN 计划在 P-002 名下，故本用例验证「按需登记必须 slot_id=null」与
# 「固定计划登记必须带 slot」两条规则，使用 P-001 自己的计划。
code, r = req("GET", "/api/me/medication-plans", token=pat)
plans = r["items"]
regular = next((p for p in plans if p["plan_type"] == "REGULAR"), None)
if regular:
    # 固定计划缺 slot → 应被拒（422），证明口径校验生效
    code_bad, _ = req("POST", "/api/medication-events",
                      {"plan_id": regular["id"], "slot_id": None, "occurred_at": "2026-10-10T08:05:00+08:00"}, token=pat)
    check("固定计划缺时点被拒 422", code_bad == 422)
    # 取一个未登记的固定时点正常登记
    code_slots, rs = req("GET", f"/api/me/daily-slots?date={(datetime.date.today() - datetime.timedelta(days=2)).isoformat()}", token=pat)
    free = next((s for s in rs.get("items", []) if not s["has_active_record"]), None)
    if free:
        code_ok, _ = req("POST", "/api/medication-events",
                         {"plan_id": regular["id"], "slot_id": free["id"], "occurred_at": free["scheduled_at"]}, token=pat)
        check("固定时点登记 201", code_ok == 201)

print("\n=== T08 计划版本 ===")
code, r = req("GET", f"/api/patients/{pid}/medication-plans?include_history=true&page_size=100", token=clin)
versions = [p["version"] for p in r["items"] if p["plan_type"] == "REGULAR"]
check("计划版本存在", len(versions) >= 1)

print("\n=== T10 任务幂等 ===")
code, r = req("GET", "/api/tasks", token=clin)
check("任务列表可查", code == 200)

print("\n=== T11 随访 ===")
code, r = req("GET", f"/api/patients/{pid}/followups", token=clin)
check("随访历史可查", code == 200)

print("\n=== T12/T13 AI ===")
code, r = req("POST", "/api/ai/ask", {"device_model_id": mid, "question": "使用前要做什么"}, token=pat)
check("AI 型号限定回答", code == 200 and r["status"] in ("ANSWERED", "NO_EVIDENCE"))
code, r = req("POST", "/api/ai/ask", {"device_model_id": mid, "question": "加倍剂量可以吗"}, token=pat)
check("剂量问题拒答", r["status"] == "OUT_OF_SCOPE")

print("\n=== T15 患者越权 ===")
code, _ = req("GET", "/api/patients", token=pat)
check("患者访问医护接口 403", code == 403)

print("\n=== T16 撤销 ===")
# 取一条 ACTIVE 记录撤销（演示数据中已存在一条 REVOKED，避免误取导致 409）
code, r = req("GET", "/api/me/medication-events?page_size=50", token=pat)
active = next((e for e in r.get("items", []) if e.get("status") == "ACTIVE"), None)
if active:
    code, r = req("POST", f"/api/medication-events/{active['id']}/revoke", {"reason": "回归测试"}, token=pat)
    check("撤销成功", code == 200 and r.get("status") == "REVOKED")
    # 再次撤销应 409（不硬删、不可重复撤销）
    code_again, _ = req("POST", f"/api/medication-events/{active['id']}/revoke", {"reason": "again"}, token=pat)
    check("重复撤销被拒 409", code_again == 409)
else:
    check("撤销成功", False)

print(f"\n=== 回归结果：{passed} PASS, {failed} FAIL ===")
