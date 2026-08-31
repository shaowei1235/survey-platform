from __future__ import annotations

from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal
from app.models import AiRun, AiRunKind, AiRunStatus, AnswerItem, Response, Survey, User

from tests.conftest import LIKERT_ONE, assert_error


def _create_draft(api: TestClient, hr_auth: dict[str, str]) -> str:
    created = api.post("/api/v1/surveys", headers=hr_auth, json={"title": f"QA del {uuid4().hex[:8]}"})
    assert created.status_code == 201, created.text
    return created.json()["id"]


def test_delete_draft_succeeds(api: TestClient, hr_auth: dict[str, str]) -> None:
    survey_id = _create_draft(api, hr_auth)
    res = api.delete(f"/api/v1/surveys/{survey_id}", headers=hr_auth)
    assert res.status_code == 204, res.text
    listed = api.get("/api/v1/surveys", headers=hr_auth)
    assert listed.status_code == 200, listed.text
    assert all(row["id"] != survey_id for row in listed.json()["items"])
    got = api.get(f"/api/v1/surveys/{survey_id}", headers=hr_auth)
    assert_error(got, 404, "NOT_FOUND")


def test_delete_published_rejected(api: TestClient, hr_auth: dict[str, str], demo_survey_id: str) -> None:
    res = api.delete(f"/api/v1/surveys/{demo_survey_id}", headers=hr_auth)
    assert_error(res, 409, "SURVEY_NOT_DELETABLE")
    got = api.get(f"/api/v1/surveys/{demo_survey_id}", headers=hr_auth)
    assert got.status_code == 200, got.text
    assert got.json()["status"] == "published"


def test_delete_closed_rejected(api: TestClient, hr_auth: dict[str, str]) -> None:
    survey_id = _create_draft(api, hr_auth)
    assert api.patch(
        f"/api/v1/surveys/{survey_id}", headers=hr_auth, json={"component_list": LIKERT_ONE}
    ).status_code == 200
    assert api.post(f"/api/v1/surveys/{survey_id}/publish", headers=hr_auth).status_code == 200
    assert api.post(f"/api/v1/surveys/{survey_id}/close", headers=hr_auth).status_code == 200
    res = api.delete(f"/api/v1/surveys/{survey_id}", headers=hr_auth)
    assert_error(res, 409, "SURVEY_NOT_DELETABLE")
    got = api.get(f"/api/v1/surveys/{survey_id}", headers=hr_auth)
    assert got.status_code == 200, got.text
    assert got.json()["status"] == "closed"


def test_delete_employee_forbidden(
    api: TestClient, hr_auth: dict[str, str], sales_emp_auth: dict[str, str]
) -> None:
    survey_id = _create_draft(api, hr_auth)
    res = api.delete(f"/api/v1/surveys/{survey_id}", headers=sales_emp_auth)
    assert_error(res, 403, "FORBIDDEN_ROLE")
    got = api.get(f"/api/v1/surveys/{survey_id}", headers=hr_auth)
    assert got.status_code == 200, got.text


def test_delete_draft_cascades_related_rows(api: TestClient, hr_auth: dict[str, str]) -> None:
    survey_id = _create_draft(api, hr_auth)
    survey_uuid = UUID(survey_id)
    me = api.get("/api/v1/me", headers=hr_auth)
    assert me.status_code == 200, me.text
    user_id = UUID(me.json()["id"])
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.id == user_id))
        assert user is not None
        response = Response(
            survey_id=survey_uuid,
            user_id=user.id,
            department_id=user.department_id,
            job_grade_id=user.job_grade_id,
            generation=user.generation,
        )
        db.add(response)
        db.flush()
        db.add(AnswerItem(response_id=response.id, fe_id="c_q1", type="radio", value="1"))
        db.add(
            AiRun(
                company_id=user.company_id,
                survey_id=survey_uuid,
                requester_id=user.id,
                kind=AiRunKind.intent,
                query_snapshot={"survey_id": survey_id},
                status=AiRunStatus.succeeded,
            )
        )
        db.commit()
        response_id = response.id

    res = api.delete(f"/api/v1/surveys/{survey_id}", headers=hr_auth)
    assert res.status_code == 204, res.text
    with SessionLocal() as db:
        assert db.scalar(select(Survey).where(Survey.id == survey_uuid)) is None
        assert db.scalar(select(Response).where(Response.id == response_id)) is None
        assert db.scalar(select(AnswerItem).where(AnswerItem.response_id == response_id)) is None
        assert db.scalar(select(AiRun).where(AiRun.survey_id == survey_uuid)) is None
