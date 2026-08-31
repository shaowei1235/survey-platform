from __future__ import annotations

import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import (
    AiRun,
    Company,
    Department,
    JobGrade,
    Response,
    Survey,
    SurveyStatus,
    User,
    UserGeneration,
    UserRole,
    UserRoleCode,
)
from app.security import hash_password

LIKERT_OPTIONS = [
    {"value": "1", "label": "全くそう思わない", "score": 1},
    {"value": "2", "label": "そう思わない", "score": 2},
    {"value": "3", "label": "どちらともいえない", "score": 3},
    {"value": "4", "label": "そう思う", "score": 4},
    {"value": "5", "label": "非常にそう思う", "score": 5},
]

ES_QUESTIONS = [
    "上司は相談に乗ってくれる",
    "成長できる機会がある",
    "労働時間は適正である",
    "人事制度は公平である",
    "知人にこの会社を勧めたい",
]

DRAFT_TITLE = "2026年度 従業員満足度調査"
DEMO_TITLE = "2026年度 従業員満足度調査（デモ）"

TITLE_ES_2025 = "2025年度 従業員満足度調査"
TITLE_ONBOARDING = "2026年度 入社後フォローアンケート"
TITLE_CAREER = "2026年度 キャリア開発意向調査"
TITLE_TRAINING = "2025年度 新任管理職研修 受講後アンケート"
TITLE_PULSE = "2026年度 職場環境パルス調査"

REALISTIC_SURVEY_TITLES = frozenset(
    {TITLE_ES_2025, TITLE_ONBOARDING, TITLE_CAREER, TITLE_TRAINING, TITLE_PULSE}
)
PROTECTED_TITLES = frozenset({DRAFT_TITLE, DEMO_TITLE, *REALISTIC_SURVEY_TITLES})
JUNK_DEPARTMENT_NAMES = frozenset({"UI検証部署"})
DEFAULT_NEW_SURVEY_TITLE = "新規アンケート"


def likert(fe_id: str, title: str) -> dict:
    return {
        "fe_id": fe_id,
        "type": "radio",
        "props": {"title": title, "required": True, "scoreEnabled": True, "options": LIKERT_OPTIONS},
    }


def paragraph(fe_id: str, title: str) -> dict:
    return {"fe_id": fe_id, "type": "paragraph", "props": {"title": title}}


def textarea(fe_id: str, title: str, *, required: bool = False) -> dict:
    return {"fe_id": fe_id, "type": "textarea", "props": {"title": title, "required": required, "maxLength": 2000}}


def is_leftover_test_survey(title: str) -> bool:
    if title in PROTECTED_TITLES:
        return False
    stripped = title.strip()
    if stripped.startswith("QA"):
        rest = stripped[2:]
        if not rest or rest[0].isspace() or rest.startswith("設問"):
            return True
    return stripped == DEFAULT_NEW_SURVEY_TITLE


def delete_survey_cascade(db: Session, survey: Survey) -> None:
    db.execute(delete(AiRun).where(AiRun.survey_id == survey.id))
    db.execute(delete(Response).where(Response.survey_id == survey.id))
    db.delete(survey)


def cleanup_leftover_surveys(db: Session, company_id) -> int:
    leftovers = [
        survey
        for survey in db.scalars(select(Survey).where(Survey.company_id == company_id)).all()
        if is_leftover_test_survey(survey.title)
    ]
    for survey in leftovers:
        delete_survey_cascade(db, survey)
    if leftovers:
        db.flush()
    return len(leftovers)


def _reassign_department_refs(db: Session, from_id, to_id) -> None:
    for role in db.scalars(select(UserRole).where(UserRole.department_id == from_id)):
        role.department_id = to_id
    for response in db.scalars(select(Response).where(Response.department_id == from_id)):
        response.department_id = to_id
    for run in db.scalars(select(AiRun).where(AiRun.department_id == from_id)):
        run.department_id = to_id


def _fallback_department_id(user: User, jinji_id, keiei_id, zensha_id):
    roles = {role.role for role in (user.roles or [])}
    if UserRoleCode.executive in roles and keiei_id is not None:
        return keiei_id
    if jinji_id is not None:
        return jinji_id
    return zensha_id


