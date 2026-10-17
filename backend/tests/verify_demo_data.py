"""验证演示数据的关键统计口径（P-001 应为 N=14/M=10/71.4%）。"""
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8010"


def req(method, path, body=None, token=None):
    r = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body else None,
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
        method=method,
    )
    try:
        resp = urllib.request.urlopen(r, timeout=15)
        return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


# 登录
_, r = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})
clin = r["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})
pat = r["access_token"]

print("=== 患者列表（clinician_a 负责的）===")
_, r = req("GET", "/api/patients?page_size=100", token=clin)
patients = r["items"]
print(f"  数量: {r['total']}")
for p in patients[:5]:
    print(f"    {p['patient_code']} {p['display_name']} {p['diagnosis_label']}")

# 找 P-001
p001 = next((p for p in patients if p["patient_code"] == "P-001"), None)
print(f"\n=== P-001 统计（目标 N=14, M=10, 71.4%）===")
code, s = req("GET", f"/api/patients/{p001['id']}/stats?from=2026-10-08&to=2026-10-15", token=clin)
if code == 200:
    print(f"  N={s['N']}  M={s['M']}  coverage={s['coverage_rate']}%")
    print(f"  source_breakdown={s['source_breakdown']}  basis={s['source_breakdown_basis']}")
    print(f"  missing={len(s['missing_slots'])} 个")
    ok = s["N"] == 14 and s["M"] == 10 and s["coverage_rate"] == 71.4
    print(f"  {'✅ 精确匹配 PRD T06' if ok else '❌ 不匹配'}")
else:
    print(f"  FAIL {code} {s}")

# 各患者覆盖率一览
print("\n=== 各患者覆盖率一览 ===")
for p in patients:
    code, s = req("GET", f"/api/patients/{p['id']}/stats?from=2026-10-08&to=2026-10-15", token=clin)
    if code == 200:
        cr = s["coverage_rate"]
        print(f"  {p['patient_code']} {p['display_name']:8} N={s['N']:3} M={s['M']:3} 覆盖率={cr if cr is not None else '暂无'}")

print("\n=== 患者端 P01 数据 ===")
code, me = req("GET", "/api/me/patient", token=pat)
print(f"  me/patient: {code}  姓名={me.get('display_name')}  装置数={len(me.get('current_devices', []))}")
code, rm = req("GET", "/api/me/reminders", token=pat)
print(f"  提醒: {code}  数量={len(rm.get('items', []))}")
for x in rm.get("items", []):
    print(f"    - {x['kind']}: {x['title']}")

print("\n=== 训练历史 ===")
code, th = req("GET", "/api/me/training-sessions?page_size=10", token=pat)
print(f"  数量={th.get('total')}")

print("\n=== AI 问答（应能 ANSWERED）===")
code, ask = req("POST", "/api/ai/ask", {"device_model_id": me["current_devices"][0]["device_model_id"], "question": "使用前要做什么"}, token=pat)
print(f"  status={ask.get('status')}  citations={len(ask.get('citations', []))}")
print(f"  答案: {ask.get('answer', '')[:120]}")
