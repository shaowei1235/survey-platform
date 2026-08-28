from __future__ import annotations

import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Company, Department, JobGrade, Survey, User, UserGeneration, UserRole, UserRoleCode
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


def likert(fe_id: str, title: str) -> dict:
    return {
        "fe_id": fe_id,
        "type": "radio",
        "props": {"title": title, "required": True, "scoreEnabled": True, "options": LIKERT_OPTIONS},
    }


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
                return found
            row = Department(company_id=company.id, parent_id=parent, name=name, sort_order=order)
            db.add(row)
            db.flush()
            return row

        root = dept("全社", None, 0)
        keiei = dept("経営", root.id, 1)
        jinji = dept("人事部", root.id, 2)
        eigyo = dept("営業部", root.id, 3)
        kaihatsu = dept("開発部", root.id, 4)

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
        for i in range(1, 6):
            add_user(
                db, company.id, f"E-SALES-0{i}", f"営業{i}", eigyo.id, grades["一般"].id, UserGeneration.twenties,
                [(UserRoleCode.employee, None)],
            )
            add_user(
                db, company.id, f"E-DEV-0{i}", f"開発{i}", kaihatsu.id, grades["一般"].id, UserGeneration.twenties,
                [(UserRoleCode.employee, None)],
            )

        title = "2026年度 従業員満足度調査"
        survey = db.scalar(select(Survey).where(Survey.company_id == company.id, Survey.title == title))
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
            db.add(Survey(company_id=company.id, title=title, component_list=components))
        db.commit()
        print("seed ok")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
