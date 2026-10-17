"""丰富演示数据（幂等重建）。

用法（项目根目录）：
    backend\\.venv\\Scripts\\python.exe -m seed.demo_data_full

设计要点：
- P-001 林女士：7 天 × 每天 2 次 = N=14，10 个不同时点有 ACTIVE 登记 → M=10，覆盖率 71.4%
  （PRD T06 标杆；另含 1 次重复登记、1 条撤销记录用于演示）
- 14 个患者覆盖哮喘/慢阻肺，分属 clinician_a / clinician_b
- 每个患者绑定装置型号；多数配有用药计划，覆盖率各不相同
- 3 个型号各有 1 份已发布指导（含真实吸入器操作步骤，标注 DEMO 未临床审核）
- 含训练记录、待核查任务、随访、患者提醒、知识库、审计日志

安全声明：全部为虚构 DEMO 数据，无真实身份/病历信息；指导内容为演示素材，未经临床审核。
"""
import hashlib
import sys
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

# 自动定位 backend，使 `import app.*` 可用
_BACKEND = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

import bcrypt
from sqlalchemy import text

from app.core.database import Base, SessionLocal, engine
from app.models import (
    AuditLog,
    DeviceGuide,
    DeviceModel,
    Followup,
    GuideStep,
    KnowledgeChunk,
    KnowledgeDocument,
    MedicationEvent,
    MedicationPlan,
    Patient,
    PatientDevice,
    PatientReminder,
    PlanDailyTime,
    PlannedSlot,
    Task,
    TrainingSession,
    TrainingStepResult,
    User,
)

SH = ZoneInfo("Asia/Shanghai")
UTC = ZoneInfo("UTC")
NOW = datetime.now(timezone.utc)


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def utc_at(d: date, t: time) -> datetime:
    """按 Asia/Shanghai 的本地日期时间，转成 UTC。"""
    return datetime.combine(d, t, tzinfo=SH).astimezone(UTC)


def trigger_key(patient_id, task_type: str, slot_id) -> str:
    return hashlib.sha256(f"{patient_id}:{task_type}:{slot_id}".encode()).hexdigest()


# ---------- 患者定义 ----------
# (code, 姓名, 诊断, 归属, 型号 category)
PATIENTS = [
    ("P-001", "林女士", "支气管哮喘（DEMO）", "clinician_a", "pMDI"),
    ("P-002", "陈先生", "慢性阻塞性肺疾病（DEMO）", "clinician_a", "DPI"),
    ("P-003", "王女士", "支气管哮喘（DEMO）", "clinician_a", "SMI"),
    ("P-004", "李先生", "慢性阻塞性肺疾病（DEMO）", "clinician_a", "pMDI"),
    ("P-005", "赵女士", "支气管哮喘（DEMO）", "clinician_a", "DPI"),
    ("P-006", "周先生", "慢性阻塞性肺疾病（DEMO）", "clinician_a", "SMI"),
    ("P-007", "吴女士", "支气管哮喘（DEMO）", "clinician_a", "pMDI"),
    ("P-008", "郑先生", "慢性阻塞性肺疾病（DEMO）", "clinician_a", "DPI"),
    ("P-009", "孙女士", "支气管哮喘（DEMO）", "clinician_a", "SMI"),
    ("P-010", "胡先生", "慢性阻塞性肺疾病（DEMO）", "clinician_b", "pMDI"),
    ("P-011", "何女士", "支气管哮喘（DEMO）", "clinician_b", "DPI"),
    ("P-012", "郭先生", "慢性阻塞性肺疾病（DEMO）", "clinician_b", "SMI"),
    ("P-013", "刘女士", "支气管哮喘（DEMO）", "clinician_b", "pMDI"),
    ("P-014", "杨先生", "慢性阻塞性肺疾病（DEMO）", "clinician_a", "DPI"),
]

# 账号绑定：patient_x → P-001，patient_y → P-002
ACCOUNT_BINDING = {"P-001": "patient_x", "P-002": "patient_y"}

