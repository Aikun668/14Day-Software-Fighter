"""计划修订、PRN 与撤销测试：迁移自 smoke_s4b.py（T08 版本修订、T09 PRN、T16 撤销）。03 D-2 SD-1。

与旧脚本的差异：
- 旧脚本依赖演示库里的 P-001 与固定日期 2026-10-08，本文件全部用夹具构造的计划与相对今日的日期。
- 断言内容与旧脚本一致：修订 201 且版本号递增；PRN 登记 201、source=PATIENT_REPORT、slot 为空；
  撤销 200 且状态 REVOKED；重复撤销 409。
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.models import User
from app.models.device import DeviceModel
from app.models.patient import Patient

TZ = ZoneInfo("Asia/Shanghai")
DAILY_TIMES = ("08:00", "20:00")


def _today():
    return datetime.now(TZ).date()


def _midnight_iso(day):
    return f"{day.isoformat()}T00:00:00+08:00"


@pytest.fixture
def bound(db, clinician_headers, patient_headers):
    """负责医护 test_clinician，账号 test_patient_account 绑定 P-R1；返回 pid 与 device_id。"""
    clinician = db.query(User).filter(User.account == "test_clinician").one()
    account = db.query(User).filter(User.account == "test_patient_account").one()
    device = DeviceModel(category="pMDI", brand="测试", model_name="修订装置", status="ACTIVE")
    db.add(device)
    db.flush()
    patient = Patient(
        patient_code="P-R1",
        display_name="修订测试患者",
        assigned_clinician_id=clinician.id,
        account_user_id=account.id,
    )
    db.add(patient)
    db.commit()
    return {"pid": str(patient.id), "device_id": str(device.id)}


@pytest.fixture
def regular_plan(client, clinician_headers, bound):
    """一个从 7 天前开始、未设结束日的固定计划（当前生效版本 v1）。"""
    body = {
        "device_model_id": bound["device_id"],
        "drug_label": "测试药",
        "plan_type": "REGULAR",
        "timezone": "Asia/Shanghai",
        "starts_at": _midnight_iso(_today() - timedelta(days=7)),
        "ends_at": None,
        "daily_times": [{"local_time": t} for t in DAILY_TIMES],
    }
    resp = client.post(f"/api/patients/{bound['pid']}/medication-plans", json=body, headers=clinician_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _revision_body():
    """修订请求体：自今日起 3 天前生效，不改时点。"""
    return {"starts_at": _midnight_iso(_today() - timedelta(days=3)), "ends_at": None, "daily_times": None}


@pytest.fixture
def other_patient_plan(db, client, clinician_headers, bound):
    """同一医护负责、未绑定账号的另一名患者及其固定计划（SEC-1：PATIENT 越权用例）。"""
    clinician = db.query(User).filter(User.account == "test_clinician").one()
    other = Patient(patient_code="P-R2", display_name="他人测试患者", assigned_clinician_id=clinician.id)
    db.add(other)
    db.commit()
    body = {
        "device_model_id": bound["device_id"],
        "drug_label": "他人药",
        "plan_type": "REGULAR",
        "timezone": "Asia/Shanghai",
        "starts_at": _midnight_iso(_today() - timedelta(days=7)),
        "ends_at": None,
        "daily_times": [{"local_time": t} for t in DAILY_TIMES],
    }
    resp = client.post(f"/api/patients/{other.id}/medication-plans", json=body, headers=clinician_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture
def other_clinician_headers(client, make_user):
    """另一名医护账号，未负责 P-R1。密码与 conftest 的 TEST_PASSWORD 相同。"""
    make_user("test_clinician_other", "CLINICIAN")
    resp = client.post("/api/auth/login", json={"account": "test_clinician_other", "password": "Test-1234"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ---------- T08 版本修订 ----------

def test_revision_creates_next_version_and_closes_previous(client, clinician_headers, regular_plan):
    rev_start = _today() - timedelta(days=3)
    resp = client.post(
        f"/api/medication-plans/{regular_plan['id']}/revisions",
        json={
            "starts_at": _midnight_iso(rev_start),
            "ends_at": None,
            "drug_label": "测试药V2",
            "daily_times": [{"local_time": "09:00"}, {"local_time": "21:00"}],
        },
        headers=clinician_headers,
    )
    assert resp.status_code == 201, resp.text
    new = resp.json()
    assert new["version"] == regular_plan["version"] + 1
    assert new["drug_label"] == "测试药V2"
    assert new["plan_group_id"] == regular_plan["plan_group_id"]
    assert sorted(t["local_time"][:5] for t in new["daily_times"]) == ["09:00", "21:00"]

    # 旧版本的结束日必须等于新版本的开始日（左闭右开，区间不重叠）
    history = client.get(
        f"/api/patients/{regular_plan['patient_id']}/medication-plans",
        params={"include_history": "true", "page_size": 100},
        headers=clinician_headers,
    ).json()["items"]
    old = next(p for p in history if p["id"] == regular_plan["id"])
    assert old["ends_at"] is not None
    assert datetime.fromisoformat(old["ends_at"]).astimezone(TZ).date() == rev_start


def test_revision_on_unknown_plan_returns_404(client, clinician_headers):
    import uuid

    resp = client.post(
        f"/api/medication-plans/{uuid.uuid4()}/revisions",
        json={"starts_at": _midnight_iso(_today()), "ends_at": None, "daily_times": None},
        headers=clinician_headers,
    )
    assert resp.status_code == 404


# ---------- T09 PRN 按需计划 ----------

def test_prn_plan_event_has_patient_source_and_no_slot(client, clinician_headers, patient_headers, bound):
    resp = client.post(
        f"/api/patients/{bound['pid']}/medication-plans",
        json={
            "device_model_id": bound["device_id"],
            "drug_label": "按需药",
            "plan_type": "PRN",
            "starts_at": _midnight_iso(_today() - timedelta(days=7)),
            "daily_times": [],
        },
        headers=clinician_headers,
    )
    assert resp.status_code == 201, resp.text
    prn = resp.json()

    event = client.post(
        "/api/medication-events",
        json={
            "plan_id": prn["id"],
            "slot_id": None,
            "occurred_at": datetime.now(TZ).isoformat(timespec="seconds"),
        },
        headers=patient_headers,
    )
    assert event.status_code == 201, event.text
    body = event.json()["event"]
    assert body["source"] == "PATIENT_REPORT"
    assert body["slot_id"] is None


def test_prn_event_rejects_slot_id(client, clinician_headers, patient_headers, bound):
    import uuid

    resp = client.post(
        f"/api/patients/{bound['pid']}/medication-plans",
        json={
            "device_model_id": bound["device_id"],
            "drug_label": "按需药",
            "plan_type": "PRN",
            "starts_at": _midnight_iso(_today() - timedelta(days=7)),
            "daily_times": [],
        },
        headers=clinician_headers,
    )
    prn = resp.json()
    bad = client.post(
        "/api/medication-events",
        json={"plan_id": prn["id"], "slot_id": str(uuid.uuid4()), "occurred_at": datetime.now(TZ).isoformat()},
        headers=patient_headers,
    )
    assert bad.status_code == 422
    assert bad.json()["detail"]["code"] == "PRN_NO_SLOT"


# ---------- T16 撤销登记 ----------

def _register_one(client, clinician_headers, patient_headers, regular_plan):
    start = _today() - timedelta(days=7)
    slots = client.get(
        "/api/me/daily-slots",
        params={"from": start.isoformat(), "to": _today().isoformat()},
        headers=patient_headers,
    ).json()["items"]
    slot = next(s for s in slots if s["plan_id"] == regular_plan["id"])
    resp = client.post(
        "/api/medication-events",
        json={"plan_id": regular_plan["id"], "slot_id": slot["id"], "occurred_at": slot["scheduled_at"]},
        headers=patient_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["event"]["id"]


def test_revoke_marks_event_revoked(client, clinician_headers, patient_headers, regular_plan):
    event_id = _register_one(client, clinician_headers, patient_headers, regular_plan)
    resp = client.post(
        f"/api/medication-events/{event_id}/revoke",
        json={"reason": "误登记"},
        headers=patient_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "REVOKED"


def test_second_revoke_returns_409(client, clinician_headers, patient_headers, regular_plan):
    event_id = _register_one(client, clinician_headers, patient_headers, regular_plan)
    first = client.post(f"/api/medication-events/{event_id}/revoke", json={"reason": "误登记"}, headers=patient_headers)
    assert first.status_code == 200, first.text
    again = client.post(f"/api/medication-events/{event_id}/revoke", json={"reason": "again"}, headers=patient_headers)
    assert again.status_code == 409
    assert again.json()["detail"]["code"] == "ALREADY_REVOKED"


# ---------- SEC-1 修订访问控制 ----------
# 既有规则（plans.py 的 get_patient_for_clinician）：PATIENT 一律 403 FORBIDDEN；
# CLINICIAN 访问非负责患者的计划 404 NOT_FOUND；ADMIN 一律 404 NOT_FOUND（老板裁定，临床写操作，与 get_patient_for_clinician 一致）。

def test_patient_cannot_revise_own_plan_returns_403(client, patient_headers, regular_plan):
    resp = client.post(
        f"/api/medication-plans/{regular_plan['id']}/revisions",
        json=_revision_body(),
        headers=patient_headers,
    )
    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"]["code"] == "FORBIDDEN"


def test_patient_cannot_revise_other_patient_plan_returns_403(client, patient_headers, other_patient_plan):
    resp = client.post(
        f"/api/medication-plans/{other_patient_plan['id']}/revisions",
        json=_revision_body(),
        headers=patient_headers,
    )
    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"]["code"] == "FORBIDDEN"


def test_clinician_cannot_revise_unassigned_patient_plan_returns_404(client, other_clinician_headers, regular_plan):
    resp = client.post(
        f"/api/medication-plans/{regular_plan['id']}/revisions",
        json=_revision_body(),
        headers=other_clinician_headers,
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"]["code"] == "NOT_FOUND"


def test_assigned_clinician_can_revise_plan_returns_201(client, clinician_headers, regular_plan):
    resp = client.post(
        f"/api/medication-plans/{regular_plan['id']}/revisions",
        json=_revision_body(),
        headers=clinician_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["version"] == regular_plan["version"] + 1


def test_admin_cannot_revise_any_plan_returns_404(client, admin_headers, regular_plan):
    resp = client.post(
        f"/api/medication-plans/{regular_plan['id']}/revisions",
        json=_revision_body(),
        headers=admin_headers,
    )
    assert resp.status_code == 404, resp.text
    detail = resp.json()["detail"]
    assert detail["code"] == "NOT_FOUND"
    assert set(detail) == {"code", "message", "details"}
