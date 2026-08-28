from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Department, User, UserRoleCode

ANALYST_ROLES = {UserRoleCode.hr_planner, UserRoleCode.executive, UserRoleCode.dept_manager}
ADMIN_ROLES = {
    UserRoleCode.system_admin,
    UserRoleCode.hr_planner,
    UserRoleCode.executive,
    UserRoleCode.dept_manager,
}
ORG_WRITE_ROLES = {UserRoleCode.hr_planner, UserRoleCode.system_admin}
SURVEY_WRITE_ROLES = {UserRoleCode.hr_planner}
FULL_COMPANY_SCOPE = {UserRoleCode.hr_planner, UserRoleCode.executive, UserRoleCode.system_admin}


def role_set(user: User) -> set[UserRoleCode]:
    return {r.role for r in user.roles}


def require_any_role(user: User, allowed: set[UserRoleCode]) -> None:
    if role_set(user).isdisjoint(allowed):
        raise ApiError("FORBIDDEN_ROLE")


def descendant_ids(db: Session, company_id: UUID, root_ids: list[UUID]) -> list[UUID]:
    if not root_ids:
        return []
    depts = db.scalars(select(Department).where(Department.company_id == company_id)).all()
    children: dict[UUID | None, list[UUID]] = {}
    for dept in depts:
        children.setdefault(dept.parent_id, []).append(dept.id)
    found: set[UUID] = set()
    stack = list(root_ids)
    while stack:
        current = stack.pop()
        if current in found:
            continue
        found.add(current)
        stack.extend(children.get(current, []))
    return list(found)


def all_department_ids(db: Session, company_id: UUID) -> list[UUID]:
    rows = db.scalars(select(Department.id).where(Department.company_id == company_id)).all()
    return list(rows)


def scope_department_ids(db: Session, user: User) -> list[UUID]:
    roles = user.roles
    codes = {r.role for r in roles}
    if codes & FULL_COMPANY_SCOPE:
        return all_department_ids(db, user.company_id)
    roots = [r.department_id for r in roles if r.role == UserRoleCode.dept_manager and r.department_id]
    return descendant_ids(db, user.company_id, roots)


def assert_department_in_scope(db: Session, user: User, department_id: UUID) -> None:
    if department_id not in set(scope_department_ids(db, user)):
        raise ApiError("FORBIDDEN_SCOPE")


def is_dept_manager_only(user: User) -> bool:
    codes = role_set(user)
    return UserRoleCode.dept_manager in codes and not (codes & {UserRoleCode.hr_planner, UserRoleCode.executive, UserRoleCode.system_admin})
