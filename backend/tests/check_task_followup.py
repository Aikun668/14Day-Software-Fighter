"""检查任务/随访 API 返回情况。"""
import json
import urllib.request

BASE = "http://127.0.0.1:8010"


def req(method, path, body=None, token=None):
    r = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body else None,
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
        method=method,
    )
    resp = urllib.request.urlopen(r, timeout=15)
    return json.loads(resp.read().decode() or "{}")


tok = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})["access_token"]

print("== 任务（按状态）==")
for st in ["OPEN", "IN_PROGRESS", "CLOSED"]:
    r = req("GET", f"/api/tasks?status={st}&page_size=50", token=tok)
    print(f"  {st}: {r['total']}")

r = req("GET", "/api/tasks?page_size=50", token=tok)
print(f"  全部: {r['total']}")
for t in r["items"]:
    print(f"    {t['status']:12} patient={t['patient_id'][:8]} created={t['created_at'][:19]}")

print("\n== 随访（各患者）==")
patients = req("GET", "/api/patients?page_size=100", token=tok)["items"]
total_f = 0
for p in patients:
    r = req("GET", f"/api/patients/{p['id']}/followups?page_size=50", token=tok)
    if r["total"]:
        total_f += r["total"]
        print(f"  {p['patient_code']} {p['display_name']}: {r['total']} 条")
print(f"  合计: {total_f}")
