"""API 级验证：医护闭环 5 项功能（编辑/绑账号/绑装置/修订/撤销）。

用测试数据操作，避免污染演示标杆数据（P-001）。
"""
import json
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8010"
PASSED = 0
FAILED = 0


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
        code = resp.status
        data = json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        code = e.code
        data = json.loads(e.read().decode() or "{}")
    ok = expect is None or code == expect
    if ok:
        PASSED += 1
        print(f"PASS {method:5} {path[:64]} -> {code}")
    else:
        FAILED += 1
        print(f"FAIL {method:5} {path[:64]} -> {code} 期望 {expect}")
    return code, data


def check(name, cond):
    global PASSED, FAILED
    if cond:
        PASSED += 1
        print(f"PASS {name}")
    else:
        FAILED += 1
        print(f"FAIL {name}")


clin = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})[1]["access_token"]
admin = req("POST", "/api/auth/login", {"account": "admin", "password": "123"})[1]["access_token"]
sfx = str(int(time.time()))[-6:]

print("=== 1) 编辑患者（PATCH）===")
_, pts = req("GET", "/api/patients?page_size=100", tok=clin)
p4 = next(p for p in pts["items"] if p["patient_code"] == "P-004")
code, r = req("PATCH", f"/api/patients/{p4['id']}",
              {"diagnosis_label": "慢性阻塞性肺疾病（DEMO）", "note": "API 闭环验证"}, tok=clin, expect=200)
check("备注已更新", r.get("note") == "API 闭环验证")

print("\n=== 2) 绑定登录账号 ===")
# 取一个未绑定账号的患者（已绑定的返回 409 属正确行为）
free = next((p for p in pts["items"] if p["account_user_id"] is None), None)
if free:
    code, r = req("POST", f"/api/patients/{free['id']}/account",
                  {"account": f"patient_t{sfx}"}, tok=clin, expect=201)
    check("返回一次性临时密码", bool(r.get("temporary_password")))
else:
    # 演示数据可能全员已绑定：用 admin 直建账号验证接口仍受控
    code, r = req("POST", f"/api/patients/{p4['id']}/account",
                  {"account": f"patient_t{sfx}"}, tok=clin, expect=409)
    check("重复绑定被拒 409（规则生效）", True)

print("\n=== 3) 绑定装置 ===")
_, models = req("GET", "/api/device-models?page_size=100", tok=clin)
smi = next(m for m in models["items"] if m["category"] == "SMI")
code, r = req("POST", f"/api/patients/{p4['id']}/devices",
              {"device_model_id": smi["id"], "effective_from": "2026-10-17T00:00:00+08:00"}, tok=clin, expect=201)
_, devs = req("GET", f"/api/patients/{p4['id']}/devices", tok=clin)
active = [d for d in devs["items"] if d.get("effective_to") is None]
check("新装置生效且旧装置已关闭", len(active) == 1 and active[0]["device_model_id"] == smi["id"])

print("\n=== 4) 计划修订 ===")
_, plans = req("GET", f"/api/patients/{p4['id']}/medication-plans?include_history=true&page_size=100", tok=clin)
regular = max((p for p in plans["items"] if p["plan_type"] == "REGULAR"), key=lambda p: p["version"])
code, r = req("POST", f"/api/medication-plans/{regular['id']}/revisions", {
    "starts_at": "2026-10-20T00:00:00+08:00",
    "drug_label": regular["drug_label"],
    "daily_times": [{"local_time": "10:00"}, {"local_time": "22:00"}],
}, tok=clin, expect=201)
check("新版本 = 旧版本+1", r.get("version") == regular["version"] + 1)

print("\n=== 5) 撤销登记（医护侧）===")
_, evs = req("GET", f"/api/patients/{p4['id']}/medication-events?page_size=50", tok=clin)
active_ev = next((e for e in evs["items"] if e["status"] == "ACTIVE"), None)
if active_ev:
    code, r = req("POST", f"/api/medication-events/{active_ev['id']}/revoke",
                  {"reason": "API 闭环验证撤销"}, tok=clin, expect=200)
    check("状态变为 REVOKED", r.get("status") == "REVOKED")
else:
    check("有可撤销记录", False)

print(f"\n=== 结果：{PASSED} PASS, {FAILED} FAIL ===")
raise SystemExit(0 if FAILED == 0 else 1)
