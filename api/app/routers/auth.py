from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.db import get_db
from app.deps import current_user, valid_refresh_token
from app.errors import ApiError
from app.models import RefreshToken, User
from app.rate_limit import check_login_rate
from app.schemas import LoginIn, MeOut, RefreshIn, RoleOut, TokenOut
from app.security import create_access_token, hash_refresh_token, new_refresh_token, verify_password
from app.services.authz import scope_department_ids

router = APIRouter(tags=["auth"])


def _issue_tokens(db: Session, user: User) -> TokenOut:
    access = create_access_token(user.id, user.company_id)
    raw, hashed = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hashed,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        )
    )
    db.commit()
    return TokenOut(access_token=access, refresh_token=raw, expires_in=settings.access_token_seconds)


@router.post("/auth/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Annotated[Session, Depends(get_db)]) -> TokenOut:
    check_login_rate(request.client.host if request.client else "unknown")
    user = db.scalar(
        select(User)
        .options(selectinload(User.roles))
        .where(User.employee_no == body.employee_no, User.is_active.is_(True))
    )
    if user is None or not verify_password(user.password_hash, body.password):
        raise ApiError("INVALID_CREDENTIALS")
    return _issue_tokens(db, user)


@router.post("/auth/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Annotated[Session, Depends(get_db)]) -> TokenOut:
    token = valid_refresh_token(db, body.refresh_token)
    token.revoked_at = datetime.now(UTC)
    user = db.scalar(select(User).options(selectinload(User.roles)).where(User.id == token.user_id, User.is_active.is_(True)))
    if user is None:
        raise ApiError("UNAUTHENTICATED")
    db.commit()
    return _issue_tokens(db, user)


@router.get("/me", response_model=MeOut)
def me(user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]) -> MeOut:
    return MeOut(
        id=user.id,
        employee_no=user.employee_no,
        display_name=user.display_name,
        company_id=user.company_id,
        department_id=user.department_id,
        job_grade_id=user.job_grade_id,
        generation=user.generation.value,
        roles=[RoleOut(role=r.role.value, department_id=r.department_id) for r in user.roles],
        scope_department_ids=scope_department_ids(db, user),
    )
