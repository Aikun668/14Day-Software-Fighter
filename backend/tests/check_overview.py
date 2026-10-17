"""验证工作台概览接口 /api/stats/overview。"""
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


tok = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})["access_token"]
d = req("GET", "/api/stats/overview?from=2026-10-10&to=2026-10-17", tok=tok)
print("患者数:", d["patient_count"], " 有计划:", d["planned_count"])
print("聚合 N:", d["total_N"], " M:", d["total_M"], " 覆盖率:", d["coverage_rate"])
print("\n紧急排序（缺失多的在前，N=0 垫底）:")
for row in d["rows"]:
    print(f"  {row['patient_code']} {row['display_name']:6} N={row['N']:3} M={row['M']:3} 缺失={row['missing_count']:3} rate={row['coverage_rate']}")

# 患者不应能访问
ptok = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})["access_token"]
import urllib.error
r = urllib.request.Request(BASE + "/api/stats/overview?from=2026-10-10&to=2026-10-17",
                           headers={"Authorization": f"Bearer {ptok}"})
try:
    urllib.request.urlopen(r)
    print("\nFAIL 患者竟能访问 overview")
except urllib.error.HTTPError as e:
    print(f"\n患者访问 overview: HTTP {e.code} {'PASS' if e.code == 403 else 'FAIL'}")
