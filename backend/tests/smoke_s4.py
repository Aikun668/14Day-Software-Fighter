"""S4 后端接口冒烟测试（J027/J029/J031）。"""
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
    print(f"{ok} {method:6} {path:55} -> {code} {raw[:150]}")
    return code, raw


# 登录
_, r = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})
clin = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})
pat = json.loads(r)["access_token"]

# 查 P-001 id 和 device_model_id
code, r = req("GET", "/api/patients", token=clin, expect=200)
p001 = [p for p in json.loads(r)["items"] if p["patient_code"] == "P-001"][0]
pid = p001["id"]
code, r = req("GET", "/api/device-models?page_size=100", token=clin, expect=200)
mid = json.loads(r)["items"][0]["id"]

print("\n=== J027 计划创建（7天每天2次）===")
# 计划区间基于今天动态计算：过去 7 个完整日，确保 14 个时点全部已到期、可进分母
import datetime as _dt

_today = _dt.date.today()
_start = _today - _dt.timedelta(days=7)
body = {
    "device_model_id": mid,
    "drug_label": "测试药",
    "plan_type": "REGULAR",
    "timezone": "Asia/Shanghai",
    "starts_at": f"{_start}T00:00:00+08:00",
    "ends_at": f"{_today}T00:00:00+08:00",
    "daily_times": [{"local_time": "08:00"}, {"local_time": "20:00"}],
}
code, r = req("POST", f"/api/patients/{pid}/medication-plans", body, token=clin, expect=201)
plan = json.loads(r)
plan_id = plan["id"]
print(f"  计划ID: {plan_id}, 版本: {plan['version']}")

print(f"\n=== 查询 daily-slots（{_start} ~ {_today}）===")
code, r = req("GET", f"/api/me/daily-slots?from={_start}&to={_today}", token=pat, expect=200)
slots = json.loads(r)["items"]
# 只看本计划生成的时点（避免与演示数据其他计划的时点混在一起）
slots = [s for s in slots if s["plan_id"] == plan_id]
print(f"  本计划时点数: {len(slots)}")

print("\n=== J029 登记 10 个不同时点 ===")
_for_first = slots[0]["scheduled_at"] if slots else f"{_start}T08:05:00+08:00"
for i, slot in enumerate(slots[:10]):
    body = {
        "plan_id": plan_id,
        "slot_id": slot["id"],
        "occurred_at": slot["scheduled_at"],
    }
    code, r = req("POST", "/api/medication-events", body, token=pat, expect=201)

print("\n=== J031 统计（应 N=14, M=10, 71.4%）===")
code, r = req("GET", f"/api/patients/{pid}/stats?from={_start}&to={_today}", token=clin, expect=200)
stats = json.loads(r)
print(f"  N={stats['N']}, M={stats['M']}, coverage={stats['coverage_rate']}")
print(f"  source_breakdown={stats['source_breakdown']}")
print(f"  missing={len(stats['missing_slots'])} 个")

print("\n=== J029 重复登记（同 slot 第2次，应 is_duplicate=true）===")
if slots:
    body = {"plan_id": plan_id, "slot_id": slots[0]["id"], "occurred_at": slots[0]["scheduled_at"]}
    code, r = req("POST", "/api/medication-events", body, token=pat, expect=201)
    print(f"  is_duplicate={json.loads(r)['is_duplicate']}")

print("\n=== 测试完成 ===")
