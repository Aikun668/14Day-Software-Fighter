"""API 级验证：医护闭环 5 项功能（编辑/绑账号/绑装置/修订/撤销）。

不碰演示标杆数据：脚本自建一次性测试患者（P-T*）与其登录账号，
结束时直连库清理干净（本系统设计上就没有「删除患者」接口）。
"""
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _db import cleanup_patient_by_code  # noqa: E402

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
        print(f"FAIL {method:5} {path[:64]} -> {code} 期望 {expect} {str(data)[:120]}")
    return code, data


def check(name, cond, detail=""):
    global PASSED, FAILED
    if cond:
        PASSED += 1
        print(f"PASS {name}")
    else:
        FAILED += 1
        print(f"FAIL {name} {detail}")


clin = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})[1]["access_token"]
sfx = str(int(time.time()))[-6:]
test_code = f"P-T{sfx}"
test_account = f"patient_t{sfx}"

print("=== 0) 自建测试患者（不污染演示数据）===")
code, created = req("POST", "/api/patients", {
    "patient_code": test_code, "display_name": "闭环测试患者",
    "diagnosis_label": "测试标签（DEMO）", "note": "smoke_clinic_loop 临时数据",
}, tok=clin, expect=201)
pid = created["id"]

try:
    print("\n=== 1) 编辑患者（PATCH）===")
    code, r = req("PATCH", f"/api/patients/{pid}",
                  {"diagnosis_label": "慢性阻塞性肺疾病（DEMO）", "note": "API 闭环验证"}, tok=clin, expect=200)
    check("备注已更新", r.get("note") == "API 闭环验证")
    check("PATCH 返回 PatientDetail（含 note 字段）", "note" in r)

    print("\n=== 2) 绑定登录账号 ===")
    code, r = req("POST", f"/api/patients/{pid}/account",
                  {"account": test_account}, tok=clin, expect=201)
    check("返回一次性临时密码", bool(r.get("temporary_password")))
    code, r = req("POST", f"/api/patients/{pid}/account",
                  {"account": test_account + "b"}, tok=clin, expect=409)
    check("重复绑定被拒 409（规则生效）", r.get("detail", {}).get("code") == "ACCOUNT_ALREADY_BOUND", str(r)[:160])

    print("\n=== 3) 绑定装置 ===")
    _, models = req("GET", "/api/device-models?page_size=100", tok=clin)
    smi = next(m for m in models["items"] if m["category"] == "SMI")
    code, r = req("POST", f"/api/patients/{pid}/devices",
                  {"device_model_id": smi["id"], "effective_from": "2026-10-17T00:00:00+08:00"}, tok=clin, expect=201)
    _, devs = req("GET", f"/api/patients/{pid}/devices", tok=clin)
    active = [d for d in devs["items"] if d.get("effective_to") is None]
    check("新装置生效且旧装置已关闭", len(active) == 1 and active[0]["device_model_id"] == smi["id"])

    print("\n=== 4) 计划修订 ===")
    code, regular = req("POST", f"/api/patients/{pid}/medication-plans", {
        "device_model_id": smi["id"], "drug_label": "测试药物（DEMO）", "plan_type": "REGULAR",
        "timezone": "Asia/Shanghai", "starts_at": "2026-10-10T00:00:00+08:00",
        "daily_times": [{"local_time": "08:00"}, {"local_time": "20:00"}],
    }, tok=clin, expect=201)
    code, r = req("POST", f"/api/medication-plans/{regular['id']}/revisions", {
        "starts_at": "2026-10-20T00:00:00+08:00",
        "drug_label": regular["drug_label"],
        "daily_times": [{"local_time": "10:00"}, {"local_time": "22:00"}],
    }, tok=clin, expect=201)
    check("新版本 = 旧版本+1", r.get("version") == regular["version"] + 1, str(r)[:160])

    print("\n=== 5) 撤销登记（医护侧）===")
    code, prn = req("POST", f"/api/patients/{pid}/medication-plans", {
        "device_model_id": smi["id"], "drug_label": "按需测试药物（DEMO）", "plan_type": "PRN",
        "timezone": "Asia/Shanghai", "starts_at": "2026-10-10T00:00:00+08:00", "daily_times": [],
    }, tok=clin, expect=201)
    code, ev = req("POST", "/api/medication-events", {
        "patient_id": pid, "plan_id": prn["id"], "slot_id": None,
        "occurred_at": "2026-10-17T09:00:00+08:00", "note": "闭环验证用按需登记",
    }, tok=clin, expect=201)
    event_id = ev["event"]["id"]
    code, r = req("POST", f"/api/medication-events/{event_id}/revoke",
                  {"reason": "API 闭环验证撤销"}, tok=clin, expect=200)
    check("状态变为 REVOKED", r.get("status") == "REVOKED")
    req("POST", f"/api/medication-events/{event_id}/revoke", {"reason": "再次撤销"}, tok=clin, expect=409)
    check("重复撤销被拒 409", True)
finally:
    removed = cleanup_patient_by_code(test_code)
    print(f"\n[清理] 测试患者 {test_code} 已删除 {removed} 条（含绑定账号与业务数据）")

print(f"\n=== 结果：{PASSED} PASS, {FAILED} FAIL ===")
raise SystemExit(0 if FAILED == 0 else 1)
