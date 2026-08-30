from __future__ import annotations

import json

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import AiRun
from tests.conftest import assert_error


def parse_sse(text: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in text.replace("\r\n", "\n").strip().split("\n\n"):
        if not block.strip():
            continue
        event = "message"
        payload = None
        for line in block.split("\n"):
            if line.startswith("event: "):
                event = line[7:]
            elif line.startswith("data: "):
                payload = json.loads(line[6:])
        events.append((event, payload or {}))
    return events


def _ai_run_count() -> int:
    with SessionLocal() as db:
        return int(db.scalar(select(func.count()).select_from(AiRun)) or 0)


def test_intent_stream_evidence_before_delta(
    api: TestClient, hr_auth: dict[str, str], demo_survey_id: str, depts: dict[str, str], monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.routers.analytics.stream_markdown",
        lambda *_args, **_kwargs: iter(["営業", "部では負荷が目立ちます。"]),
    )
    res = api.post(
        "/api/v1/analytics/intent/stream",
        headers=hr_auth,
        json={"survey_id": demo_survey_id, "intent": "dept_low_score_and_causes", "department_id": depts["営業部"]},
    )
    assert res.status_code == 200, res.text
    assert "text/event-stream" in res.headers.get("content-type", "")
    events = parse_sse(res.text)
    names = [name for name, _ in events]
    assert names[0] == "evidence"
    assert "delta" in names
    assert names[-1] == "done"
    assert events[0][1]["low_questions"]
    markdown = "".join(item[1].get("text") or "" for item in events if item[0] == "delta")
    assert "負荷" in markdown
    assert events[-1][1].get("ai_run_id")


def test_intent_stream_number_mismatch_no_run(
    api: TestClient, hr_auth: dict[str, str], demo_survey_id: str, depts: dict[str, str], monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.routers.analytics.stream_markdown",
        lambda *_args, **_kwargs: iter(["平均点は1.11です。"]),
    )
    before = _ai_run_count()
    res = api.post(
        "/api/v1/analytics/intent/stream",
        headers=hr_auth,
        json={"survey_id": demo_survey_id, "intent": "dept_low_score_and_causes", "department_id": depts["営業部"]},
    )
    assert res.status_code == 200, res.text
    events = parse_sse(res.text)
    assert events[0][0] == "evidence"
    err = next((data for name, data in events if name == "error"), None)
    assert err is not None
    assert err["error_code"] == "AI_NUMBER_MISMATCH"
    assert all(name != "done" for name, _ in events)
    assert _ai_run_count() == before


def test_intent_stream_insufficient_n_skips_llm(
    api: TestClient, hr_auth: dict[str, str], demo_survey_id: str, depts: dict[str, str], monkeypatch
) -> None:
    called = {"n": 0}

    def fake_stream(*_args, **_kwargs):
        called["n"] += 1
        yield "should not run"

    monkeypatch.setattr("app.routers.analytics.stream_markdown", fake_stream)
    res = api.post(
        "/api/v1/analytics/intent/stream",
        headers=hr_auth,
        json={"survey_id": demo_survey_id, "intent": "dept_low_score_and_causes", "department_id": depts["開発部"]},
    )
    assert res.status_code == 200, res.text
    assert called["n"] == 0
    events = parse_sse(res.text)
    assert events[0][0] == "evidence"
    assert events[-1][0] == "done"
    assert events[-1][1]["message_key"] == "analyze.insufficient_n"
    assert events[-1][1]["ai_run_id"] is None


def test_summary_stream_evidence_before_delta(
    api: TestClient, hr_auth: dict[str, str], demo_survey_id: str, depts: dict[str, str], monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.routers.analytics.stream_markdown",
        lambda *_args, **_kwargs: iter(["- **残業**（多い）\n", "負荷が高い。"]),
    )
    res = api.post(
        "/api/v1/analytics/free-text-summary/stream",
        headers=hr_auth,
        json={"survey_id": demo_survey_id, "department_id": depts["営業部"]},
    )
    assert res.status_code == 200, res.text
    events = parse_sse(res.text)
    assert events[0][0] == "evidence"
    assert "quotes" in events[0][1]
    assert any(name == "delta" for name, _ in events)
    assert events[-1][0] == "done"


def test_employee_cannot_stream_intent(
    api: TestClient, sales_emp_auth: dict[str, str], demo_survey_id: str, depts: dict[str, str]
) -> None:
    res = api.post(
        "/api/v1/analytics/intent/stream",
        headers=sales_emp_auth,
        json={"survey_id": demo_survey_id, "intent": "dept_low_score_and_causes", "department_id": depts["営業部"]},
    )
    assert_error(res, 403, "FORBIDDEN_ROLE")
