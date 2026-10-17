"""排查患者列表部分行为空的问题。"""
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
r = req("GET", "/api/patients?page_size=100", token=tok)
print(f"总数: {r['total']}\n")
print(f"{'编号':<8}{'姓名':<12}{'诊断':<28}{'账号':<10}")
print("-" * 62)
for p in r["items"]:
    acct = "已绑定" if p["account_user_id"] else "未绑定"
    print(f"{p['patient_code']:<8}{str(p['display_name']):<12}{str(p['diagnosis_label']):<28}{acct:<10}")
