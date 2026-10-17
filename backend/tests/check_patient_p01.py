"""查看患者端 P01 可用数据（只读排查）。"""
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


tok = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})["access_token"]
me = req("GET", "/api/me/patient", tok=tok)
print("本人:", me["display_name"], me["patient_code"], "装置数:", len(me.get("current_devices", [])))

today = datetime.date.today().isoformat()
print("\n今天:", today)
slots = req("GET", f"/api/me/daily-slots?date={today}", tok=tok)
print("今日时点数:", len(slots["items"]))
for s in slots["items"]:
    print(f"   {s['scheduled_at']}  state={s['state']}  has_record={s['has_active_record']}")

# 演示区间（10-08~10-15）内的时点
slots2 = req("GET", "/api/me/daily-slots?from=2026-10-13&to=2026-10-16", tok=tok)
print("\n10-13~10-15 时点数:", len(slots2["items"]))

rm = req("GET", "/api/me/reminders", tok=tok)
print("\n提醒:", [(x["kind"], x["title"]) for x in rm["items"]])

plans = req("GET", "/api/me/medication-plans", tok=tok)
print("\n本人计划:")
for p in plans["items"]:
    print(f"   v{p['version']} {p['drug_label']} type={p['plan_type']} {p['starts_at'][:10]}~{(p['ends_at'] or '至今')[:10]}")
    for t in p.get("daily_times", []):
        print(f"      时点 {t['local_time']}")
