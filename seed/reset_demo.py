"""彻底清空演示业务数据与测试残留（保留 5 个演示账号），供种子重建前使用。"""
import sys
from pathlib import Path

# seed/ 与 backend/ 同级 → 把 backend 加入 sys.path，使 import app.* 可用
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import text

from app.core.database import SessionLocal

# 演示固定账号（保留）
KEEP_ACCOUNTS = ("admin", "clinician_a", "clinician_b", "patient_x", "patient_y")

# 依赖顺序：先删引用方，再删被引用方
TABLES = [
    "patient_reminders", "followups", "tasks",
    "training_step_results", "training_sessions",
    "medication_events", "planned_slots", "plan_daily_times", "medication_plans",
    "knowledge_chunks", "knowledge_documents",
    "guide_steps", "device_guides",
    "patient_devices", "audit_logs", "auth_sessions",
]

db = SessionLocal()
try:
    for t in TABLES:
        n = db.execute(text(f"DELETE FROM {t}")).rowcount
        if n:
            print(f"  清空 {t}: {n} 行")

    # 冒烟测试残留的患者（P-T*、P-100 等；业务表已清空，无引用）
    n = db.execute(text("DELETE FROM patients WHERE patient_code NOT LIKE 'P-0%'")).rowcount
    if n:
        print(f"  清理测试患者: {n} 行")

    # 测试账号（clinician_t* / temp_doc_* 等），保留演示 5 账号
    placeholders = ", ".join(f":a{i}" for i in range(len(KEEP_ACCOUNTS)))
    params = {f"a{i}": a for i, a in enumerate(KEEP_ACCOUNTS)}
    n = db.execute(text(f"DELETE FROM users WHERE account NOT IN ({placeholders})"), params).rowcount
    if n:
        print(f"  清理测试账号: {n} 行")

    db.commit()
    print("\n已重置（保留演示账号与 P-0xx 患者骨架）")
    for t in ["medication_plans", "planned_slots", "medication_events", "patients", "users"]:
        c = db.execute(text(f"SELECT count(*) FROM {t}")).scalar()
        print(f"  {t}: {c}")
finally:
    db.close()