# ---------- 指导步骤（DEMO 演示素材，未临床审核）----------
GUIDES = {
    "pMDI": {
        "title": "压力定量气雾剂（pMDI）操作指导（DEMO 演示素材）",
        "source": "药品说明书要点（DEMO 演示素材，未经临床审核）",
        "steps": [
            ("使用前取下吸嘴盖，检查吸嘴内有无异物。", "吸嘴内有异物时不要使用，请联系医护更换。"),
            ("充分摇匀吸入器约 5 秒，使药液混合均匀。", "未摇匀会导致每次喷出的药量不均匀。"),
            ("保持直立，先缓慢呼气至舒适位置。", "不要对着吸嘴呼气，以免潮气影响药物。"),
            ("含住吸嘴，在按压罐体的同时缓慢深吸气。", "按压与吸气不同步是最常见的错误。"),
            ("屏气约 10 秒，然后缓慢呼气。", "屏气不足会降低药物在肺部的沉积。"),
            ("使用后盖上吸嘴盖，并用清水漱口。", "使用含激素药物后不漱口易引起口腔不适。"),
        ],
    },
    "DPI": {
        "title": "干粉吸入剂（DPI）操作指导（DEMO 演示素材）",
        "source": "药品说明书要点（DEMO 演示素材，未经临床审核）",
        "steps": [
            ("旋松并拔出瓶盖，确认吸嘴干净。", "瓶盖未旋松会导致吸嘴无法拔出。"),
            ("一手握住瓶身保持直立，另一手旋转底座上药，听到「咔哒」声即可。", "反复旋转会造成药物浪费。"),
            ("先完全呼气，注意不要对着吸嘴呼气。", "对着吸嘴呼气会使药粉受潮结块。"),
            ("快速有力地深吸气，一次吸足。", "吸气力度不足会导致药物残留。"),
            ("屏气约 10 秒后缓慢呼气。", ""),
            ("用干布擦拭吸嘴，盖回瓶盖，并清水漱口。", "不要用水冲洗吸入器本体。"),
        ],
    },
    "SMI": {
        "title": "软雾吸入剂（SMI）操作指导（DEMO 演示素材）",
        "source": "药品说明书要点（DEMO 演示素材，未经临床审核）",
        "steps": [
            ("保持瓶盖关闭，按压药瓶将其插入吸入器直至卡紧。", ""),
            ("首次使用需排气：打开瓶盖，按压剂量释放按钮至出现药雾后盖上。", "未排气会导致首次吸入剂量不足。"),
            ("完全呼气后，将吸嘴含入口中。", "不要对着吸嘴呼气。"),
            ("缓慢深吸气的同时按压剂量释放按钮。", "喷雾与吸气需同步。"),
            ("屏气约 10 秒后缓慢呼气，再盖回瓶盖。", ""),
            ("用清水漱口。", ""),
        ],
    },
}

# ---------- 计划与登记覆盖情况 ----------
# (patient_code, 天数, 每日时点, 覆盖时点数) —— 覆盖率 = 覆盖/总数
PLAN_SPECS = [
    ("P-001", 7, ["08:00", "20:00"], 10),   # 14 中覆盖 10 → 71.4%（PRD 标杆）
    ("P-002", 7, ["08:00", "20:00"], 11),   # 14 中覆盖 11 → 78.6%
    ("P-003", 7, ["08:00", "20:00"], 7),    # 14 中覆盖 7  → 50.0%
    ("P-004", 7, ["08:00", "20:00"], 13),   # 14 中覆盖 13 → 92.9%
    ("P-005", 6, ["07:30", "19:30"], 6),    # 12 中覆盖 6  → 50.0%
    ("P-006", 7, ["08:00", "20:00"], 9),    # 14 中覆盖 9  → 64.3%
    ("P-007", 5, ["09:00", "21:00"], 8),    # 10 中覆盖 8  → 80.0%
    ("P-010", 7, ["08:00", "20:00"], 4),    # 14 中覆盖 4  → 28.6%（低，触发待核查）
    ("P-011", 7, ["08:00", "20:00"], 3),    # 14 中覆盖 3  → 21.4%（低）
    ("P-012", 6, ["08:30", "20:30"], 5),    # 12 中覆盖 5  → 41.7%
]

