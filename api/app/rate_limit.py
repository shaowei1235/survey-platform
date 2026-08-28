from collections import defaultdict
from time import time

from app.errors import ApiError

_login_hits: dict[str, list[float]] = defaultdict(list)
_ai_hits: dict[str, list[float]] = defaultdict(list)


def _prune(bucket: list[float], window: float) -> list[float]:
    now = time()
    return [t for t in bucket if now - t < window]


def check_login_rate(ip: str) -> None:
    kept = _prune(_login_hits[ip], 60)
    if len(kept) >= 10:
        raise ApiError("VALIDATION_ERROR")
    kept.append(time())
    _login_hits[ip] = kept


def check_ai_rate(user_id: str) -> None:
    kept = _prune(_ai_hits[user_id], 3600)
    if len(kept) >= 20:
        raise ApiError("VALIDATION_ERROR")
    kept.append(time())
    _ai_hits[user_id] = kept
