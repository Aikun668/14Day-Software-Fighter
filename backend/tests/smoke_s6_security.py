"""S6 越权与隔离测试（J044，T02/T15）。"""
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
    print(f"{ok} {method:6} {path:55} -> {code} {raw[:100]}")
    return code, raw


# 登录
_, r = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})
clin_a = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "clinician_b", "password": "123"})
clin_b = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})
pat_x = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "patient_y", "password": "123"})
pat_y = json.loads(r)["access_token"]

print("\n=== T02 医护越权隔离 ===")
# 医护 A 的患者列表
code, r = req("GET", "/api/patients", token=clin_a, expect=200)
clin_a_patients = json.loads(r)["items"]
print(f"  医护 A 患者数: {len(clin_a_patients)}")
if clin_a_patients:
    pid = clin_a_patients[0]["id"]
    # 医护 B 访问 A 的患者详情 → 404
    req("GET", f"/api/patients/{pid}", token=clin_b, expect=404)
    # 医护 B 访问 A 的患者统计 → 404
    req("GET", f"/api/patients/{pid}/stats?from=2026-10-08&to=2026-10-15", token=clin_b, expect=404)
    # 医护 B 访问 A 的患者用药事件 → 404
    req("GET", f"/api/patients/{pid}/medication-events", token=clin_b, expect=404)
    # 医护 B 访问 A 的患者训练 → 404
    req("GET", f"/api/patients/{pid}/training-sessions", token=clin_b, expect=404)

print("\n=== T15 患者越权隔离 ===")
# patient_y 尝试访问 patient_x 的记录（通过医护接口，应 403）
req("GET", "/api/patients", token=pat_y, expect=403)

print("\n=== source 伪造防护 ===")
# 患者伪造 source=CLINICIAN_OBSERVED / DEVICE
# 先取一个 plan_id 和 slot_id
code, r = req("GET", "/api/me/medication-plans", token=pat_x, expect=200)
plans = json.loads(r)["items"]
if plans:
    # 按需（PRN）登记用于验证 source 重写：固定计划必须带 slot，故用 PRN 计划
    prn = next((p for p in plans if p["plan_type"] == "PRN"), None)
    if prn:
        plan_id = prn["id"]
        # 伪造 DEVICE source → 应 422
        body = {"plan_id": plan_id, "slot_id": None, "occurred_at": "2026-10-10T08:05:00+08:00", "source": "DEVICE"}
        req("POST", "/api/medication-events", body, token=pat_x, expect=422)
        # 伪造 CLINICIAN_OBSERVED → 服务端重写为 PATIENT_REPORT
        code, r = req("POST", "/api/medication-events", body={"plan_id": plan_id, "slot_id": None, "occurred_at": "2026-10-10T08:05:00+08:00", "source": "CLINICIAN_OBSERVED"}, token=pat_x, expect=201)
        evt = json.loads(r)["event"]
        src = evt["source"]
        ok = "PASS" if src == "PATIENT_REPORT" else "FAIL"
        print(f"{ok} 患者 source 重写 -> 实际 source={src}")
    else:
        print("  患者无 PRN 计划，跳过 source 重写校验")

print("\n=== 停用账号后旧 Token 失效 ===")
import time as _time

_, r = req("POST", "/api/auth/login", {"account": "admin", "password": "123"})
admin = json.loads(r)["access_token"]
# 创建临时医护账号（唯一账号名，保证脚本可反复运行）
_temp_acct = f"temp_doc_{str(int(_time.time()))[-6:]}"
code, r = req("POST", "/api/admin/users", {"account": _temp_acct, "role": "CLINICIAN"}, token=admin, expect=201)
temp_user = json.loads(r)
temp_id = temp_user["id"]
temp_pwd = temp_user.get("temporary_password") or "123"
# 登录拿 token
_, r = req("POST", "/api/auth/login", {"account": _temp_acct, "password": temp_pwd})
temp_token = json.loads(r)["access_token"]
# 停用
req("PATCH", f"/api/admin/users/{temp_id}", {"status": "DISABLED"}, token=admin, expect=200)
# 旧 token 访问 → 401
req("GET", "/api/me", token=temp_token, expect=401)

print("\n=== 测试完成 ===")
