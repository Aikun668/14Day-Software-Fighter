"""数据库引擎与会话（J004）。

同步 SQLAlchemy + PostgreSQL；V1.0 用同步 Session（TECH_DESIGN §1.3）。
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

# 演示环境连接串允许无密码（trust），正式部署由环境变量覆盖
engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    """FastAPI 依赖：请求级数据库会话。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