DRUG_BY_CATEGORY = {
    "pMDI": "硫酸沙丁胺醇吸入气雾剂（DEMO）",
    "DPI": "布地奈德福莫特罗粉吸入剂（DEMO）",
    "SMI": "噻托溴铵吸入喷雾剂（DEMO）",
}

# 计划区间基于「今天」动态计算，并保证统计口径可复现 PRD T06：
#   v1 覆盖「昨天往前 7 个完整日」（14 个时点全部已到期 → N=14，其中 10 个登记 → M=10，71.4%）
#   v2 从「今天」起生效（今日时点因此落在 v2 上，患者端首页有当天待办）
TODAY = date.today()
PLAN_START = TODAY - timedelta(days=7)   # 7 天前的 00:00
PLAN_END = TODAY                          # v1 在「今天 00:00」结束 → 覆盖 7 个完整日
REVISION_START = TODAY                    # v2 从今天 00:00 起生效


def _clear_business_data(db) -> None:
    """按外键顺序清空演示业务数据（保留 users）。

    注意：清空后立即 commit，确保即便后续生成失败，也不会残留旧数据造成重复。
    """
    order = [
        "patient_reminders", "followups", "tasks",
        "training_step_results", "training_sessions",
        "medication_events", "planned_slots", "plan_daily_times", "medication_plans",
        "knowledge_chunks", "knowledge_documents",
        "guide_steps", "device_guides",
        "patient_devices", "audit_logs",
    ]
    for t in order:
        db.execute(text(f"DELETE FROM {t}"))
    db.commit()


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # ===== 1) 账号（幂等，保留并统一密码）=====
        users: dict[str, User] = {}
        for account, role in [
            ("admin", "ADMIN"),
            ("clinician_a", "CLINICIAN"),
            ("clinician_b", "CLINICIAN"),
            ("patient_x", "PATIENT"),
            ("patient_y", "PATIENT"),
        ]:
            u = db.query(User).filter(User.account == account).first()
            if u is None:
                u = User(account=account, role=role, status="ACTIVE", must_change_password=False,
                         password_hash=_hash("123"))
                db.add(u)
                db.flush()
            else:
                u.password_hash = _hash("123")
                u.must_change_password = False
                u.status = "ACTIVE"
            users[account] = u

        admin = users["admin"]
        clin = {k: users[k] for k in ("clinician_a", "clinician_b")}

        # ===== 2) 清空业务数据 =====
        _clear_business_data(db)

        # ===== 3) 装置型号（幂等）=====
        models: dict[str, DeviceModel] = {}
        for cat, brand, name, mfr in [
            ("pMDI", "万托林", "吸入气雾剂 pMDI", "阿斯利康（DEMO）"),
            ("DPI", "信必可", "都保 DPI", "阿斯利康（DEMO）"),
            ("SMI", "思力华", "能倍乐 Respimat", "勃林格殷格翰（DEMO）"),
        ]:
            m = db.query(DeviceModel).filter(DeviceModel.model_name == name).first()
            if m is None:
                m = DeviceModel(category=cat, brand=brand, model_name=name, manufacturer=mfr, status="ACTIVE")
                db.add(m)
                db.flush()
            models[cat] = m

        # ===== 4) 已发布指导 + 步骤 =====
        guides: dict[str, DeviceGuide] = {}
        for cat, spec in GUIDES.items():
            model = models[cat]
            g = DeviceGuide(
                device_model_id=model.id,
                version="1.0",
                title=spec["title"],
                source_title=spec["source"],
                review_status="PUBLISHED",
                reviewed_by=admin.id,
                reviewed_at=NOW - timedelta(days=3),
                published_by=admin.id,
                published_at=NOW - timedelta(days=2),
            )
            db.add(g)
            db.flush()
            for i, (txt, err) in enumerate(spec["steps"], start=1):
                db.add(GuideStep(guide_id=g.id, step_no=i, text=txt, error_notes=err or None))
            guides[cat] = g
            db.add(AuditLog(actor_id=admin.id, action="GUIDE_PUBLISH", resource_type="device_guide",
                            resource_id=g.id, detail={"version": "1.0", "model": model.model_name},
                            created_at=NOW - timedelta(days=2)))

        # 保留一份 DEMO 草稿（演示「草稿不可见」）
        draft = DeviceGuide(
            device_model_id=models["pMDI"].id, version="1.1-demo",
            title="万托林吸入气雾剂操作指导（DEMO 草稿，未审核）",
            review_status="DRAFT",
        )
        db.add(draft)
        db.flush()
        db.add(GuideStep(guide_id=draft.id, step_no=1, text="（待临床审核后填写正式步骤）",
                         error_notes="本步骤为演示占位，不构成正式操作指导。"))

        # ===== 5) 患者 + 装置绑定 =====
        patients: dict[str, Patient] = {}
        for code, name, diag, owner, cat in PATIENTS:
            p = db.query(Patient).filter(Patient.patient_code == code).first()
            if p is None:
                p = Patient(
                    patient_code=code,
                    display_name=name,
                    diagnosis_label=diag,
                    note="DEMO 演示数据，非真实患者",
                    assigned_clinician_id=clin[owner].id,
                    account_user_id=users[ACCOUNT_BINDING[code]].id if code in ACCOUNT_BINDING else None,
                )
                db.add(p)
                db.flush()
            else:
                p.display_name = name
                p.diagnosis_label = diag
                p.note = "DEMO 演示数据，非真实患者"
                p.assigned_clinician_id = clin[owner].id
                p.account_user_id = users[ACCOUNT_BINDING[code]].id if code in ACCOUNT_BINDING else None
            patients[code] = p
            db.add(PatientDevice(patient_id=p.id, device_model_id=models[cat].id,
                                 effective_from=utc_at(PLAN_START - timedelta(days=30), time(0, 0))))
            db.add(AuditLog(actor_id=clin[owner].id, action="PATIENT_CREATE", resource_type="patient",
                            resource_id=p.id, detail={"code": code}, created_at=NOW - timedelta(days=9)))
        db.flush()

        # ===== 6) 计划 / 时点 / 登记 =====
        events_created = 0
        for code, days, times, covered in PLAN_SPECS:
            p = patients[code]
            cat = dict((c, cc) for c, _, _, _, cc in PATIENTS)[code]
            model = models[cat]
            start_d = PLAN_START
            end_d = PLAN_START + timedelta(days=days)
            plan = MedicationPlan(
                patient_id=p.id, device_model_id=model.id, plan_group_id=uuid.uuid4(),
                version=1, drug_label=DRUG_BY_CATEGORY[cat], plan_type="REGULAR",
                timezone="Asia/Shanghai",
                starts_at=utc_at(start_d, time(0, 0)), ends_at=utc_at(end_d, time(0, 0)),
            )
            db.add(plan)
            db.flush()
            local_times = []
            for i, hm in enumerate(times, start=1):
                h, m = hm.split(":")
                lt = time(int(h), int(m))
                local_times.append(lt)
                db.add(PlanDailyTime(plan_id=plan.id, local_time=lt, label=f"时点{i}", is_enabled=True))

            # 生成时点
            slots = []
            d = start_d
            while d < end_d:
                for lt in local_times:
                    s = PlannedSlot(plan_id=plan.id, patient_id=p.id, scheduled_at=utc_at(d, lt), state="ACTIVE")
                    db.add(s)
                    db.flush()
                    slots.append(s)
                d += timedelta(days=1)
            slots.sort(key=lambda s: s.scheduled_at)

            # 登记：前 covered 个时点（对 P-001 特意跳过中间两个以更真实）
            if code == "P-001":
                covered_idx = list(range(0, 5)) + list(range(6, 8)) + list(range(9, 12))
            else:
                covered_idx = list(range(min(covered, len(slots))))
            for idx in covered_idx[:covered]:
                slot = slots[idx]
                occ = slot.scheduled_at + timedelta(minutes=5)
                db.add(MedicationEvent(
                    patient_id=p.id, plan_id=plan.id, slot_id=slot.id, source="PATIENT_REPORT",
                    occurred_at=occ, recorded_at=occ + timedelta(minutes=2), status="ACTIVE",
                    note="按计划登记",
                ))
                events_created += 1

            # P-001 专属演示：1 次重复登记 + 1 条撤销
            if code == "P-001" and len(slots) > 12:
                dup = slots[0]
                db.add(MedicationEvent(
                    patient_id=p.id, plan_id=plan.id, slot_id=dup.id, source="PATIENT_REPORT",
                    occurred_at=dup.scheduled_at + timedelta(minutes=45),
                    recorded_at=dup.scheduled_at + timedelta(minutes=47), status="ACTIVE",
                    note="重复登记（演示重复提示）",
                ))
                events_created += 1
                rev = slots[12]
                db.add(MedicationEvent(
                    patient_id=p.id, plan_id=plan.id, slot_id=rev.id, source="PATIENT_REPORT",
                    occurred_at=rev.scheduled_at + timedelta(minutes=3),
                    recorded_at=rev.scheduled_at + timedelta(minutes=4), status="REVOKED",
                    note="误登记", revoked_by=p.account_user_id, revoked_at=NOW - timedelta(days=1),
                    revoke_reason="患者反馈当时未实际使用",
                ))
                events_created += 1

        # P-002 追加 PRN 计划（演示按需不计入分母）
        p2 = patients["P-002"]
        prn = MedicationPlan(
            patient_id=p2.id, device_model_id=models["DPI"].id,
            plan_group_id=uuid.uuid4(), version=1,
            drug_label="按需缓解用药（DEMO）", plan_type="PRN", timezone="Asia/Shanghai",
            starts_at=utc_at(PLAN_START, time(0, 0)), ends_at=None,
        )
        db.add(prn)
        db.flush()
        for i in range(3):
            occ = utc_at(PLAN_START + timedelta(days=i + 1), time(15, 30))
            db.add(MedicationEvent(patient_id=p2.id, plan_id=prn.id, slot_id=None,
                                   source="PATIENT_REPORT", occurred_at=occ,
                                   recorded_at=occ + timedelta(minutes=3), status="ACTIVE",
                                   note="症状发作时按需使用"))
            events_created += 1

        # P-001 计划版本修订（演示历史版本）
        p1 = patients["P-001"]
        old_plan = db.query(MedicationPlan).filter(
            MedicationPlan.patient_id == p1.id, MedicationPlan.plan_type == "REGULAR"
        ).first()
        if old_plan:
            rev_start = utc_at(REVISION_START, time(0, 0))
            old_plan.ends_at = rev_start
            v2 = MedicationPlan(
                patient_id=p1.id, device_model_id=old_plan.device_model_id,
                plan_group_id=old_plan.plan_group_id, version=2,
                drug_label=old_plan.drug_label, plan_type="REGULAR", timezone="Asia/Shanghai",
                starts_at=rev_start, ends_at=None,
            )
            db.add(v2)
            db.flush()
            for i, hm in enumerate(["09:00", "21:00"], start=1):
                h, m = hm.split(":")
                db.add(PlanDailyTime(plan_id=v2.id, local_time=time(int(h), int(m)),
                                     label=f"时点{i}", is_enabled=True))
            db.add(AuditLog(actor_id=clin["clinician_a"].id, action="PLAN_REVISION",
                            resource_type="medication_plan", resource_id=v2.id,
                            detail={"old_version": 1}, created_at=NOW - timedelta(days=1)))

        # ===== 7) 训练记录 =====
        for code in ("P-001", "P-002", "P-005"):
            p = patients[code]
            cat = dict((c, cc) for c, _, _, _, cc in PATIENTS)[code]
            g = guides[cat]
            steps = db.query(GuideStep).filter(GuideStep.guide_id == g.id).order_by(GuideStep.step_no).all()
            for k in range(2):
                src = "PATIENT_REPORT"
                sess = TrainingSession(
                    patient_id=p.id, device_model_id=models[cat].id, guide_id=g.id, source=src,
                    submit_at=NOW - timedelta(days=k + 1, hours=2),
                    result="自述完成" if k == 0 else "部分步骤有困难",
                )
                db.add(sess)
                db.flush()
                for i, st in enumerate(steps):
                    state = "DONE" if (i % 3 != 2 or k == 0) else "DIFFICULT"
                    db.add(TrainingStepResult(session_id=sess.id, step_id=st.id, check_state=state,
                                              note="屏气时间不足" if state == "DIFFICULT" else None))
        # 医护现场观察 1 条
        p3 = patients["P-003"]
        g3 = guides["SMI"]
        st3 = db.query(GuideStep).filter(GuideStep.guide_id == g3.id).order_by(GuideStep.step_no).all()
        obs = TrainingSession(patient_id=p3.id, device_model_id=models["SMI"].id, guide_id=g3.id,
                              source="CLINICIAN_OBSERVED", submit_at=NOW - timedelta(days=2, hours=5),
                              result="操作熟练", evaluator_id=clin["clinician_a"].id)
        db.add(obs)
        db.flush()
        for st in st3:
            db.add(TrainingStepResult(session_id=obs.id, step_id=st.id, check_state="DONE"))

        # ===== 8) 待核查任务 + 随访 =====
        low = [("P-010", 4), ("P-011", 3), ("P-003", 7)]
        tasks_created = []
        for i, (code, _) in enumerate(low):
            p = patients[code]
            slot = db.query(PlannedSlot).filter(PlannedSlot.patient_id == p.id).order_by(
                PlannedSlot.scheduled_at.desc()).first()
            status = ["OPEN", "IN_PROGRESS", "CLOSED"][i]
            t = Task(
                patient_id=p.id, task_type="MISSED_MEDICATION",
                trigger_key=trigger_key(p.id, "MISSED_MEDICATION", slot.id if slot else p.id),
                status=status, assigned_to=p.assigned_clinician_id,
                closed_at=NOW - timedelta(hours=6) if status == "CLOSED" else None,
                created_at=NOW - timedelta(days=2, hours=i),
            )
            db.add(t)
            db.flush()
            tasks_created.append(t)
            db.add(AuditLog(actor_id=None, action="TASK_CREATE", resource_type="task",
                            resource_id=t.id, detail={"task_type": "MISSED_MEDICATION"},
                            created_at=NOW - timedelta(days=2, hours=i)))

        followup_specs = [
            ("P-010", tasks_created[0], "已电话联系患者，患者表示近期外出忘记登记。", "提醒按计划登记，并演示吸入步骤。", "一周后电话复查。"),
            ("P-003", tasks_created[2], "随访时发现患者未正确屏气。", "现场演示并让患者复述操作要点。", "安排一次操作复训。"),
            ("P-001", None, "患者反馈吸入器使用顺畅，无不适。", "肯定依从性，提醒漱口。", "两周后常规随访。"),
            ("P-002", None, "患者主诉晨起气促，已建议门诊复诊。", "记录症状变化，未调整用药。", "门诊复诊后更新随访。"),
            ("P-005", None, "复训后操作明显改善。", "再次强调摇匀与同步按压。", "下次随访观察维持情况。"),
        ]
        for code, task, fb, act, nxt in followup_specs:
            p = patients[code]
            f = Followup(
                patient_id=p.id, task_id=task.id if task else None,
                clinician_id=p.assigned_clinician_id,
                followed_at=NOW - timedelta(days=1, hours=len(fb)),
                feedback=fb, action_taken=act, next_plan=nxt,
            )
            db.add(f)
            db.flush()
            if task is not None:
                task.status = "CLOSED"
                task.closed_at = f.followed_at
            db.add(AuditLog(actor_id=p.assigned_clinician_id, action="FOLLOWUP_CREATE",
                            resource_type="followup", resource_id=f.id,
                            detail={"close_task": task is not None}, created_at=f.followed_at))

        # ===== 9) 患者提醒 =====
        for code, kind, title in [
            ("P-001", "RETRAIN", "请完成一次操作复训"),
            ("P-001", "FOLLOWUP", "请配合完成近期随访"),
            ("P-003", "RETRAIN", "复训后请再次完成操作自检"),
        ]:
            p = patients[code]
            db.add(PatientReminder(
                patient_id=p.id, kind=kind, title=title, status="PENDING",
                created_by=p.assigned_clinician_id, created_at=NOW - timedelta(days=1),
            ))

        # ===== 10) 知识库（已发布，供 AI 检索）=====
        kb_texts = {
            "pMDI": [
                "压力定量气雾剂使用前必须充分摇匀，使药液与抛射剂混合均匀，通常摇匀约 5 秒。",
                "吸入时应在按压罐体的同时缓慢深吸气，按压与吸气不同步是最常见的操作错误。",
                "吸入后屏气约 10 秒可以让药物更好地沉积在气道，屏气不足会降低疗效。",
                "使用含糖皮质激素的吸入剂后应清水漱口，减少口腔不适的发生。",
            ],
            "DPI": [
                "干粉吸入剂需先旋松并拔出瓶盖，再旋转底座完成上药，听到咔哒声表示上药到位。",
                "上药后应先完全呼气，注意不要对着吸嘴呼气，潮气会使药粉结块。",
                "吸入干粉时需要快速有力地一次吸足，吸气力度不足会造成药物残留。",
            ],
            "SMI": [
                "软雾吸入剂首次使用前需要排气，按压剂量释放按钮至出现均匀药雾。",
                "吸入时应缓慢深吸气，同时按压剂量释放按钮，保证喷雾与吸气同步。",
            ],
        }
        for cat, texts in kb_texts.items():
            doc = KnowledgeDocument(
                device_model_id=models[cat].id, guide_id=guides[cat].id,
                title=f"{models[cat].model_name} 使用要点知识库（DEMO）",
                version="1.0", review_status="PUBLISHED",
                source_url=None, reviewed_by=admin.id, reviewed_at=NOW - timedelta(days=3),
                published_by=admin.id, published_at=NOW - timedelta(days=2),
            )
            db.add(doc)
            db.flush()
            for i, txt in enumerate(texts, start=1):
                db.add(KnowledgeChunk(document_id=doc.id, chunk_no=i, text=txt))
            db.add(AuditLog(actor_id=admin.id, action="KNOWLEDGE_PUBLISH",
                            resource_type="knowledge_document", resource_id=doc.id,
                            detail={"version": "1.0"}, created_at=NOW - timedelta(days=2)))

        db.commit()

        # ===== 统计输出 =====
        counts = {}
        for t in ["users", "patients", "device_models", "device_guides", "guide_steps",
                  "patient_devices", "medication_plans", "plan_daily_times", "planned_slots",
                  "medication_events", "training_sessions", "training_step_results",
                  "tasks", "followups", "patient_reminders",
                  "knowledge_documents", "knowledge_chunks", "audit_logs"]:
            counts[t] = db.execute(text(f"SELECT count(*) FROM {t}")).scalar()
        print("演示数据重建完成：")
        for k, v in counts.items():
            print(f"  {k:24} {v}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
