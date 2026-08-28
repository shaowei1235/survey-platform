from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user
from app.errors import ApiError
from app.models import Department, User
from app.schemas import DepartmentIn, DepartmentOut, DepartmentPatch
from app.services.authz import ADMIN_ROLES, ORG_WRITE_ROLES, descendant_ids, require_any_role

router = APIRouter(prefix="/departments", tags=["departments"])


def _would_cycle(db: Session, company_id: UUID, dept_id: UUID, new_parent_id: UUID | None) -> bool:
    if new_parent_id is None:
        return False
    if new_parent_id == dept_id:
        return True
    return dept_id in descendant_ids(db, company_id, [new_parent_id])


@router.get("", response_model=dict)
def list_departments(user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    require_any_role(user, ADMIN_ROLES | ORG_WRITE_ROLES)
    items = db.scalars(
        select(Department).where(Department.company_id == user.company_id).order_by(Department.sort_order, Department.name)
    ).all()
    return {
        "items": [
            DepartmentOut(id=d.id, parent_id=d.parent_id, name=d.name, sort_order=d.sort_order, is_active=d.is_active).model_dump()
            for d in items
        ]
    }


@router.post("", response_model=DepartmentOut, status_code=201)
def create_department(
    body: DepartmentIn, user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> DepartmentOut:
    require_any_role(user, ORG_WRITE_ROLES)
    dept = Department(
        company_id=user.company_id,
        parent_id=body.parent_id,
        name=body.name,
        sort_order=body.sort_order,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return DepartmentOut(id=dept.id, parent_id=dept.parent_id, name=dept.name, sort_order=dept.sort_order, is_active=dept.is_active)


@router.patch("/{dept_id}", response_model=DepartmentOut)
def patch_department(
    dept_id: UUID,
    body: DepartmentPatch,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> DepartmentOut:
    require_any_role(user, ORG_WRITE_ROLES)
    dept = db.scalar(select(Department).where(Department.id == dept_id, Department.company_id == user.company_id))
    if dept is None:
        raise ApiError("NOT_FOUND")
    data = body.model_dump(exclude_unset=True)
    if "parent_id" in data and _would_cycle(db, user.company_id, dept.id, data["parent_id"]):
        raise ApiError("VALIDATION_ERROR")
    for key, value in data.items():
        setattr(dept, key, value)
    db.commit()
    db.refresh(dept)
    return DepartmentOut(id=dept.id, parent_id=dept.parent_id, name=dept.name, sort_order=dept.sort_order, is_active=dept.is_active)
