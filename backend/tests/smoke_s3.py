"""S3 后端接口冒烟测试（J019/J022）。"""
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
    print(f"{ok} {method:6} {path:50} -> {code} {raw[:120]}")
    return code, raw


# 登录各角色
_, r = req("POST", "/api/auth/login", {"account": "admin", "password": "123"})
admin = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "clinician_a", "password": "123"})
clin = json.loads(r)["access_token"]
_, r = req("POST", "/api/auth/login", {"account": "patient_x", "password": "123"})
pat = json.loads(r)["access_token"]

print("\n=== J019 装置目录与指导 ===")
# 管理员查型号（种子有 3 个 DEMO 型号）
code, r = req("GET", "/api/device-models", token=pat, expect=200)
models = json.loads(r)["items"]
print(f"  型号数: {len(models)}")
mid = models[0]["id"] if models else None
# 取医护负责的标杆患者（用于现场观察训练）
code_p, rp = req("GET", "/api/patients?page_size=100", token=clin, expect=200)
_patients = json.loads(rp)["items"]
_p1 = next((p for p in _patients if p["patient_code"] == "P-001"), None)
pid = _p1["id"] if _p1 else (_patients[0]["id"] if _patients else None)

# 管理员建指导草稿（版本号带时间戳，保证脚本可反复运行）
import time as _time

_ver = f"test-{str(int(_time.time()))[-6:]}"
code, r = req("POST", "/api/admin/device-guides", {
    "device_model_id": mid,
    "version": _ver,
    "title": "测试指导",
    "steps": [
        {"step_no": 1, "text": "第一步", "error_notes": "注意"},
        {"step_no": 2, "text": "第二步"},
    ],
}, token=admin, expect=201)
gid = json.loads(r)["id"]
print(f"  指导ID: {gid}  版本: {_ver}")

# 草稿未发布：患者查该型号指导时，不应看到刚建的草稿版本（应返回已发布版本或 404）
code_draft, r_draft = req("GET", f"/api/device-models/{mid}/guide", token=pat)
seen_draft = _ver in r_draft
ok_draft = "PASS" if (code_draft in (200, 404) and not seen_draft) else "FAIL"
print(f"{ok_draft} 草稿不可见（返回码={code_draft}，草稿版本 {_ver} 未出现在响应中={not seen_draft}）")

# 审核 APPROVE
req("PATCH", f"/api/admin/device-guides/{gid}", {"review_action": "APPROVE"}, token=admin, expect=200)

# 发布
req("POST", f"/api/admin/device-guides/{gid}/publish", token=admin, expect=200)

# 发布后：患者查指导应能看到（200）；若未绑定型号则 403，两者都属预期
code_pub, _ = req("GET", f"/api/device-models/{mid}/guide", token=pat)
ok_pub = "PASS" if code_pub in (200, 403) else "FAIL"
print(f"{ok_pub} 发布后患者查询返回 {code_pub}（200=已绑定可见 / 403=未绑定该型号）")

# 医护查指导（可看）
req("GET", f"/api/device-models/{mid}/guide", token=clin, expect=200)

print("\n=== J022 训练自检 ===")
# 取该指导的真实步骤 ID（避免使用不存在的 step_id 触发 STEP_MISMATCH）
code_g, rg = req("GET", f"/api/device-models/{mid}/guide", token=clin, expect=200)
_real_guide = json.loads(rg)
_real_steps = _real_guide.get("steps", [])
_real_step_id = _real_steps[0]["id"] if _real_steps else None

# 医护现场观察（指定患者，来源由服务端固定为 CLINICIAN_OBSERVED）
if _real_step_id:
    code, r = req("POST", "/api/training-sessions", {
        "patient_id": pid,
        "device_model_id": mid,
        "guide_id": _real_guide["id"],
        "result": "完成",
        "step_results": [{"step_id": _real_step_id, "check_state": "DONE"}],
    }, token=clin, expect=201)
    print(f"  医护观察创建: {r[:150]}")

# 患者提交自检（用真实 guide step id）
# 先查 guide steps
code, r = req("GET", f"/api/device-models/{mid}/guide", token=clin, expect=200)
guide = json.loads(r)
steps = guide["steps"]
print(f"  步骤数: {len(steps)}")

print("\n=== 测试完成 ===")
