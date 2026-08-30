import json
from collections.abc import Iterator
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import current_user
from app.errors import ApiError
from app.models import AiRun, AiRunKind, AiRunStatus, User
from app.rate_limit import check_ai_rate
from app.schemas import IntentIn, SummaryIn
from app.services.analytics import (
    _survey_for_company,
    build_intent_evidence,
    collect_quotes,
    cross_tab,
    subtree_department_ids,
)
from app.services.authz import ANALYST_ROLES, assert_department_in_scope, require_any_role
from app.services.llm import (
    INTENT_SCHEMA,
    INTENT_STREAM_SYSTEM,
    INTENT_SYSTEM,
    SUMMARY_SCHEMA,
    SUMMARY_STREAM_SYSTEM,
    SUMMARY_SYSTEM,
    assert_model_numbers,
    assert_summary_has_no_counts,
    complete_json,
    stream_markdown,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _sse_response(chunks: Iterator[str]) -> StreamingResponse:
    return StreamingResponse(chunks, media_type="text/event-stream", headers=SSE_HEADERS)


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
    quotes = collect_quotes(db, survey, subtree_department_ids(db, user, body.department_id), nos)
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
    evidence = build_intent_evidence(db, user, survey, body.department_id)
    if not evidence["low_questions"]:
        return {
            "ai_run_id": None,
            "intent": body.intent,
            "conclusion": "",
            "message_key": "analyze.insufficient_n",
            "evidence": {"questions": [], "quotes": [], "low_questions": []},
        }
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


@router.post("/intent/stream")
def run_intent_stream(
    body: IntentIn, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> StreamingResponse:
    require_any_role(user, ANALYST_ROLES)
    check_ai_rate(str(user.id))
    if body.intent != "dept_low_score_and_causes":
        raise ApiError("UNKNOWN_INTENT")
    survey = _survey_for_company(db, user, body.survey_id)
    assert_department_in_scope(db, user, body.department_id)
    evidence = build_intent_evidence(db, user, survey, body.department_id)

    def generate() -> Iterator[str]:
        yield _sse("evidence", evidence)
        if not evidence["low_questions"]:
            yield _sse("done", {"ai_run_id": None, "message_key": "analyze.insufficient_n"})
            return
        try:
            chunks: list[str] = []
            for delta in stream_markdown(INTENT_STREAM_SYSTEM, {"evidence": evidence}):
                chunks.append(delta)
                yield _sse("delta", {"text": delta})
            full = "".join(chunks).strip()
            if not full:
                raise ApiError("AI_UPSTREAM_FAILED")
            assert_model_numbers({"conclusion": full}, evidence)
            run = AiRun(
                company_id=user.company_id,
                survey_id=survey.id,
                requester_id=user.id,
                kind=AiRunKind.intent,
                intent=body.intent,
                department_id=body.department_id,
                query_snapshot={
                    "survey_id": str(survey.id),
                    "intent": body.intent,
                    "department_id": str(body.department_id),
                },
                evidence=evidence,
                conclusion=full,
                model=settings.llm_model or None,
                status=AiRunStatus.succeeded,
            )
            db.add(run)
            db.commit()
            yield _sse("done", {"ai_run_id": str(run.id)})
        except ApiError as exc:
            db.rollback()
            yield _sse("error", {"error_code": exc.error_code, "message_key": exc.message_key})
        except Exception:
            db.rollback()
            yield _sse("error", {"error_code": "AI_UPSTREAM_FAILED", "message_key": "error.ai_upstream"})

    return _sse_response(generate())


@router.post("/free-text-summary/stream")
def free_text_summary_stream(
    body: SummaryIn, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> StreamingResponse:
    require_any_role(user, ANALYST_ROLES)
    check_ai_rate(str(user.id))
    survey = _survey_for_company(db, user, body.survey_id)
    assert_department_in_scope(db, user, body.department_id)
    nos = list(db.scalars(select(User.employee_no).where(User.company_id == user.company_id)))
    quotes = collect_quotes(db, survey, subtree_department_ids(db, user, body.department_id), nos)

    def generate() -> Iterator[str]:
        yield _sse("evidence", {"quotes": quotes})
        try:
            chunks: list[str] = []
            for delta in stream_markdown(SUMMARY_STREAM_SYSTEM, {"quotes": quotes}):
                chunks.append(delta)
                yield _sse("delta", {"text": delta})
            full = "".join(chunks).strip()
            if not full:
                raise ApiError("AI_UPSTREAM_FAILED")
            assert_summary_has_no_counts({"markdown": full})
            run = AiRun(
                company_id=user.company_id,
                survey_id=survey.id,
                requester_id=user.id,
                kind=AiRunKind.free_text_summary,
                department_id=body.department_id,
                query_snapshot={"survey_id": str(survey.id), "department_id": str(body.department_id)},
                evidence={"quotes": quotes},
                conclusion=full,
                model=settings.llm_model or None,
                status=AiRunStatus.succeeded,
            )
            db.add(run)
            db.commit()
            yield _sse("done", {"ai_run_id": str(run.id)})
        except ApiError as exc:
            db.rollback()
            yield _sse("error", {"error_code": exc.error_code, "message_key": exc.message_key})
        except Exception:
            db.rollback()
            yield _sse("error", {"error_code": "AI_UPSTREAM_FAILED", "message_key": "error.ai_upstream"})

    return _sse_response(generate())
