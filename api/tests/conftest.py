from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal, engine
from app.main import app
from app.models import RefreshToken

PASSWORD = "Init#pass1"

LIKERT_ONE = [
    {
        "fe_id": "c_q1",
        "type": "radio",
        "props": {
            "title": "QA設問",
            "required": True,
            "scoreEnabled": True,
            "options": [
                {"value": "1", "label": "低", "score": 1},
                {"value": "5", "label": "高", "score": 5},
            ],
        },
    }
]


@pytest.fixture(scope="session")
def _refresh_token_ids_before_suite():
    """Session-scoped logins persist refresh tokens; remove only those created by this run."""
    with SessionLocal() as db:
        preexisting = set(db.scalars(select(RefreshToken.id)))
    yield preexisting
    with SessionLocal() as db:
        for token in db.scalars(select(RefreshToken)):
            if token.id not in preexisting:
                db.delete(token)
        db.commit()


@pytest.fixture(autouse=True)
def _rollback_test_writes():
    """Keep committed seed rows; roll back anything this test commits via get_db / SessionLocal."""
    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal.configure(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield
    finally:
        SessionLocal.configure(bind=engine, join_transaction_mode="conditional_savepoint")
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="session")
def api(_refresh_token_ids_before_suite):
    with TestClient(app) as client:
        yield client


def login(api: TestClient, employee_no: str, password: str = PASSWORD) -> dict:
    res = api.post("/api/v1/auth/login", json={"employee_no": employee_no, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture(scope="session")
def tokens(api: TestClient) -> dict[str, dict]:
    nos = ["E-HR", "E-SALES-M", "E-DEV-M", "E-SALES-01", "E-DEV-02", "E-DEV-03"]
    return {no: login(api, no) for no in nos}


def auth_header(tokens: dict[str, dict], employee_no: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens[employee_no]['access_token']}"}


@pytest.fixture(scope="session")
def hr_auth(tokens: dict[str, dict]) -> dict[str, str]:
    return auth_header(tokens, "E-HR")


@pytest.fixture(scope="session")
def sales_mgr_auth(tokens: dict[str, dict]) -> dict[str, str]:
    return auth_header(tokens, "E-SALES-M")


@pytest.fixture(scope="session")
def dev_mgr_auth(tokens: dict[str, dict]) -> dict[str, str]:
    return auth_header(tokens, "E-DEV-M")


@pytest.fixture(scope="session")
def sales_emp_auth(tokens: dict[str, dict]) -> dict[str, str]:
    return auth_header(tokens, "E-SALES-01")


@pytest.fixture(scope="session")
def depts(api: TestClient, hr_auth: dict[str, str]) -> dict[str, str]:
    res = api.get("/api/v1/departments", headers=hr_auth)
    assert res.status_code == 200, res.text
    return {d["name"]: d["id"] for d in res.json()["items"]}


@pytest.fixture(scope="session")
def demo_survey_id(api: TestClient, hr_auth: dict[str, str]) -> str:
    res = api.get("/api/v1/surveys", headers=hr_auth)
    assert res.status_code == 200, res.text
    row = next((s for s in res.json()["items"] if s["title"] == "2026年度 従業員満足度調査（デモ）"), None)
    assert row is not None, "run scripts/seed_demo_responses.py first"
    return row["id"]


@pytest.fixture(scope="session")
def draft_survey_id(api: TestClient, hr_auth: dict[str, str]) -> str:
    res = api.get("/api/v1/surveys", headers=hr_auth)
    assert res.status_code == 200, res.text
    row = next((s for s in res.json()["items"] if s["title"] == "2026年度 従業員満足度調査"), None)
    assert row is not None, "run scripts/seed.py first"
    return row["id"]


def assert_error(res, status: int, code: str) -> None:
    assert res.status_code == status, res.text
    body = res.json()
    assert body["error_code"] == code