def _delete_department_tree(db: Session, dept: Department, jinji_id, keiei_id, zensha_id) -> int:
    removed = 0
    children = db.scalars(select(Department).where(Department.parent_id == dept.id)).all()
    for child in children:
        removed += _delete_department_tree(db, child, jinji_id, keiei_id, zensha_id)
    users = db.scalars(select(User).where(User.department_id == dept.id)).all()
    for user in users:
        user.department_id = _fallback_department_id(user, jinji_id, keiei_id, zensha_id)
    db.flush()
    _reassign_department_refs(db, dept.id, jinji_id or zensha_id)
    db.flush()
    db.delete(dept)
    return removed + 1


def cleanup_junk_departments(db: Session, company_id, jinji_id, keiei_id, zensha_id) -> int:
    junk = db.scalars(
        select(Department).where(Department.company_id == company_id, Department.name.in_(JUNK_DEPARTMENT_NAMES))
    ).all()
    removed = 0
    for dept in junk:
        removed += _delete_department_tree(db, dept, jinji_id, keiei_id, zensha_id)
    if removed:
        db.flush()
    return removed


def realistic_survey_catalog() -> list[dict]:
    return [
        {
            "title": TITLE_ES_2025,
            "status": SurveyStatus.closed,
            "published_at": datetime(2025, 11, 4, 0, 0, tzinfo=timezone.utc),
            "closed_at": datetime(2025, 12, 12, 9, 0, tzinfo=timezone.utc),
            "created_at": datetime(2025, 10, 20, 1, 0, tzinfo=timezone.utc),
            "updated_at": datetime(2025, 12, 12, 9, 0, tzinfo=timezone.utc),
            "component_list": [
                paragraph("c_intro", "昨年度の職場改善に向けて実施した従業員満足度調査です。回答は統計的に集計します。"),
                likert("c_q1", "上司は相談に乗ってくれる"),
                likert("c_q2", "成長できる機会がある"),
                likert("c_q3", "労働時間は適正である"),
                likert("c_q4", "知人にこの会社を勧めたい"),
                textarea("c_t1", "改善してほしい点"),
            ],
        },
        {
            "title": TITLE_ONBOARDING,
            "status": SurveyStatus.published,
            "published_at": datetime(2026, 4, 8, 0, 0, tzinfo=timezone.utc),
            "closed_at": None,
            "created_at": datetime(2026, 3, 23, 1, 0, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 4, 8, 0, 0, tzinfo=timezone.utc),
            "component_list": [
                paragraph("c_intro", "入社後の配属・育成の状況を把握し、フォローに活かすためのアンケートです。"),
                likert("c_q1", "配属先の業務内容は入社前の説明とおおむね一致している"),
                likert("c_q2", "上司や先輩から必要なサポートを受けられている"),
                likert("c_q3", "今後の仕事の進め方について見通しが持てている"),
                textarea("c_t1", "配属後に困っていることや相談したいこと"),
            ],
        },
        {
            "title": TITLE_CAREER,
            "status": SurveyStatus.draft,
            "published_at": None,
            "closed_at": None,
            "created_at": datetime(2026, 8, 18, 1, 0, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 8, 25, 2, 30, tzinfo=timezone.utc),
            "component_list": [
                paragraph("c_intro", "来期の配置・育成計画の参考とするための意向調査です。現在は設問を調整中です。"),
                likert("c_q1", "現在の職務で専門性をさらに高めたい"),
                likert("c_q2", "他部門の仕事にも関心がある"),
                likert("c_q3", "社内のキャリア相談を利用しやすい"),
                textarea("c_t1", "今後挑戦したい仕事や必要な支援"),
            ],
        },
        {
            "title": TITLE_TRAINING,
            "status": SurveyStatus.closed,
            "published_at": datetime(2025, 10, 6, 0, 0, tzinfo=timezone.utc),
            "closed_at": datetime(2025, 10, 20, 9, 0, tzinfo=timezone.utc),
            "created_at": datetime(2025, 9, 22, 1, 0, tzinfo=timezone.utc),
            "updated_at": datetime(2025, 10, 20, 9, 0, tzinfo=timezone.utc),
            "component_list": [
                paragraph("c_intro", "新任管理職研修の内容改善に使う受講後アンケートです。"),
                likert("c_q1", "研修内容は今後のマネジメントに活かせる"),
                likert("c_q2", "講義と演習のバランスは適切だった"),
                likert("c_q3", "受講後に部下との関わり方を見直すきっかけになった"),
                textarea("c_t1", "今後追加してほしいテーマ"),
            ],
        },
        {
            "title": TITLE_PULSE,
            "status": SurveyStatus.published,
            "published_at": datetime(2026, 8, 3, 0, 0, tzinfo=timezone.utc),
            "closed_at": None,
            "created_at": datetime(2026, 7, 28, 1, 0, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 8, 3, 0, 0, tzinfo=timezone.utc),
            "component_list": [
                paragraph("c_intro", "直近の職場状況を短時間で把握するためのパルス調査です。"),
                likert("c_q1", "最近2週間の業務量は適正である"),
                likert("c_q2", "チーム内で協力しやすい雰囲気がある"),
                likert("c_q3", "困ったときに周囲へ相談しやすい"),
                textarea("c_t1", "今週気になっていること"),
            ],
        },
    ]


