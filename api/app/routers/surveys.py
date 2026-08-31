from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user
from app.errors import ApiError
from app.models import Response, Survey, SurveyStatus, User
from app.schemas import SurveyCreate, SurveyListItem, SurveyOut, SurveyPatch
from app.services.authz import ADMIN_ROLES, SURVEY_WRITE_ROLES, require_any_role
from app.services.components import has_answerable, validate_component_list
from app.services.surveys import delete_survey_cascade

router = APIRouter(prefix="/surveys", tags=["surveys"])


def _out(survey: Survey) -> SurveyOut:
    return SurveyOut(
        id=survey.id,
        title=survey.title,
        status=survey.status.value,
        component_list=survey.component_list or [],
        published_at=survey.published_at,
        closed_at=survey.closed_at,
        updated_at=survey.updated_at,
    )


@router.get("", response_model=dict)
def list_surveys(user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    require_any_role(user, ADMIN_ROLES)
    response_count = (
        select(func.count()).select_from(Response).where(Response.survey_id == Survey.id).scalar_subquery()
    )
    rows = db.execute(
        select(Survey, response_count)
        .where(Survey.company_id == user.company_id)
        .order_by(Survey.updated_at.desc())
    ).all()
    return {
        "items": [
            SurveyListItem(
                id=survey.id,
                title=survey.title,
                status=survey.status.value,
                updated_at=survey.updated_at,
                published_at=survey.published_at,
                closed_at=survey.closed_at,
                response_count=count or 0,
            ).model_dump()
            for survey, count in rows
        ]
    }


@router.post("", response_model=SurveyOut, status_code=201)
def create_survey(
    body: SurveyCreate, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> SurveyOut:
    require_any_role(user, SURVEY_WRITE_ROLES)
    survey = Survey(company_id=user.company_id, title=body.title, component_list=[], created_by=user.id)
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return _out(survey)


@router.get("/{survey_id}", response_model=SurveyOut)
def get_survey(
    survey_id: UUID, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> SurveyOut:
    require_any_role(user, ADMIN_ROLES)
    survey = db.scalar(select(Survey).where(Survey.id == survey_id, Survey.company_id == user.company_id))
    if survey is None:
        raise ApiError("NOT_FOUND")
    return _out(survey)


@router.patch("/{survey_id}", response_model=SurveyOut)
def patch_survey(
    survey_id: UUID,
    body: SurveyPatch,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SurveyOut:
    require_any_role(user, SURVEY_WRITE_ROLES)
    survey = db.scalar(select(Survey).where(Survey.id == survey_id, Survey.company_id == user.company_id))
    if survey is None:
        raise ApiError("NOT_FOUND")
    if survey.status != SurveyStatus.draft:
        raise ApiError("SURVEY_NOT_EDITABLE")
    data = body.model_dump(exclude_unset=True)
    if "component_list" in data:
        validate_component_list(data["component_list"])
        survey.component_list = data["component_list"]
    if "title" in data and data["title"] is not None:
        survey.title = data["title"]
    db.commit()
    db.refresh(survey)
    return _out(survey)


@router.post("/{survey_id}/publish", response_model=SurveyOut)
def publish(
    survey_id: UUID, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> SurveyOut:
    require_any_role(user, SURVEY_WRITE_ROLES)
    survey = db.scalar(select(Survey).where(Survey.id == survey_id, Survey.company_id == user.company_id))
    if survey is None:
        raise ApiError("NOT_FOUND")
    if survey.status != SurveyStatus.draft:
        raise ApiError("SURVEY_NOT_EDITABLE")
    validate_component_list(survey.component_list or [])
    if not has_answerable(survey.component_list or []):
        raise ApiError("VALIDATION_ERROR")
    survey.status = SurveyStatus.published
    survey.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(survey)
    return _out(survey)


@router.post("/{survey_id}/close", response_model=SurveyOut)
def close(
    survey_id: UUID, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> SurveyOut:
    require_any_role(user, SURVEY_WRITE_ROLES)
    survey = db.scalar(select(Survey).where(Survey.id == survey_id, Survey.company_id == user.company_id))
    if survey is None:
        raise ApiError("NOT_FOUND")
    if survey.status != SurveyStatus.published:
        raise ApiError("SURVEY_NOT_EDITABLE")
    survey.status = SurveyStatus.closed
    survey.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(survey)
    return _out(survey)


@router.delete("/{survey_id}", status_code=204)
def delete_survey(
    survey_id: UUID, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> None:
    require_any_role(user, SURVEY_WRITE_ROLES)
    survey = db.scalar(select(Survey).where(Survey.id == survey_id, Survey.company_id == user.company_id))
    if survey is None:
        raise ApiError("NOT_FOUND")
    if survey.status != SurveyStatus.draft:
        raise ApiError("SURVEY_NOT_DELETABLE")
    delete_survey_cascade(db, survey)
    db.commit()
