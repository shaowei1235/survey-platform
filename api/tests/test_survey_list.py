from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from tests.conftest import LIKERT_ONE


def pick_default_analyzable_survey(items: list[dict]) -> dict | None:
    analyzable = [row for row in items if row.get("status") != "draft"]
    if not analyzable:
        return None

    def recency(row: dict) -> str:
        return row.get("closed_at") or row.get("published_at") or row.get("updated_at") or ""

    return max(analyzable, key=lambda row: (row.get("response_count") or 0, recency(row)))


def test_survey_list_includes_analytics_fields(
    api: TestClient, hr_auth: dict[str, str], demo_survey_id: str, draft_survey_id: str
) -> None:
    res = api.get("/api/v1/surveys", headers=hr_auth)
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    demo = next(row for row in items if row["id"] == demo_survey_id)
    draft = next(row for row in items if row["id"] == draft_survey_id)
    assert demo["status"] == "published"
    assert demo["response_count"] > 0
    assert demo["published_at"]
    assert draft["status"] == "draft"
    assert draft["response_count"] == 0
    assert draft["published_at"] is None


def test_empty_closed_survey_is_not_analytics_default(
    api: TestClient, hr_auth: dict[str, str], demo_survey_id: str
) -> None:
    created = api.post("/api/v1/surveys", headers=hr_auth, json={"title": f"QA close {uuid4().hex[:8]}"})
    assert created.status_code == 201, created.text
    leftover_id = created.json()["id"]
    assert api.patch(
        f"/api/v1/surveys/{leftover_id}", headers=hr_auth, json={"component_list": LIKERT_ONE}
    ).status_code == 200
    assert api.post(f"/api/v1/surveys/{leftover_id}/publish", headers=hr_auth).status_code == 200
    assert api.post(f"/api/v1/surveys/{leftover_id}/close", headers=hr_auth).status_code == 200

    res = api.get("/api/v1/surveys", headers=hr_auth)
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    leftover = next(row for row in items if row["id"] == leftover_id)
    assert leftover["status"] == "closed"
    assert leftover["response_count"] == 0
    assert leftover["closed_at"]
    assert items[0]["id"] == leftover_id

    picked = pick_default_analyzable_survey(items)
    assert picked is not None
    assert picked["id"] == demo_survey_id
    assert picked["response_count"] > 0
