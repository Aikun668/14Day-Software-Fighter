"""S4 补充测试：版本修订(T08)、PRN(T09)、撤销(T16)。"""
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
    print(f"{ok} {method:6} {path:55} -> {code} {raw[:140]}")
    return code, raw


_, r = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})
clin = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})
pat = json.loads(r)["access_token"]

code, r = req("GET", "/api/patients", token=clin)
pid = [p for p in json.loads(r)["items"] if p["patient_code"] == "P-001"][0]["id"]
code, r = req("GET", "/api/device-models?page_size=100", token=clin)
mid = json.loads(r)["items"][0]["id"]

print("\n=== T08 版本修订 ===")
# 找现有 REGULAR 计划（取版本号最大的那条，即当前生效版本）
import datetime as _dt

code, r = req("GET", f"/api/patients/{pid}/medication-plans?include_history=true&page_size=100", token=clin)
plans = json.loads(r)["items"]
regular = [p for p in plans if p["plan_type"] == "REGULAR"]
if regular:
    plan = max(regular, key=lambda p: p["version"])
    # 修订起点紧接当前计划结束时间之后，避免与既有版本区间重叠（后端有重叠校验）
    base = plan["ends_at"] or f"{_dt.date.today()}T00:00:00+08:00"
    rev_start = base if "T" in str(base) else f"{base}T00:00:00+08:00"
    code, r = req("POST", f"/api/medication-plans/{plan['id']}/revisions", {
        "starts_at": rev_start,
        "ends_at": None,
        "drug_label": "测试药V2",
        "daily_times": [{"local_time": "09:00"}, {"local_time": "21:00"}],
    }, token=clin, expect=201)
    print(f"  新版本: {json.loads(r)['version']}")
else:
    print("  无 REGULAR 计划，跳过")

print("\n=== T09 PRN 计划 ===")
code, r = req("POST", f"/api/patients/{pid}/medication-plans", {
    "device_model_id": mid, "drug_label": "按需药", "plan_type": "PRN",
    "starts_at": "2026-10-08T00:00:00+08:00", "daily_times": [],
}, token=clin, expect=201)
prn_plan = json.loads(r)
# PRN 登记（slot_id 必须 null）
code, r = req("POST", "/api/medication-events", {
    "plan_id": prn_plan["id"], "slot_id": None,
    "occurred_at": "2026-10-12T15:00:00+08:00",
}, token=pat, expect=201)
print(f"  PRN 登记 source={json.loads(r)['event']['source']}")

print("\n=== T16 撤销登记 ===")
# 取一条患者事件并撤销
code, r = req("GET", "/api/me/medication-events?page_size=1", token=pat, expect=200)
events = json.loads(r)["items"]
if events:
    eid = events[0]["id"]
    code, r = req("POST", f"/api/medication-events/{eid}/revoke", {"reason": "误登记"}, token=pat, expect=200)
    print(f"  撤销后 status={json.loads(r)['status']}")
    # 再次撤销应 409
    code, r = req("POST", f"/api/medication-events/{eid}/revoke", {"reason": "again"}, token=pat, expect=409)
else:
    print("  无事件，跳过")

print("\n=== 测试完成 ===")
