from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import current_user
from app.errors import ApiError
from app.models import AiRun, AiRunKind, AiRunStatus, Department, User
from app.rate_limit import check_ai_rate
from app.schemas import IntentIn, SummaryIn
from app.services.analytics import _survey_for_company, collect_quotes, cross_tab
from app.services.authz import ANALYST_ROLES, assert_department_in_scope, is_dept_manager_only, require_any_role
from app.services.llm import (
    INTENT_SCHEMA,
    INTENT_SYSTEM,
    SUMMARY_SCHEMA,
    SUMMARY_SYSTEM,
    assert_model_numbers,
    assert_summary_has_no_counts,
    complete_json,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/cross-tab")
def get_cross_tab(
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
    survey_id: UUID,
    department_id: UUID | None = None,
    generation: str | None = Query(default=None),
    job_grade_id: UUID | None = None,
) -> dict:
    return cross_tab(db, user, survey_id, department_id, generation, job_grade_id)


@router.post("/free-text-summary")
def free_text_summary(
    body: SummaryIn, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> dict:
    require_any_role(user, ANALYST_ROLES)
    check_ai_rate(str(user.id))
    survey = _survey_for_company(db, user, body.survey_id)
    assert_department_in_scope(db, user, body.department_id)
    nos = list(db.scalars(select(User.employee_no).where(User.company_id == user.company_id)))
    quotes = collect_quotes(db, survey, [body.department_id], nos)
    parsed = complete_json(SUMMARY_SYSTEM, {"quotes": quotes}, SUMMARY_SCHEMA, "summary_result")
    assert_summary_has_no_counts(parsed)
    run = AiRun(
        company_id=user.company_id,
        survey_id=survey.id,
        requester_id=user.id,
        kind=AiRunKind.free_text_summary,
        department_id=body.department_id,
        query_snapshot={"survey_id": str(survey.id), "department_id": str(body.department_id)},
        evidence={"quotes": quotes},
        conclusion=parsed.get("negative_tendency"),
        model=settings.llm_model or None,
        status=AiRunStatus.succeeded,
    )
    db.add(run)
    db.commit()
    return {
        "ai_run_id": run.id,
        "topics": parsed.get("topics") or [],
        "negative_tendency": parsed.get("negative_tendency") or "",
        "quotes": quotes,
    }


@router.post("/intent")
def run_intent(body: IntentIn, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    require_any_role(user, ANALYST_ROLES)
    check_ai_rate(str(user.id))
    if body.intent != "dept_low_score_and_causes":
        raise ApiError("UNKNOWN_INTENT")
    survey = _survey_for_company(db, user, body.survey_id)
    assert_department_in_scope(db, user, body.department_id)
    tab = cross_tab(db, user, body.survey_id, body.department_id, None, None)
    company_tab = cross_tab(db, user, body.survey_id, None, None, None)
    row = next((r for r in tab["rows"] if r["department_id"] == body.department_id), None)
    if row is None:
        raise ApiError("NOT_FOUND")
    low = []
    for cell, q in zip(row["cells"], tab["questions"], strict=False):
        if cell["masked"] or cell["avg_score"] is None:
            continue
        low.append(
            {
                "fe_id": cell["fe_id"],
                "title": q["title"],
                "avg_score": cell["avg_score"],
                "n": cell["n"],
                "masked": False,
            }
        )
    low.sort(key=lambda x: x["avg_score"])
    low = low[:5]
    if not low:
        return {
            "ai_run_id": None,
            "intent": body.intent,
            "conclusion": "",
            "message_key": "analyze.insufficient_n",
            "evidence": {"questions": [], "quotes": [], "low_questions": []},
        }
    dept_avgs = {c["fe_id"]: c["avg_score"] for c in row["cells"] if not c["masked"]}
    bench: dict[str, float] = {}
    for q in tab["questions"]:
        vals = []
        for r in company_tab["rows"]:
            cell = next((c for c in r["cells"] if c["fe_id"] == q["fe_id"] and not c["masked"] and c["avg_score"] is not None), None)
            if cell:
                vals.append(cell["avg_score"])
        if vals:
            bench[q["fe_id"]] = round(sum(vals) / len(vals), 4)
    nos = list(db.scalars(select(User.employee_no).where(User.company_id == user.company_id)))
    quotes = collect_quotes(db, survey, [body.department_id], nos)
    dept = db.scalar(select(Department).where(Department.id == body.department_id))
    evidence = {
        "department_id": str(body.department_id),
        "department_name": dept.name if dept else "",
        "department_avg_by_fe_id": dept_avgs,
        "low_questions": low,
        "quotes": quotes,
        "charts": [{"id": "bar_dept_scores", "type": "bar", "title_key": "chart.dept_scores"}],
    }
    if is_dept_manager_only(user):
        evidence["benchmark_avg_by_fe_id"] = bench
    else:
        evidence["company_avg_by_fe_id"] = bench
        evidence["benchmark_avg_by_fe_id"] = bench
    parsed = complete_json(INTENT_SYSTEM, {"evidence": evidence}, INTENT_SCHEMA, "intent_result")
    assert_model_numbers(parsed, evidence)
    conclusion = parsed.get("conclusion") or ""
    run = AiRun(
        company_id=user.company_id,
        survey_id=survey.id,
        requester_id=user.id,
        kind=AiRunKind.intent,
        intent=body.intent,
        department_id=body.department_id,
        query_snapshot={"survey_id": str(survey.id), "intent": body.intent, "department_id": str(body.department_id)},
        evidence=evidence,
        conclusion=conclusion,
        model=settings.llm_model or None,
        status=AiRunStatus.succeeded,
    )
    db.add(run)
    db.commit()
    return {"ai_run_id": run.id, "intent": body.intent, "conclusion": conclusion, "evidence": evidence}
