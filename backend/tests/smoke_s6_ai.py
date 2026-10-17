"""S6 AI 故障回退测试（J045，T14）。

验证：AI 边界正常兜底（不 500）；核心业务接口不受 AI 影响。
"""
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
    print(f"{ok} {method:6} {path:55} -> {code} {raw[:100]}")
    return code, raw


_, r = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})
pat = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})
clin = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "admin", "password": "123"})
admin = json.loads(r)["access_token"]

print("\n=== T14 AI 边界兜底（无证据/越界不 500）===")
code, r = req("GET", "/api/device-models?page_size=100", token=pat, expect=200)
mid = json.loads(r)["items"][0]["id"]

# 无证据问题（未发布知识）→ NO_EVIDENCE，不是 500
req("POST", "/api/ai/ask", {"device_model_id": mid, "question": "完全无关的随机问题xyz"}, token=pat, expect=200)
# 越界问题 → OUT_OF_SCOPE
req("POST", "/api/ai/ask", {"device_model_id": mid, "question": "我该加大用药量吗"}, token=pat, expect=200)
# 敏感信息 → OUT_OF_SCOPE
req("POST", "/api/ai/ask", {"device_model_id": mid, "question": "我叫张三 13800138000"}, token=pat, expect=200)

print("\n=== T14 核心业务接口不受 AI 影响 ===")
# health
req("GET", "/api/health", expect=200)
# 患者档案
req("GET", "/api/me/patient", token=pat, expect=200)
# 用药计划
req("GET", "/api/me/medication-plans", token=pat, expect=200)
# 统计
req("GET", "/api/me/stats?from=2026-10-08&to=2026-10-15", token=pat, expect=200)
# 型号指导（医护）
req("GET", f"/api/device-models/{mid}/guide", token=clin, expect=200)

print("\n=== 跨型号隔离（问 A 型号不引用 B）===")
code, r = req("GET", "/api/device-models?page_size=100", token=pat, expect=200)
models = json.loads(r)["items"]
if len(models) >= 2:
    mid_b = models[1]["id"]
    # 患者只绑定了第一个型号，问第二个应 403
    req("POST", "/api/ai/ask", {"device_model_id": mid_b, "question": "使用前要做什么"}, token=pat, expect=403)

print("\n=== 测试完成 ===")
