from __future__ import annotations

from collections import defaultdict
from statistics import mean
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import ApiError
from app.models import AnswerItem, Department, Response, Survey, SurveyStatus, User, UserGeneration
from app.services.authz import ANALYST_ROLES, assert_department_in_scope, is_dept_manager_only, require_any_role, scope_department_ids
from app.services.components import likert_questions, option_score
from app.services.deidentify import sanitize_quote


def _survey_for_company(db: Session, user: User, survey_id: UUID) -> Survey:
    survey = db.scalar(select(Survey).where(Survey.id == survey_id, Survey.company_id == user.company_id))
    if survey is None:
        raise ApiError("NOT_FOUND")
    if survey.status == SurveyStatus.draft:
        raise ApiError("NOT_FOUND")
    return survey


def _response_query(db: Session, survey_id: UUID, dept_ids: list[UUID], generation: str | None, job_grade_id: UUID | None):
    stmt = select(Response).where(Response.survey_id == survey_id, Response.department_id.in_(dept_ids))
    if generation:
        stmt = stmt.where(Response.generation == UserGeneration(generation))
    if job_grade_id:
        stmt = stmt.where(Response.job_grade_id == job_grade_id)
    return db.scalars(stmt).all()


def cross_tab(
    db: Session,
    user: User,
    survey_id: UUID,
    department_id: UUID | None,
    generation: str | None,
    job_grade_id: UUID | None,
) -> dict:
    require_any_role(user, ANALYST_ROLES)
    survey = _survey_for_company(db, user, survey_id)
    scope = scope_department_ids(db, user)
    if department_id:
        assert_department_in_scope(db, user, department_id)
        row_depts = [department_id]
    else:
        row_depts = scope
    questions = likert_questions(survey.component_list or [])
    responses = _response_query(db, survey.id, row_depts, generation, job_grade_id)
    resp_ids = [r.id for r in responses]
    items = []
    if resp_ids:
        items = db.scalars(select(AnswerItem).where(AnswerItem.response_id.in_(resp_ids))).all()
    by_resp_dept = {r.id: r.department_id for r in responses}
    scores: dict[tuple[UUID, str], list[int]] = defaultdict(list)
    for item in items:
        dept_id = by_resp_dept.get(item.response_id)
        if dept_id is None:
            continue
        q = next((x for x in questions if x["fe_id"] == item.fe_id), None)
        if q is None:
            continue
        scored = option_score(q, str(item.value))
        if scored is None:
            continue
        scores[(dept_id, item.fe_id)].append(scored)
    hide_n = is_dept_manager_only(user)
    depts = {d.id: d for d in db.scalars(select(Department).where(Department.id.in_(row_depts))).all()}
    rows = []
    for dept_id in row_depts:
        dept = depts.get(dept_id)
        if dept is None:
            continue
        cells = []
        for q in questions:
            values = scores.get((dept_id, q["fe_id"]), [])
            n = len(values)
            masked = n < settings.min_cell_n
            cell = {
                "fe_id": q["fe_id"],
                "n": None if (masked and hide_n) else n,
                "avg_score": None if masked else (round(mean(values), 4) if values else None),
                "masked": masked,
            }
            cells.append(cell)
        rows.append({"department_id": dept_id, "department_name": dept.name, "cells": cells})
    return {
        "survey_id": survey.id,
        "questions": [
            {"fe_id": q["fe_id"], "title": (q.get("props") or {}).get("title", ""), "score_enabled": True} for q in questions
        ],
        "rows": rows,
        "charts": [{"id": "bar_dept_scores", "type": "bar", "title_key": "chart.dept_scores"}],
    }


def collect_quotes(db: Session, survey: Survey, dept_ids: list[UUID], employee_nos: list[str], fe_ids: set[str] | None = None) -> list[dict]:
    responses = db.scalars(
        select(Response).where(Response.survey_id == survey.id, Response.department_id.in_(dept_ids))
    ).all()
    if not responses:
        return []
    items = db.scalars(
        select(AnswerItem).where(AnswerItem.response_id.in_([r.id for r in responses]), AnswerItem.type == "textarea")
    ).all()
    quotes = []
    for item in items:
        if fe_ids is not None and item.fe_id not in fe_ids:
            continue
        text = item.value if isinstance(item.value, str) else None
        cleaned = sanitize_quote(text or "", employee_nos)
        if cleaned:
            quotes.append({"text": cleaned, "fe_id": item.fe_id})
        if len(quotes) >= 30:
            break
    return quotes
