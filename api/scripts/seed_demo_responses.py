from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import delete, select

from app.db import SessionLocal
from app.models import AiRun, AnswerItem, Response, Survey, SurveyStatus, User
from seed import DEMO_TITLE, DRAFT_TITLE, ES_QUESTIONS, REALISTIC_SURVEY_TITLES, likert

KEEP_TITLES = {DRAFT_TITLE, DEMO_TITLE, *REALISTIC_SURVEY_TITLES}

SALES1_SCORES = {
    "E-SALES-01": ["4", "5", "3", "4", "4"],
    "E-SALES-02": ["5", "4", "4", "3", "5"],
    "E-SALES-03": ["4", "4", "2", "4", "4"],
    "E-SALES-04": ["5", "5", "4", "4", "5"],
    "E-SALES-05": ["3", "4", "3", "3", "4"],
}
SALES2_SCORES = {
    "E-SALES-06": ["4", "4", "3", "4", "4"],
    "E-SALES-07": ["5", "4", "2", "3", "4"],
    "E-SALES-08": ["4", "5", "3", "3", "5"],
}
HR_SCORES = {
    "E-ADMIN": ["2", "3", "2", "2", "3"],
    "E-HR": ["3", "2", "3", "2", "3"],
    "E-HR-01": ["2", "2", "2", "3", "2"],
}
SALES1_COMMENTS = {
    "E-SALES-01": "月末の残業が続き、家族との時間が取れません。",
    "E-SALES-02": "顧客対応の負荷が高く、休みの日も連絡が来ます。",
    "E-SALES-03": "評価基準が現場の仕事内容と噛み合っていないと感じます。",
    "E-SALES-04": "課内の雰囲気は良く、相談しやすいです。",
    "E-SALES-05": "新任でも受けられる研修の枠を増やしてほしいです。",
}
SALES2_COMMENTS = {
    "E-SALES-06": "少人数のため、休み希望が通りにくいです。",
    "E-SALES-07": "目標数字の共有が直前になり、準備が間に合いません。",
    "E-SALES-08": "他課との情報共有が少なく、同じ顧客に重複して当たることがあります。",
}


def demo_components() -> list[dict]:
    components = [
        {
            "fe_id": "c_intro",
            "type": "paragraph",
            "props": {"title": "本調査は職場改善のために実施します。個人が特定される形では利用しません。"},
        }
    ]
    for idx, q in enumerate(ES_QUESTIONS, start=1):
        components.append(likert(f"c_q{idx}", q))
    components.append(
        {"fe_id": "c_t1", "type": "textarea", "props": {"title": "改善してほしい点", "required": False, "maxLength": 2000}}
    )
    return components


def answers_for(scores: list[str], comment: str | None) -> list[tuple[str, str, object]]:
    out: list[tuple[str, str, object]] = []
    for i, value in enumerate(scores, start=1):
        out.append((f"c_q{i}", "radio", value))
    if comment:
        out.append(("c_t1", "textarea", comment))
    return out


def seed_demo() -> None:
    db = SessionLocal()
    try:
        source = db.scalar(select(Survey).where(Survey.title == DRAFT_TITLE))
        if source is None:
            raise SystemExit("run scripts/seed.py first")

        extras = db.scalars(
            select(Survey).where(Survey.company_id == source.company_id, Survey.title.not_in(KEEP_TITLES))
        ).all()
        for survey in extras:
            db.execute(delete(AiRun).where(AiRun.survey_id == survey.id))
            db.execute(delete(Response).where(Response.survey_id == survey.id))
            db.delete(survey)
        db.flush()

        survey = db.scalar(select(Survey).where(Survey.company_id == source.company_id, Survey.title == DEMO_TITLE))
        if survey is None:
            survey = Survey(
                company_id=source.company_id,
                title=DEMO_TITLE,
                status=SurveyStatus.published,
                component_list=demo_components(),
                published_at=datetime.now(timezone.utc),
                created_by=source.created_by,
            )
            db.add(survey)
            db.flush()
            print("created", DEMO_TITLE, survey.id)
        else:
            survey.status = SurveyStatus.published
            survey.published_at = survey.published_at or datetime.now(timezone.utc)
            survey.component_list = demo_components()
            db.execute(delete(AiRun).where(AiRun.survey_id == survey.id))
            db.execute(delete(Response).where(Response.survey_id == survey.id))
            db.flush()
            print("reset", DEMO_TITLE, survey.id)

        plans: list[tuple[str, list[str], str | None]] = []
        for no, scores in SALES1_SCORES.items():
            plans.append((no, scores, SALES1_COMMENTS[no]))
        for no, scores in SALES2_SCORES.items():
            plans.append((no, scores, SALES2_COMMENTS[no]))
        for no, scores in HR_SCORES.items():
            plans.append((no, scores, None))

        created = 0
        for employee_no, scores, comment in plans:
            user = db.scalar(select(User).where(User.company_id == source.company_id, User.employee_no == employee_no))
            if user is None or not user.department_id or not user.job_grade_id:
                raise SystemExit(f"missing user {employee_no}")
            response = Response(
                survey_id=survey.id,
                user_id=user.id,
                department_id=user.department_id,
                job_grade_id=user.job_grade_id,
                generation=user.generation,
            )
            db.add(response)
            db.flush()
            for fe_id, typ, value in answers_for(scores, comment):
                db.add(AnswerItem(response_id=response.id, fe_id=fe_id, type=typ, value=value))
            created += 1
        db.commit()
        print(f"demo responses added={created} survey_id={survey.id}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
