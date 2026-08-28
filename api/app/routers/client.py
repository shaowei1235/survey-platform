from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user
from app.errors import ApiError
from app.models import AnswerItem, Response, Survey, SurveyStatus, User, UserRoleCode
from app.schemas import SubmitIn
from app.services.authz import require_any_role
from app.services.components import ANSWERABLE, component_map, required_answerable

router = APIRouter(prefix="/client/surveys", tags=["client"])


@router.get("")
def list_open(
    user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> dict:
    require_any_role(user, {UserRoleCode.employee})
    submitted = select(Response.survey_id).where(Response.user_id == user.id)
    items = db.scalars(
        select(Survey).where(
            Survey.company_id == user.company_id,
            Survey.status == SurveyStatus.published,
            Survey.id.not_in(submitted),
        )
    ).all()
    return {"items": [{"id": s.id, "title": s.title} for s in items]}


@router.get("/{survey_id}")
def get_open(
    survey_id: UUID, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> dict:
    require_any_role(user, {UserRoleCode.employee})
    survey = db.scalar(select(Survey).where(Survey.id == survey_id, Survey.company_id == user.company_id))
    if survey is None:
        raise ApiError("NOT_FOUND")
    if survey.status != SurveyStatus.published:
        raise ApiError("NOT_PUBLISHED")
    return {
        "id": survey.id,
        "title": survey.title,
        "status": survey.status.value,
        "component_list": survey.component_list or [],
    }


@router.post("/{survey_id}/responses", status_code=201)
def submit(
    survey_id: UUID,
    body: SubmitIn,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    require_any_role(user, {UserRoleCode.employee})
    survey = db.scalar(select(Survey).where(Survey.id == survey_id, Survey.company_id == user.company_id))
    if survey is None:
        raise ApiError("NOT_FOUND")
    if survey.status != SurveyStatus.published:
        raise ApiError("NOT_PUBLISHED")
    if db.scalar(select(Response).where(Response.survey_id == survey.id, Response.user_id == user.id)):
        raise ApiError("ALREADY_SUBMITTED")
    if not user.department_id or not user.job_grade_id or not user.generation:
        raise ApiError("VALIDATION_ERROR")
    cmap = component_map(survey.component_list or [])
    answers_by_id = {a.fe_id: a for a in body.answers}
    for req in required_answerable(survey.component_list or []):
        if req["fe_id"] not in answers_by_id:
            raise ApiError("VALIDATION_ERROR")
    for answer in body.answers:
        comp = cmap.get(answer.fe_id)
        if comp is None or comp.get("type") != answer.type:
            raise ApiError("INVALID_COMPONENT")
        if answer.type not in ANSWERABLE:
            raise ApiError("INVALID_COMPONENT")
        props = comp.get("props") or {}
        if answer.type == "radio":
            allowed = {str(o["value"]) for o in props.get("options") or []}
            if str(answer.value) not in allowed:
                raise ApiError("VALIDATION_ERROR")
        if answer.type == "checkbox":
            if not isinstance(answer.value, list):
                raise ApiError("VALIDATION_ERROR")
            allowed = {str(o["value"]) for o in props.get("options") or []}
            if any(str(v) not in allowed for v in answer.value):
                raise ApiError("VALIDATION_ERROR")
        if answer.type in {"input", "textarea"}:
            if not isinstance(answer.value, str):
                raise ApiError("VALIDATION_ERROR")
            max_len = int(props.get("maxLength") or (200 if answer.type == "input" else 2000))
            if len(answer.value) > max_len:
                raise ApiError("VALIDATION_ERROR")
    response = Response(
        survey_id=survey.id,
        user_id=user.id,
        department_id=user.department_id,
        job_grade_id=user.job_grade_id,
        generation=user.generation,
    )
    db.add(response)
    db.flush()
    for answer in body.answers:
        db.add(AnswerItem(response_id=response.id, fe_id=answer.fe_id, type=answer.type, value=answer.value))
    db.commit()
    return {"id": response.id}
