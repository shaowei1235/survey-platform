from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings


class Base(DeclarativeBase):
    pass


def engine_options_for_runtime(app_runtime: str) -> dict[str, object]:
    options: dict[str, object] = {"pool_pre_ping": True}
    if app_runtime == "lambda":
        options["poolclass"] = NullPool
    return options


engine = create_engine(settings.database_url, **engine_options_for_runtime(settings.app_runtime))
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
