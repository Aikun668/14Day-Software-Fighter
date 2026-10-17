"""S2 后端接口冒烟测试（J010/J011/J012/J015）。"""
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
    print(f"{ok} {method:6} {path:45} -> {code} {raw[:100]}")
    return code, raw


print("=== J011 管理员账号管理 ===")
_, r = req("POST", "/api/auth/login", {"account": "admin", "password": "123"})
admin_token = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})
clin_a_token = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "clinician_b", "password": "123"})
clin_b_token = json.loads(r)["access_token"]

# 管理员查用户列表
req("GET", "/api/admin/users", token=admin_token, expect=200)
# 非管理员查用户（应 403）
req("GET", "/api/admin/users", token=clin_a_token, expect=403)
# 管理员创建医护账号（唯一编号，保证脚本可反复运行）
import time as _time
_suffix = str(int(_time.time()))[-6:]
code, r = req("POST", "/api/admin/users", {"account": f"clinician_t{_suffix}", "role": "CLINICIAN"}, token=admin_token, expect=201)
print("  创建返回:", r[:200])

print("\n=== J015 患者档案 ===")
# 医护 A 建档（唯一编号）
_demo_code = f"P-T{_suffix}"
code, r = req("POST", "/api/patients", {"patient_code": _demo_code, "display_name": "测试患者T", "diagnosis_label": "哮喘", "note": "测试"}, token=clin_a_token, expect=201)
pid = json.loads(r)["id"]
print("  患者ID:", pid)
# 医护 A 查自己患者列表
req("GET", "/api/patients", token=clin_a_token, expect=200)
# 医护 B 查（应看不到该患者）
req("GET", "/api/patients", token=clin_b_token, expect=200)

print("\n=== J012 隔离（T02/T15）===")
# 医护 B 尝试访问医护 A 的患者（应 404，避免存在性泄露）
req("GET", f"/api/patients/{pid}", token=clin_b_token, expect=404)
# 医护 A 访问自己的患者（应 200）
req("GET", f"/api/patients/{pid}", token=clin_a_token, expect=200)
# 患者 X 访问医护接口（应 403）
_, r = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})
pat_token = json.loads(r)["access_token"]
req("GET", "/api/patients", token=pat_token, expect=403)
# 患者 X 访问本人档案（演示数据中 patient_x 已绑定 P-001 → 应 200）
req("GET", "/api/me/patient", token=pat_token, expect=200)

print("\n=== 测试完成 ===")
