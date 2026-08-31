from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select

from app.db import get_db
from app.errors import ApiError
from app.models import RefreshToken, User
from app.security import decode_access_token, hash_refresh_token

bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise ApiError("UNAUTHENTICATED")
    try:
        payload = decode_access_token(creds.credentials)
        user_id = UUID(payload["sub"])
    except (InvalidTokenError, KeyError, ValueError):
        raise ApiError("UNAUTHENTICATED") from None
    user = db.scalar(select(User).options(selectinload(User.roles)).where(User.id == user_id, User.is_active.is_(True)))
    if user is None:
        raise ApiError("UNAUTHENTICATED")
    return user


def valid_refresh_token(db: Session, raw: str) -> RefreshToken:
    token = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_refresh_token(raw),
            RefreshToken.revoked_at.is_(None),
        )
    )
    if token is None or token.expires_at < datetime.now(timezone.utc):
        raise ApiError("UNAUTHENTICATED")
    return token
