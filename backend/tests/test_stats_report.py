"""REP-01 / STAT-02：基础管理报告口径测试。

覆盖：重复登记明细（同一时点多条 ACTIVE 记录）+ 来源说明 + 免责口径。
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.models import User
from app.models.device import DeviceModel
from app.models.medication import MedicationEvent, MedicationPlan, PlannedSlot
from app.models.patient import Patient

TZ = ZoneInfo("Asia/Shanghai")


def _local(day, hhmm):
    hour, minute = (int(x) for x in hhmm.split(":"))
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=TZ)


def test_duplicate_slots_listed_without_inflating_m(client, db, clinician_headers):
    clinician = db.query(User).filter(User.account == "test_clinician").one()
    device = DeviceModel(category="pMDI", brand="测试", model_name="报告装置", status="ACTIVE")
    db.add(device)
    db.flush()
    patient = Patient(patient_code="P-R1", display_name="报告测试患者", assigned_clinician_id=clinician.id)
    db.add(patient)
    db.flush()
    day = datetime.now(TZ).date() - timedelta(days=1)
    plan = MedicationPlan(
        patient_id=patient.id,
        device_model_id=device.id,
        plan_group_id=patient.id,
        drug_label="测试药",
        plan_type="REGULAR",
        starts_at=_local(day - timedelta(days=30), "00:00"),
    )
    db.add(plan)
    db.flush()
    duplicated = PlannedSlot(plan_id=plan.id, patient_id=patient.id, scheduled_at=_local(day, "08:00"), state="ACTIVE")
    single = PlannedSlot(plan_id=plan.id, patient_id=patient.id, scheduled_at=_local(day, "20:00"), state="ACTIVE")
    db.add_all([duplicated, single])
    db.flush()
    # 同一时点 2 条有效记录 + 另一时点 1 条；另加一条已撤销记录（不计入来源与重复）
    events = [
        MedicationEvent(patient_id=patient.id, plan_id=plan.id, slot_id=duplicated.id,
                        source="PATIENT_REPORT", occurred_at=duplicated.scheduled_at, status="ACTIVE"),
        MedicationEvent(patient_id=patient.id, plan_id=plan.id, slot_id=duplicated.id,
                        source="PATIENT_REPORT", occurred_at=duplicated.scheduled_at, status="ACTIVE"),
        MedicationEvent(patient_id=patient.id, plan_id=plan.id, slot_id=single.id,
                        source="CLINICIAN_OBSERVED", occurred_at=single.scheduled_at, status="ACTIVE"),
        MedicationEvent(patient_id=patient.id, plan_id=plan.id, slot_id=single.id,
                        source="PATIENT_REPORT", occurred_at=single.scheduled_at, status="REVOKED"),
    ]
    db.add_all(events)
    db.commit()

    resp = client.get(
        f"/api/patients/{patient.id}/stats",
        params={"from": day.isoformat(), "to": datetime.now(TZ).date().isoformat()},
        headers=clinician_headers,
    )
    assert resp.status_code == 200, resp.text
    stats = resp.json()

    assert stats["N"] == 2
    assert stats["M"] == 2  # 重复登记不增加 M
    assert len(stats["duplicate_slots"]) == 1
    assert stats["duplicate_slots"][0]["slot_id"] == str(duplicated.id)
    assert stats["duplicate_slots"][0]["active_event_count"] == 2
    assert stats["source_breakdown"] == {"PATIENT_REPORT": 2, "CLINICIAN_OBSERVED": 1}
    assert "未由设备验证" in stats["source_note"]
    assert "记录覆盖率≠真实用药依从性" in stats["disclaimer"]
