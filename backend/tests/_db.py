"""测试用数据库直连助手。

冒烟脚本主要走 HTTP；个别「系统本就没有删除接口」的残留（如已发布知识文档、
一次性测试患者及其账号）只能在此清理，避免污染演示库。

用法：
    from _db import cleanup_knowledge_by_title, cleanup_patient_by_code
"""
import sys
from pathlib import Path

# backend/tests/_db.py → backend → 项目根
BACKEND = Path(__file__).resolve().parent.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from sqlalchemy import text  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402


def cleanup_knowledge_by_title(marker: str) -> int:
    """删除标题含 marker 的知识文档及其片段（按依赖顺序先删片段）。"""
    db = SessionLocal()
    try:
        ids = [r[0] for r in db.execute(
            text("SELECT id FROM knowledge_documents WHERE title LIKE :m"),
            {"m": f"%{marker}%"},
        ).fetchall()]
        if not ids:
            return 0
        for doc_id in ids:
            db.execute(text("DELETE FROM knowledge_chunks WHERE document_id = :i"), {"i": doc_id})
            db.execute(text("DELETE FROM knowledge_documents WHERE id = :i"), {"i": doc_id})
        db.commit()
        return len(ids)
    finally:
        db.close()


def cleanup_patient_by_code(code: str) -> int:
    """删除测试患者：先清其业务数据与绑定账号，再删患者本身。"""
    db = SessionLocal()
    try:
        row = db.execute(text("SELECT id, account_user_id FROM patients WHERE patient_code = :c"),
                         {"c": code}).fetchone()
        if row is None:
            return 0
        pid, uid = row[0], row[1]
        for stmt in (
            "DELETE FROM patient_reminders WHERE patient_id = :i",
            "DELETE FROM followups WHERE patient_id = :i",
            "DELETE FROM tasks WHERE patient_id = :i",
            "DELETE FROM training_step_results WHERE session_id IN "
            "(SELECT id FROM training_sessions WHERE patient_id = :i)",
            "DELETE FROM training_sessions WHERE patient_id = :i",
            "DELETE FROM medication_events WHERE patient_id = :i",
            "DELETE FROM planned_slots WHERE patient_id = :i",
            "DELETE FROM plan_daily_times WHERE plan_id IN "
            "(SELECT id FROM medication_plans WHERE patient_id = :i)",
            "DELETE FROM medication_plans WHERE patient_id = :i",
            "DELETE FROM patient_devices WHERE patient_id = :i",
            "DELETE FROM patients WHERE id = :i",
        ):
            db.execute(text(stmt), {"i": pid})
        if uid is not None:
            db.execute(text("DELETE FROM auth_sessions WHERE user_id = :i"), {"i": uid})
            db.execute(text("DELETE FROM users WHERE id = :i"), {"i": uid})
        db.commit()
        return 1
    finally:
        db.close()