def _apply_survey_timestamps(db: Session, survey_id, spec: dict) -> None:
    db.execute(
        update(Survey)
        .where(Survey.id == survey_id)
        .values(
            published_at=spec["published_at"],
            closed_at=spec["closed_at"],
            created_at=spec["created_at"],
            updated_at=spec["updated_at"],
        )
    )


def upsert_realistic_surveys(db: Session, company_id) -> int:
    upserted = 0
    for spec in realistic_survey_catalog():
        row = db.scalar(select(Survey).where(Survey.company_id == company_id, Survey.title == spec["title"]))
        if row is None:
            row = Survey(
                company_id=company_id,
                title=spec["title"],
                status=spec["status"],
                component_list=spec["component_list"],
                published_at=spec["published_at"],
                closed_at=spec["closed_at"],
            )
            db.add(row)
            db.flush()
        else:
            row.status = spec["status"]
            row.component_list = spec["component_list"]
            row.published_at = spec["published_at"]
            row.closed_at = spec["closed_at"]
            db.flush()
        _apply_survey_timestamps(db, row.id, spec)
        upserted += 1
    return upserted


def add_user(
    db: Session,
    company_id,
    employee_no: str,
    name: str,
    dept_id,
    grade_id,
    generation: UserGeneration,
    roles: list[tuple[UserRoleCode, object | None]],
) -> User:
    existing = db.scalar(select(User).where(User.company_id == company_id, User.employee_no == employee_no))
    if existing:
        existing.display_name = name
        existing.department_id = dept_id
        existing.job_grade_id = grade_id
        existing.generation = generation
        return existing
    user = User(
        company_id=company_id,
        employee_no=employee_no,
        display_name=name,
        password_hash=hash_password("Init#pass1"),
        department_id=dept_id,
        job_grade_id=grade_id,
        generation=generation,
    )
    db.add(user)
    db.flush()
    for role, dep in roles:
        db.add(UserRole(user_id=user.id, role=role, department_id=dep))
    return user


