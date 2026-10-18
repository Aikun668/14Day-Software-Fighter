"""pytest 基础设施自检（03 D-1）：测试库隔离与客户端可用。"""


def test_tests_are_bound_to_test_database_only(db):
    assert db.get_bind().url.database == "inhaler_test"


def test_health_endpoint_reachable_through_client(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
