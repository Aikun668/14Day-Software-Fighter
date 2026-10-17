"""验证李先生 P-004 的装置绑定结果。"""
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
p4 = next(p for p in pts if p["patient_code"] == "P-004")
devs = req("GET", f"/api/patients/{p4['id']}/devices", tok=tok)
print("P-004 装置绑定：", devs["total"], "条")
for d in devs["items"]:
    print(f"  model={d['device_model_id'][:8]}... from={d['effective_from'][:10]} to={str(d['effective_to'])[:10]}")

# 姓名（编辑过的）
print("姓名:", p4["display_name"])
