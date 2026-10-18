"""pytest 共享夹具。

数据库连接串由 backend/.env 的 DATABASE_URL 派生，仅替换库名为 inhaler_test。
必须在导入 app 之前改写环境变量，否则 app.core.database 会在导入时绑定演示库。
"""
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine.url import make_url

from app.core.config import Settings

BACKEND = Path(__file__).resolve().parent.parent
TEST_DB_NAME = "inhaler_test"
TEST_PASSWORD = "Test-1234"

_source_url = make_url(Settings(_env_file=BACKEND / ".env").database_url)
os.environ["DATABASE_URL"] = _source_url.set(database=TEST_DB_NAME).render_as_string(hide_password=False)

from app.auth.security import hash_password  # noqa: E402
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    assert engine.url.database == TEST_DB_NAME, f"拒绝在非测试库上运行: {engine.url.database}"
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client():
    # 不进入 lifespan：避免启动任务扫描后台循环
    return TestClient(app)


@pytest.fixture
def make_user():
    def _make(account: str, role: str) -> User:
        session = SessionLocal()
        try:
            user = User(
                account=account,
                password_hash=hash_password(TEST_PASSWORD),
                role=role,
                status="ACTIVE",
                must_change_password=False,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            return user
        finally:
            session.close()

    return _make


def _login_headers(client: TestClient, account: str) -> dict[str, str]:
    resp = client.post("/api/auth/login", json={"account": account, "password": TEST_PASSWORD})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def clinician_headers(client, make_user):
    make_user("test_clinician", "CLINICIAN")
    return _login_headers(client, "test_clinician")


@pytest.fixture
def admin_headers(client, make_user):
    make_user("test_admin", "ADMIN")
    return _login_headers(client, "test_admin")


@pytest.fixture
def patient_headers(client, make_user):
    make_user("test_patient_account", "PATIENT")
    return _login_headers(client, "test_patient_account")
