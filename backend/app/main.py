"""FastAPI 入口（J002/J003）。

V1.0 提供技术探活 /api/health、自动生成的 /openapi.json，
以及分领域业务路由（api/ 下各模块 APIRouter）。

注意：演示部署必须保持**单工作进程**（任务扫描器为进程内单实例，TECH_DESIGN §4.4.3）。
"""
import asyncio
import contextlib
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin_users,
    ai,
    audit,
    auth,
    device_models,
    followups,
    knowledge,
    medication_events,
    patients,
    plans,
    reminders,
    stats,
    tasks,
    training,
)
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.services.task_service import reconcile_due_slots

logger = logging.getLogger("app")

app = FastAPI(
    title="吸入治疗指导与依从性辅助管理软件",
    version="1.0.0",
    description="医护 Web 与患者 Android App 共用的统一 REST API（V1.0 演示原型，模拟数据）",
)

# CORS（TECH_DESIGN §5.5）：允许开发 Web 源与 Capacitor WebView 源。
# 正式部署前收紧为明确的允许列表；CORS 不替代鉴权。
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5180",     # 医护 Web dev server
        "http://127.0.0.1:5180",
        "http://localhost:5190",     # 患者 App dev server（浏览器调试）
        "http://127.0.0.1:5190",
        "http://localhost",          # Capacitor androidScheme=http 的 WebView 源
        "capacitor://localhost",
        "https://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 全局异常兜底：未预期异常统一返回 500 错误体，不泄露堆栈（J050）。
@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):  # noqa: ARG001
    logger.exception("未预期异常")
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=500,
        content={"code": "INTERNAL_ERROR", "message": "服务异常，请稍后重试", "details": None},
    )


@app.get("/api/health")
def health() -> dict:
    """技术探活端点：不返回任何数据库表名、密钥或患者数据。"""
    return {"status": "ok"}


# 业务路由注册（分领域 APIRouter）
app.include_router(auth.router)
app.include_router(admin_users.router)
app.include_router(patients.router)
app.include_router(audit.router)
app.include_router(device_models.router)
app.include_router(training.router)
app.include_router(plans.router)
app.include_router(medication_events.router)
app.include_router(stats.router)
app.include_router(tasks.router)
app.include_router(followups.router)
app.include_router(reminders.router)
app.include_router(knowledge.router)
app.include_router(ai.router)


async def _scan_loop() -> None:
    """进程内周期扫描待核查任务（单实例，TD-05）。"""
    interval = get_settings().task_scan_interval_seconds
    while True:
        try:
            db = SessionLocal()
            try:
                result = reconcile_due_slots(db)
                if result.get("tasks_created"):
                    logger.info("任务扫描：新建 %s 条", result["tasks_created"])
            finally:
                db.close()
        except Exception:  # noqa: BLE001
            logger.exception("任务扫描异常，下个周期继续")
        await asyncio.sleep(interval)


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    # 启动首扫 + 注册周期扫描
    task = asyncio.create_task(_scan_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app.router.lifespan_context = lifespan
