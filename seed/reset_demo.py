"""彻底清空演示业务数据（保留 users / 账号），供种子重建前使用。"""
import sys
from pathlib import Path

# seed/ 与 backend/ 同级 → 把 backend 加入 sys.path，使 import app.* 可用
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import text

from app.core.database import SessionLocal

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
    db.commit()
    print("\n业务数据已清空（users 保留）")
    for t in ["medication_plans", "planned_slots", "medication_events", "patients"]:
        c = db.execute(text(f"SELECT count(*) FROM {t}")).scalar()
        print(f"  {t}: {c}")
finally:
    db.close()
