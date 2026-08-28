from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import select

from app.db import SessionLocal
from app.models import AnswerItem, Response, Survey, SurveyStatus, User
from seed import ES_QUESTIONS, likert

DEMO_TITLE = "2026年度 従業員満足度調査（デモ）"

SALES = [f"E-SALES-0{i}" for i in range(1, 6)]
HR = ["E-ADMIN", "E-HR", "E-HR-01"]

# value "1".."5" per likert question c_q1..c_q5
SALES_SCORES = {
    "E-SALES-01": ["4", "5", "3", "4", "4"],
    "E-SALES-02": ["5", "4", "4", "3", "5"],
    "E-SALES-03": ["4", "4", "2", "4", "4"],
    "E-SALES-04": ["5", "5", "4", "4", "5"],
    "E-SALES-05": ["3", "4", "3", "3", "4"],
}
HR_SCORES = {
    "E-ADMIN": ["2", "3", "2", "2", "3"],
    "E-HR": ["3", "2", "3", "2", "3"],
    "E-HR-01": ["2", "2", "2", "3", "2"],
}
SALES_COMMENTS = {
    "E-SALES-01": "残業が多く、E-SALES-01としては改善してほしいです。",
    "E-SALES-02": "顧客対応の負荷が高いです。",
    "E-SALES-03": "評価基準が分かりにくいです。",
    "E-SALES-04": "チームの雰囲気は良いです。",
    "E-SALES-05": "研修の機会を増やしてほしいです。",
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
        source = db.scalar(select(Survey).where(Survey.title == "2026年度 従業員満足度調査"))
        if source is None:
            raise SystemExit("run scripts/seed.py first")
        survey = db.scalar(select(Survey).where(Survey.company_id == source.company_id, Survey.title == DEMO_TITLE))
        if survey is None:
            survey = Survey(
                company_id=source.company_id,
                title=DEMO_TITLE,
                status=SurveyStatus.published,
                component_list=demo_components(),
                published_at=datetime.now(UTC),
                created_by=source.created_by,
            )
            db.add(survey)
            db.flush()
            print("created", DEMO_TITLE, survey.id)
        else:
            if survey.status != SurveyStatus.published:
                survey.status = SurveyStatus.published
                survey.published_at = survey.published_at or datetime.now(UTC)
            print("reuse", DEMO_TITLE, survey.id)

        plans: list[tuple[str, list[str], str | None]] = []
        for no, scores in SALES_SCORES.items():
            plans.append((no, scores, SALES_COMMENTS[no]))
        for no, scores in HR_SCORES.items():
            plans.append((no, scores, None))

        created = 0
        for employee_no, scores, comment in plans:
            user = db.scalar(select(User).where(User.company_id == source.company_id, User.employee_no == employee_no))
            if user is None or not user.department_id or not user.job_grade_id:
                raise SystemExit(f"missing user {employee_no}")
            existing = db.scalar(select(Response).where(Response.survey_id == survey.id, Response.user_id == user.id))
            if existing:
                continue
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
