"""内部扫描命令：立即物化待核查任务（J035）。

用法（backend/ 下）：
    .venv\\Scripts\\python.exe -m app.jobs.scan_due_tasks

不是用户 API；供种子数据/自动化测试立即触发扫描，避免等待周期。
"""
from app.core.database import SessionLocal
from app.services.task_service import reconcile_due_slots


def main() -> None:
    db = SessionLocal()
    try:
        result = reconcile_due_slots(db)
        print(f"扫描完成：{result}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
