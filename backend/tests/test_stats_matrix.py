"""覆盖矩阵 GET /api/stats/matrix（03 A-1，TDD）。

数据全部在 inhaler_test 中造：过去 7 天每天 08:00 一个时点，未来 1 天一个时点（未到期，不进入 N）。
林女士式场景：P-A 的 7 个到期时点中登记 5 个（含 1 个已撤销登记，不计入）=> 5/7 = 71.4%。
注意：这是公式层面的夹具校验；演示库中 P-001 的真实数值由演示库验收单独核对（见交接）。
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.models import User
from app.models.device import DeviceModel
from app.models.medication import MedicationEvent, MedicationPlan, PlannedSlot
from app.models.patient import Patient
from app.services.stats_matrix import build_coverage_matrix, coverage_rate

TZ = ZoneInfo("Asia/Shanghai")
MATRIX = "/api/stats/matrix"
OVERVIEW = "/api/stats/overview"


def _window_dates():
    today = datetime.now(TZ).date()
    # 过去 7 天 + 未来 1 天：[today-7, today+2)
    return today - timedelta(days=7), today + timedelta(days=2)


def _slot_at(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, 8, 0, tzinfo=TZ)


def _seed_patient(db, code: str, name: str, clinician_id) -> Patient:
    patient = Patient(patient_code=code, display_name=name, assigned_clinician_id=clinician_id)
    db.add(patient)
    db.flush()
    return patient


def _seed_plan(db, patient: Patient, device_id) -> MedicationPlan:
    plan = MedicationPlan(
        patient_id=patient.id,
        device_model_id=device_id,
        plan_group_id=patient.id,
        drug_label="测试药",
        plan_type="REGULAR",
        starts_at=_slot_at(datetime.now(TZ).date() - timedelta(days=30)),
    )
    db.add(plan)
    db.flush()
    return plan


def _seed_slots(db, plan: MedicationPlan, patient: Patient, days) -> list[PlannedSlot]:
    slots = []
    for day in days:
        slot = PlannedSlot(plan_id=plan.id, patient_id=patient.id, scheduled_at=_slot_at(day))
        db.add(slot)
        slots.append(slot)
    db.flush()
    return slots


def _seed_event(db, plan, patient, slot, status="ACTIVE"):
    db.add(MedicationEvent(
        patient_id=patient.id,
        plan_id=plan.id,
        slot_id=slot.id,
        source="PATIENT_REPORT",
        occurred_at=slot.scheduled_at,
        status=status,
    ))


@pytest.fixture
def world(db, clinician_headers):
    """P-A（林女士式）、P-B（他人患者）、P-C（无计划）。返回 (headers, 各患者 id 字典)。"""
    clinician = db.query(User).filter(User.account == "test_clinician").one()
    device = DeviceModel(category="pMDI", brand="测试", model_name="测试装置", status="ACTIVE")
    db.add(device)
    db.flush()

    start, end = _window_dates()
    past_days = [start + timedelta(days=i) for i in range(7)]  # today-7 .. today-1
    future_day = end - timedelta(days=1)  # today+1，未到期

    # P-A：负责医护为 clinician
    pa = _seed_patient(db, "P-A", "林女士", clinician.id)
    plan_a = _seed_plan(db, pa, device.id)
    slots_a = _seed_slots(db, plan_a, pa, past_days)
    _seed_slots(db, plan_a, pa, [future_day])
    # 登记 5 个（前 5 天），第 6 天仅有撤销登记，第 7 天无登记
    for slot in slots_a[:5]:
        _seed_event(db, plan_a, pa, slot)
    _seed_event(db, plan_a, pa, slots_a[5], status="REVOKED")

    # P-B：他人患者，全部已登记，不应出现在 clinician 的矩阵中
    other_clinician = User(
        account="other_clinician", password_hash="x", role="CLINICIAN", status="ACTIVE",
        must_change_password=False,
    )
    db.add(other_clinician)
    db.flush()
    pb = _seed_patient(db, "P-B", "他人患者", other_clinician.id)
    plan_b = _seed_plan(db, pb, device.id)
    for slot in _seed_slots(db, plan_b, pb, past_days):
        _seed_event(db, plan_b, pb, slot)

    # P-C：负责医护，但无任何计划时点
    pc = _seed_patient(db, "P-C", "无计划患者", clinician.id)

    # P-D：全部已登记（缺失 0）；P-E：7 个中只登记 2 个（缺失 5）。
    # 排序期望：缺失多在前 => P-E(5) > P-A(2) > P-D(0)，且 P-E 编号靠后，能区分「按缺失排」与「按编号排」
    pd = _seed_patient(db, "P-D", "全登记患者", clinician.id)
    plan_d = _seed_plan(db, pd, device.id)
    for slot in _seed_slots(db, plan_d, pd, past_days):
        _seed_event(db, plan_d, pd, slot)
    pe = _seed_patient(db, "P-E", "缺失较多患者", clinician.id)
    plan_e = _seed_plan(db, pe, device.id)
    slots_e = _seed_slots(db, plan_e, pe, past_days)
    for slot in slots_e[:2]:
        _seed_event(db, plan_e, pe, slot)
    db.commit()
    return {"A": pa.id, "B": pb.id, "C": pc.id, "start": start, "end": end, "past": past_days, "future": future_day}


def _get(client, headers, start, end):
    return client.get(MATRIX, params={"from": start.isoformat(), "to": end.isoformat()}, headers=headers)


# ---------- 纯函数（服务层）----------

def test_coverage_rate_rounds_to_one_decimal_and_null_when_no_planned_slots():
    assert coverage_rate(5, 7) == 71.4
    assert coverage_rate(2, 3) == 66.7
    assert coverage_rate(0, 0) is None  # 无计划：null，不是 0%


def test_build_matrix_counts_only_due_slots_and_marks_empty_days_null():
    from types import SimpleNamespace as NS

    d1, d2 = date(2026, 10, 10), date(2026, 10, 11)
    patient = NS(id="p1", patient_code="P-1", display_name="甲")
    slots = [
        NS(id="s1", patient_id="p1", scheduled_at=datetime(2026, 10, 10, 8, 0, tzinfo=TZ)),
        NS(id="s2", patient_id="p1", scheduled_at=datetime(2026, 10, 10, 20, 0, tzinfo=TZ)),
    ]
    result = build_coverage_matrix(
        from_str="2026-10-10",
        to_str="2026-10-12",
        patients=[patient],
        slots=slots,
        covered_slot_ids={"s1"},
        days=[d1, d2],
        tz_name="Asia/Shanghai",
    )
    row = result.rows[0]
    assert result.days == ["2026-10-10", "2026-10-11"]
    assert row.N == 2 and row.M == 1 and row.coverage_rate == 50.0
    assert row.cells[0].N == 2 and row.cells[0].missing == 1
    assert row.cells[1].N == 0 and row.cells[1].coverage_rate is None


# ---------- HTTP 接口 ----------

def test_matrix_rejects_non_clinician(client, patient_headers, admin_headers, world):
    start, end = world["start"], world["end"]
    assert _get(client, patient_headers, start, end).status_code == 403
    assert _get(client, admin_headers, start, end).status_code == 403


def test_matrix_requires_authentication(client, world):
    start, end = world["start"], world["end"]
    assert client.get(MATRIX, params={"from": start.isoformat(), "to": end.isoformat()}).status_code == 401


def test_matrix_only_contains_own_patients(client, clinician_headers, world):
    resp = _get(client, clinician_headers, world["start"], world["end"])
    assert resp.status_code == 200, resp.text
    codes = [r["patient_code"] for r in resp.json()["rows"]]
    assert "P-B" not in codes
    assert set(codes) == {"P-A", "P-C", "P-D", "P-E"}


def test_matrix_sum_matches_overview_totals(client, clinician_headers, world):
    start, end = world["start"], world["end"]
    matrix = _get(client, clinician_headers, start, end).json()
    overview = client.get(OVERVIEW, params={"from": start.isoformat(), "to": end.isoformat()},
                          headers=clinician_headers).json()

    cell_n = sum(c["N"] for r in matrix["rows"] for c in r["cells"])
    cell_m = sum(c["M"] for r in matrix["rows"] for c in r["cells"])
    assert cell_n == overview["total_N"] == matrix["total_N"] == 21  # P-A、P-D、P-E 各 7；P-C 无计划
    assert cell_m == overview["total_M"] == matrix["total_M"] == 14

    # 逐患者核对：矩阵行合计 = overview 对应行
    ov_rows = {r["patient_code"]: r for r in overview["rows"]}
    for row in matrix["rows"]:
        ov = ov_rows[row["patient_code"]]
        assert (row["N"], row["M"]) == (ov["N"], ov["M"]), row["patient_code"]


def test_p001_style_coverage_is_71_4_percent(client, clinician_headers, world):
    matrix = _get(client, clinician_headers, world["start"], world["end"]).json()
    row = next(r for r in matrix["rows"] if r["patient_code"] == "P-A")
    assert row["N"] == 7 and row["M"] == 5
    assert row["coverage_rate"] == 71.4


def test_cells_mark_missing_and_empty_days_correctly(client, clinician_headers, world):
    matrix = _get(client, clinician_headers, world["start"], world["end"]).json()
    row = next(r for r in matrix["rows"] if r["patient_code"] == "P-A")
    cells = {c["day"]: c for c in row["cells"]}

    revoked_day = world["past"][5].isoformat()
    assert cells[revoked_day]["N"] == 1 and cells[revoked_day]["M"] == 0
    assert cells[revoked_day]["missing"] == 1 and cells[revoked_day]["coverage_rate"] == 0.0

    # 未到期的未来日：空白，rate 必须为 null，不是 0%
    future = world["future"].isoformat()
    assert cells[future]["N"] == 0 and cells[future]["coverage_rate"] is None


def test_patient_without_plan_returns_null_rates_not_zero(client, clinician_headers, world):
    matrix = _get(client, clinician_headers, world["start"], world["end"]).json()
    row = next(r for r in matrix["rows"] if r["patient_code"] == "P-C")
    assert row["N"] == 0 and row["coverage_rate"] is None
    assert all(c["coverage_rate"] is None for c in row["cells"])


def test_rows_sorted_missing_first_and_no_plan_last(client, clinician_headers, world):
    matrix = _get(client, clinician_headers, world["start"], world["end"]).json()
    assert [r["patient_code"] for r in matrix["rows"]] == ["P-E", "P-A", "P-D", "P-C"]


def test_invalid_range_is_rejected(client, clinician_headers, world):
    start = world["start"]
    assert _get(client, clinician_headers, start, start).status_code == 422


def test_range_too_large_is_rejected(client, clinician_headers, world):
    resp = _get(client, clinician_headers, date(2026, 1, 1), date(2026, 6, 1))
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "RANGE_TOO_LARGE"


def test_build_matrix_buckets_by_shanghai_day_not_utc():
    from types import SimpleNamespace as NS

    patient = NS(id="p1", patient_code="P-1", display_name="甲")
    utc = ZoneInfo("UTC")
    # UTC 10-10 16:30 == 上海 10-11 00:30 => 应归入 10-11
    late_utc = NS(id="s1", patient_id="p1", scheduled_at=datetime(2026, 10, 10, 16, 30, tzinfo=utc))
    # UTC 10-10 15:30 == 上海 10-10 23:30 => 应归入 10-10
    early_utc = NS(id="s2", patient_id="p1", scheduled_at=datetime(2026, 10, 10, 15, 30, tzinfo=utc))
    result = build_coverage_matrix(
        from_str="2026-10-10",
        to_str="2026-10-12",
        patients=[patient],
        slots=[late_utc, early_utc],
        covered_slot_ids={"s1"},
        days=[date(2026, 10, 10), date(2026, 10, 11)],
        tz_name="Asia/Shanghai",
    )
    cells = {c.day: c for c in result.rows[0].cells}
    assert (cells["2026-10-10"].N, cells["2026-10-10"].M) == (1, 0)
    assert (cells["2026-10-11"].N, cells["2026-10-11"].M) == (1, 1)


def test_window_is_half_open_in_business_timezone_and_ignores_cancelled_slots(client, clinician_headers, db):
    clinician = db.query(User).filter(User.account == "test_clinician").one()
    device = DeviceModel(category="pMDI", brand="测试", model_name="边界装置", status="ACTIVE")
    db.add(device)
    db.flush()
    patient = _seed_patient(db, "P-T", "边界患者", clinician.id)
    plan = _seed_plan(db, patient, device.id)

    today = datetime.now(TZ).date()
    win_from, win_to = today - timedelta(days=7), today  # [today-7, today)

    def local(day, hh, mm):
        return datetime(day.year, day.month, day.day, hh, mm, tzinfo=TZ)

    # 上海 from 日 00:30（UTC 为前一日 16:30）与 23:30 计入；to 日 00:00 恰在右端点，不计入
    for at in (local(win_from, 0, 30), local(win_from, 23, 30), local(win_to, 0, 0)):
        db.add(PlannedSlot(plan_id=plan.id, patient_id=patient.id, scheduled_at=at))
    # 已取消的时点不计入分母
    db.add(PlannedSlot(plan_id=plan.id, patient_id=patient.id, scheduled_at=local(win_from, 12, 0), state="CANCELLED"))
    db.commit()

    resp = _get(client, clinician_headers, win_from, win_to)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    row = next(r for r in body["rows"] if r["patient_code"] == "P-T")
    assert row["N"] == 2
    assert {c["day"]: c["N"] for c in row["cells"]}[win_from.isoformat()] == 2
    assert body["days"][-1] == (win_to - timedelta(days=1)).isoformat()
