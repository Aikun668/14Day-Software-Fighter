"""应用配置：从环境变量 / .env 读取（J003）。

不在此处硬编码密钥；真实值通过 backend/.env 注入（已 gitignore）。
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # 数据库
    database_url: str = "postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/inhaler_demo"

    # 认证
    jwt_secret: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # AI（可替换 LLM）
    llm_api_key: str | None = None
    llm_base_url: str | None = None
    llm_model: str | None = None
    llm_timeout_seconds: int = 20

    # 任务扫描（单进程，默认 5 分钟）
    task_scan_interval_seconds: int = 300


@lru_cache
def get_settings() -> Settings:
    return Settings()
