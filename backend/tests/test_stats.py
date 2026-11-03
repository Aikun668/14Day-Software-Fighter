"""统计测试：迁移自 smoke_s4.py（J027 计划、J029 登记、J031 统计）。03 D-2 SD-1。

期望值一律由本文件夹具自己构造的配置与记录计算：
- 不引用演示库，不写死某一次运行的 N。
- smoke_s4 标题里的「应 N=14」来自旧演示数据，不作为断言依据。
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.models import User
from app.models.device import DeviceModel
from app.models.medication import MedicationEvent, MedicationPlan, PlannedSlot
from app.models.patient import Patient

TZ = ZoneInfo("Asia/Shanghai")
DAILY_TIMES = ("08:00", "20:00")
WINDOW_DAYS = 7  # 统计窗口 [today-7, today)，全部为已到期日
REGISTER_COUNT = 10  # 登记的时点数 M；必须小于 N，才覆盖「有未登记」分支
SEED_TIMES = ("08:00", "14:00", "20:00")  # 完成率夹具：单日三个时点


def _today():
    return datetime.now(TZ).date()


def _window():
    today = _today()
    return today - timedelta(days=WINDOW_DAYS), today


def _local(day, hhmm):
    hour, minute = (int(x) for x in hhmm.split(":"))
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=TZ)


def _due_times(start, end):
    """窗口内按配置应生成、且已到期的本地时点（由配置计算，不查库）。"""
    now = datetime.now(TZ)
    due = []
    for i in range((end - start).days):
        for hhmm in DAILY_TIMES:
            at = _local(start + timedelta(days=i), hhmm)
            if at <= now:
                due.append(at)
    return due


@pytest.fixture
def bound_patient(db, clinician_headers, patient_headers):
    """林女士式患者：负责医护为 test_clinician，账号 test_patient_account 绑定该患者。"""
    clinician = db.query(User).filter(User.account == "test_clinician").one()
    account = db.query(User).filter(User.account == "test_patient_account").one()
    device = DeviceModel(category="pMDI", brand="测试", model_name="统计装置", status="ACTIVE")
    db.add(device)
    db.flush()
    patient = Patient(
        patient_code="P-S1",
        display_name="统计测试患者",
        assigned_clinician_id=clinician.id,
        account_user_id=account.id,
    )
    db.add(patient)
    db.commit()
    return {"pid": str(patient.id), "device_id": str(device.id)}


def _create_plan(client, clinician_headers, bound):
    start, _ = _window()
    body = {
        "device_model_id": bound["device_id"],
        "drug_label": "测试药",
        "plan_type": "REGULAR",
        "timezone": "Asia/Shanghai",
        "starts_at": f"{start.isoformat()}T00:00:00+08:00",
        "daily_times": [{"local_time": t} for t in DAILY_TIMES],
    }
    resp = client.post(f"/api/patients/{bound['pid']}/medication-plans", json=body, headers=clinician_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _generate_slots(client, patient_headers, plan_id):
    start, end = _window()
    resp = client.get(
        "/api/me/daily-slots",
        params={"from": start.isoformat(), "to": end.isoformat()},
        headers=patient_headers,
    )
    assert resp.status_code == 200, resp.text
    return [s for s in resp.json()["items"] if s["plan_id"] == plan_id]


def _register(client, patient_headers, plan_id, slot):
    resp = client.post(
        "/api/medication-events",
        json={"plan_id": plan_id, "slot_id": slot["id"], "occurred_at": slot["scheduled_at"]},
        headers=patient_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _patient_stats(client, clinician_headers, pid):
    start, end = _window()
    resp = client.get(
        f"/api/patients/{pid}/stats",
        params={"from": start.isoformat(), "to": end.isoformat()},
        headers=clinician_headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------- J027 / J029 / J031：单患者统计 ----------

def test_j031_stats_counts_match_fixture_records(client, clinician_headers, patient_headers, bound_patient):
    plan = _create_plan(client, clinician_headers, bound_patient)
    slots = _generate_slots(client, patient_headers, plan["id"])
    start, end = _window()
    expected_n = len(_due_times(start, end))
    assert len(slots) == expected_n

    registered = slots[:REGISTER_COUNT]
    for slot in registered:
        _register(client, patient_headers, plan["id"], slot)

    expected_m = len(registered)
    assert 0 < expected_m < expected_n  # 夹具须同时覆盖「已登记」与「未登记」

    stats = _patient_stats(client, clinician_headers, bound_patient["pid"])
    assert stats["N"] == expected_n
    assert stats["M"] == expected_m
    assert stats["coverage_rate"] == round(expected_m / expected_n * 100, 1)
    assert {m["slot_id"] for m in stats["missing_slots"]} == {s["id"] for s in slots[REGISTER_COUNT:]}
    assert stats["source_breakdown"] == {"PATIENT_REPORT": expected_m}


def test_duplicate_registration_flagged_without_inflating_m(client, clinician_headers, patient_headers, bound_patient):
    plan = _create_plan(client, clinician_headers, bound_patient)
    slots = _generate_slots(client, patient_headers, plan["id"])

    first = _register(client, patient_headers, plan["id"], slots[0])
    second = _register(client, patient_headers, plan["id"], slots[0])
    assert first["is_duplicate"] is False
    assert second["is_duplicate"] is True

    stats = _patient_stats(client, clinician_headers, bound_patient["pid"])
    assert stats["M"] == 1  # 同一时点只计一次
    assert stats["source_breakdown"] == {"PATIENT_REPORT": 2}  # 按登记事件计数（非去重），与 stats_matrix 文档一致


# ---------- 完成率非零分支 ----------

def _seed_patient_day(db, clinician_id, device_id, code, registered, day):
    """造一位患者在 day 当天的三个已到期时点，前 registered 个有登记。返回 (code, patient_id, N, M)。"""
    patient = Patient(patient_code=code, display_name=code, assigned_clinician_id=clinician_id)
    db.add(patient)
    db.flush()
    plan = MedicationPlan(
        patient_id=patient.id,
        device_model_id=device_id,
        plan_group_id=patient.id,
        drug_label="测试药",
        plan_type="REGULAR",
        starts_at=_local(day - timedelta(days=30), "00:00"),
    )
    db.add(plan)
    db.flush()
    slots = [
        PlannedSlot(plan_id=plan.id, patient_id=patient.id, scheduled_at=_local(day, t), state="ACTIVE")
        for t in SEED_TIMES
    ]
    # 明天 08:00 的未到期时点：不计入分母
    slots.append(PlannedSlot(
        plan_id=plan.id,
        patient_id=patient.id,
        scheduled_at=_local(_today() + timedelta(days=1), "08:00"),
        state="ACTIVE",
    ))
    db.add_all(slots)
    db.flush()
    for slot in slots[:registered]:
        db.add(MedicationEvent(
            patient_id=patient.id,
            plan_id=plan.id,
            slot_id=slot.id,
            source="PATIENT_REPORT",
            occurred_at=slot.scheduled_at,
            status="ACTIVE",
        ))
    return code, patient.id, len(SEED_TIMES), registered


def test_nonzero_completion_rate_rounding_and_missing_count(client, db, clinician_headers):
    clinician = db.query(User).filter(User.account == "test_clinician").one()
    device = DeviceModel(category="pMDI", brand="测试", model_name="完成率装置", status="ACTIVE")
    db.add(device)
    db.flush()
    day = _today() - timedelta(days=1)  # 昨天：已到期且 N>0
    seeded = [
        _seed_patient_day(db, clinician.id, device.id, "P-N1", 1, day),
        _seed_patient_day(db, clinician.id, device.id, "P-N2", 3, day),
    ]
    db.commit()

    expected_n = sum(n for _, _, n, _ in seeded)
    expected_m = sum(m for _, _, _, m in seeded)
    expected_missing = expected_n - expected_m
    expected_rate = round(expected_m / expected_n * 100, 1)
    # 夹具须落在 N>0 且 M≠N 的分支，且比率不是整数（取整路径被真正执行）
    assert expected_n > 0 and 0 < expected_m < expected_n
    assert expected_missing > 0
    assert expected_m * 100 % expected_n != 0

    day_str = day.isoformat()
    matrix = client.get(
        "/api/stats/matrix",
        params={"from": day_str, "to": _today().isoformat()},
        headers=clinician_headers,
    ).json()
    assert matrix["days"] == [day_str]
    by_code = {r["patient_code"]: r for r in matrix["rows"]}

    for code, _, n, m in seeded:
        cell = by_code[code]["cells"][0]
        assert (cell["N"], cell["M"], cell["missing"]) == (n, m, n - m)
        assert cell["coverage_rate"] == round(m / n * 100, 1)

    # 当日合计：其中 missing 之和即「还有 X 个未登记」的 X
    day_cells = [by_code[code]["cells"][0] for code, _, _, _ in seeded]
    assert sum(c["N"] for c in day_cells) == expected_n
    assert sum(c["M"] for c in day_cells) == expected_m
    assert sum(c["missing"] for c in day_cells) == expected_missing
    assert matrix["total_N"] == expected_n and matrix["total_M"] == expected_m
    assert matrix["coverage_rate"] == expected_rate

    overview = client.get(
        "/api/stats/overview",
        params={"from": day_str, "to": _today().isoformat()},
        headers=clinician_headers,
    ).json()
    assert overview["total_N"] == expected_n and overview["total_M"] == expected_m
    assert overview["coverage_rate"] == expected_rate

    # 单患者 J031 公式在非零分支上同样成立
    code, pid, n, m = seeded[0]
    stats = client.get(
        f"/api/patients/{pid}/stats",
        params={"from": day_str, "to": _today().isoformat()},
        headers=clinician_headers,
    ).json()
    assert (stats["N"], stats["M"], stats["coverage_rate"]) == (n, m, round(m / n * 100, 1))
