"""验证逐日趋势数据链路（前端 TrendChart 的数据源）。"""
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


tok = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})["access_token"]
pts = req("GET", "/api/patients?page_size=100", tok=tok)["items"]
p5 = next(p for p in pts if p["patient_code"] == "P-005")
p1 = next(p for p in pts if p["patient_code"] == "P-001")

for name, p in [("赵女士 P-005", p5), ("林女士 P-001", p1)]:
    print(f"=== {name} 近 7 日逐日覆盖率 ===")
    print("日期         N   M  覆盖率")
    today = datetime.date.today()
    rates = []
    for i in range(6, -1, -1):
        d0 = today - datetime.timedelta(days=i + 1)
        d1 = today - datetime.timedelta(days=i)
        s = req("GET", f"/api/patients/{p['id']}/stats?from={d0}&to={d1}", tok=tok)
        rates.append(s["coverage_rate"])
        bar = "█" * int((s["coverage_rate"] or 0) / 10)
        print(f"{d0}  {s['N']:3} {s['M']:3}  {str(s['coverage_rate']):>5}  {bar}")
    valid = [r for r in rates if r is not None]
    if len(valid) >= 2:
        delta = round(valid[-1] - valid[0], 1)
        print(f"区间变化: {delta:+} 个百分点\n")
