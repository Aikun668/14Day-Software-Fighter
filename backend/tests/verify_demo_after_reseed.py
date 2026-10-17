"""验证重生成后的演示数据（覆盖率 + 今日时点）。"""
import datetime
import json
import urllib.request

BASE = "http://127.0.0.1:8010"


def req(method, path, body=None, tok=None):
    r = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body else None,
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {tok}"} if tok else {})},
        method=method,
    )
    return json.loads(urllib.request.urlopen(r, timeout=15).read().decode() or "{}")


today = datetime.date.today()
week_ago = today - datetime.timedelta(days=7)

tok = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})["access_token"]
ptok = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})["access_token"]

patients = req("GET", "/api/patients?page_size=100", tok=tok)["items"]
p1 = next(p for p in patients if p["patient_code"] == "P-001")

print("=== P-001 近 7 天统计（目标 N=14 / M=10 / 71.4%）===")
s = req("GET", f"/api/patients/{p1['id']}/stats?from={week_ago}&to={today}", tok=tok)
print(f"  区间 {week_ago} ~ {today}")
print(f"  N={s['N']}  M={s['M']}  覆盖率={s['coverage_rate']}%")
print(f"  source_breakdown={s['source_breakdown']}")
ok = s["N"] == 14 and s["M"] == 10 and s["coverage_rate"] == 71.4
print(f"  {'✅ 匹配 PRD T06' if ok else '⚠️ 不匹配（可能因版本切换）'}")

print("\n=== 患者端今日时点 ===")
slots = req("GET", f"/api/me/daily-slots?date={today}", tok=ptok)
print(f"  今日时点数：{len(slots['items'])}")
for sl in slots["items"]:
    print(f"    {sl['scheduled_at'][:19]}  已登记={sl['has_active_record']}")

print("\n=== 患者端提醒 ===")
rm = req("GET", "/api/me/reminders", tok=ptok)
for x in rm["items"]:
    print(f"    [{x['kind']}] {x['title']}")

print("\n=== 各患者覆盖率 ===")
for p in patients[:8]:
    st = req("GET", f"/api/patients/{p['id']}/stats?from={week_ago}&to={today}", tok=tok)
    cr = st["coverage_rate"]
    print(f"  {p['patient_code']} {p['display_name']:8} N={st['N']:3} M={st['M']:3} {cr if cr is not None else '—'}")
