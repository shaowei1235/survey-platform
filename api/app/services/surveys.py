from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import AiRun, Response, Survey


def delete_survey_cascade(db: Session, survey: Survey) -> None:
    db.execute(delete(AiRun).where(AiRun.survey_id == survey.id))
    db.execute(delete(Response).where(Response.survey_id == survey.id))
    db.delete(survey)
