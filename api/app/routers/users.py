from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.deps import current_user
from app.errors import ApiError
from app.models import Department, JobGrade, User, UserGeneration, UserRole, UserRoleCode
from app.schemas import RoleIn, RoleOut, UserCreate, UserOut, UserPatch
from app.security import hash_password
from app.services.authz import ORG_WRITE_ROLES, require_any_role

router = APIRouter(tags=["users"])


def _apply_roles(db: Session, user: User, roles: list[RoleIn]) -> None:
    db.execute(delete(UserRole).where(UserRole.user_id == user.id))
    for item in roles:
        try:
            code = UserRoleCode(item.role)
        except ValueError:
            raise ApiError("VALIDATION_ERROR") from None
        dept_id = item.department_id
        if code == UserRoleCode.dept_manager:
            dept_id = dept_id or user.department_id
            if dept_id is None:
                raise ApiError("VALIDATION_ERROR")
        else:
            dept_id = None
        db.add(UserRole(user_id=user.id, role=code, department_id=dept_id))


def _to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        employee_no=user.employee_no,
        display_name=user.display_name,
        department_id=user.department_id,
        job_grade_id=user.job_grade_id,
        generation=user.generation.value,
        is_active=user.is_active,
        roles=[RoleOut(role=r.role.value, department_id=r.department_id) for r in user.roles],
    )


@router.get("/job-grades")
def list_job_grades(user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    require_any_role(user, ORG_WRITE_ROLES)
    items = db.scalars(
        select(JobGrade).where(JobGrade.company_id == user.company_id).order_by(JobGrade.sort_order)
    ).all()
    return {"items": [{"id": g.id, "name": g.name, "sort_order": g.sort_order} for g in items]}


@router.get("/users")
def list_users(
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    require_any_role(user, ORG_WRITE_ROLES)
    q = select(User).options(selectinload(User.roles)).where(User.company_id == user.company_id)
    total = db.scalar(select(func.count()).select_from(User).where(User.company_id == user.company_id)) or 0
    items = db.scalars(q.order_by(User.employee_no).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [_to_out(u).model_dump() for u in items], "total": total, "page": page, "page_size": page_size}


@router.post("/users", status_code=201)
def create_user(body: UserCreate, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    require_any_role(user, ORG_WRITE_ROLES)
    exists = db.scalar(select(User).where(User.company_id == user.company_id, User.employee_no == body.employee_no))
    if exists:
        raise ApiError("VALIDATION_ERROR")
    dept = db.scalar(
        select(Department).where(
            Department.id == body.department_id, Department.company_id == user.company_id, Department.is_active.is_(True)
        )
    )
    grade = db.scalar(select(JobGrade).where(JobGrade.id == body.job_grade_id, JobGrade.company_id == user.company_id))
    if dept is None or grade is None:
        raise ApiError("VALIDATION_ERROR")
    created = User(
        company_id=user.company_id,
        employee_no=body.employee_no,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
        department_id=body.department_id,
        job_grade_id=body.job_grade_id,
        generation=UserGeneration(body.generation),
    )
    db.add(created)
    db.flush()
    _apply_roles(db, created, body.roles)
    db.commit()
    created = db.scalar(select(User).options(selectinload(User.roles)).where(User.id == created.id))
    return _to_out(created).model_dump()


@router.patch("/users/{user_id}")
def patch_user(
    user_id: UUID, body: UserPatch, actor: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> dict:
    require_any_role(actor, ORG_WRITE_ROLES)
    target = db.scalar(
        select(User).options(selectinload(User.roles)).where(User.id == user_id, User.company_id == actor.company_id)
    )
    if target is None:
        raise ApiError("NOT_FOUND")
    data = body.model_dump(exclude_unset=True)
    roles = data.pop("roles", None)
    password = data.pop("password", None)
    if password:
        target.password_hash = hash_password(password)
    if "generation" in data and data["generation"] is not None:
        target.generation = UserGeneration(data.pop("generation"))
    for key, value in data.items():
        setattr(target, key, value)
    if roles is not None:
        _apply_roles(db, target, [RoleIn(**r) if isinstance(r, dict) else r for r in roles])
    db.commit()
    target = db.scalar(select(User).options(selectinload(User.roles)).where(User.id == target.id))
    return _to_out(target).model_dump()