def seed() -> None:
    db = SessionLocal()
    try:
        company = db.scalar(select(Company).where(Company.name == "本社"))
        if company is None:
            company = Company(id=uuid.uuid4(), name="本社")
            db.add(company)
            db.flush()

        def dept(name: str, parent, order: int) -> Department:
            found = db.scalar(
                select(Department).where(Department.company_id == company.id, Department.name == name, Department.parent_id == parent)
            )
            if found:
                found.sort_order = order
                return found
            row = Department(company_id=company.id, parent_id=parent, name=name, sort_order=order)
            db.add(row)
            db.flush()
            return row

        root = dept("全社", None, 0)
        keiei = dept("経営", root.id, 10)
        jinji = dept("人事部", root.id, 20)
        eigyo = dept("営業部", root.id, 30)
        eigyo1 = dept("第一営業課", eigyo.id, 31)
        eigyo2 = dept("第二営業課", eigyo.id, 32)
        kaihatsu = dept("開発部", root.id, 40)
        kaihatsu1 = dept("開発一課", kaihatsu.id, 41)
        kaihatsu2 = dept("開発二課", kaihatsu.id, 42)

        grades = {}
        for i, name in enumerate(["一般", "主任", "課長", "部長"], start=1):
            g = db.scalar(select(JobGrade).where(JobGrade.company_id == company.id, JobGrade.name == name))
            if g is None:
                g = JobGrade(company_id=company.id, name=name, sort_order=i)
                db.add(g)
                db.flush()
            grades[name] = g

        add_user(
            db, company.id, "E-ADMIN", "管理者", jinji.id, grades["部長"].id, UserGeneration.forties,
            [(UserRoleCode.system_admin, None), (UserRoleCode.employee, None)],
        )
        add_user(
            db, company.id, "E-HR", "人事企画", jinji.id, grades["課長"].id, UserGeneration.thirties,
            [(UserRoleCode.hr_planner, None), (UserRoleCode.employee, None)],
        )
        add_user(
            db, company.id, "E-EXEC", "役員", keiei.id, grades["部長"].id, UserGeneration.fifties,
            [(UserRoleCode.executive, None), (UserRoleCode.employee, None)],
        )
        add_user(
            db, company.id, "E-SALES-M", "営業部長", eigyo.id, grades["部長"].id, UserGeneration.forties,
            [(UserRoleCode.dept_manager, eigyo.id), (UserRoleCode.employee, None)],
        )
        add_user(
            db, company.id, "E-DEV-M", "開発部長", kaihatsu.id, grades["部長"].id, UserGeneration.forties,
            [(UserRoleCode.dept_manager, kaihatsu.id), (UserRoleCode.employee, None)],
        )
        add_user(db, company.id, "E-HR-01", "人事担当", jinji.id, grades["一般"].id, UserGeneration.twenties, [(UserRoleCode.employee, None)])

        sales1 = [("E-SALES-01", "高橋"), ("E-SALES-02", "伊藤"), ("E-SALES-03", "渡辺"), ("E-SALES-04", "山本"), ("E-SALES-05", "中村")]
        for no, name in sales1:
            add_user(db, company.id, no, name, eigyo1.id, grades["一般"].id, UserGeneration.twenties, [(UserRoleCode.employee, None)])
        sales2 = [("E-SALES-06", "小林"), ("E-SALES-07", "加藤"), ("E-SALES-08", "吉田")]
        for no, name in sales2:
            add_user(db, company.id, no, name, eigyo2.id, grades["一般"].id, UserGeneration.twenties, [(UserRoleCode.employee, None)])

        dev1 = [("E-DEV-01", "松本"), ("E-DEV-02", "井上"), ("E-DEV-03", "木村"), ("E-DEV-04", "林"), ("E-DEV-05", "斎藤")]
        for no, name in dev1:
            add_user(db, company.id, no, name, kaihatsu1.id, grades["一般"].id, UserGeneration.twenties, [(UserRoleCode.employee, None)])
        dev2 = [("E-DEV-06", "清水"), ("E-DEV-07", "山口"), ("E-DEV-08", "阿部"), ("E-DEV-09", "森"), ("E-DEV-10", "池田")]
        for no, name in dev2:
            add_user(db, company.id, no, name, kaihatsu2.id, grades["一般"].id, UserGeneration.twenties, [(UserRoleCode.employee, None)])

        survey = db.scalar(select(Survey).where(Survey.company_id == company.id, Survey.title == DRAFT_TITLE))
        if survey is None:
            components = [
                {"fe_id": "c_intro", "type": "paragraph", "props": {"title": "本調査は職場改善のために実施します。個人が特定される形では利用しません。"}},
            ]
            for idx, q in enumerate(ES_QUESTIONS, start=1):
                components.append(likert(f"c_q{idx}", q))
            components.append(
                {
                    "fe_id": "c_t1",
                    "type": "textarea",
                    "props": {"title": "改善してほしい点", "required": False, "maxLength": 2000},
                }
            )
            db.add(Survey(company_id=company.id, title=DRAFT_TITLE, component_list=components))

        leftover_surveys = cleanup_leftover_surveys(db, company.id)
        leftover_depts = cleanup_junk_departments(db, company.id, jinji.id, keiei.id, root.id)
        realistic = upsert_realistic_surveys(db, company.id)
        db.commit()
        print(
            f"seed ok leftover_surveys={leftover_surveys} leftover_departments={leftover_depts} realistic_surveys={realistic}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
