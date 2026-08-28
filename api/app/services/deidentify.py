from __future__ import annotations

import re
from collections.abc import Iterable

EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE = re.compile(r"\b0\d{1,4}-\d{1,4}-\d{4}\b")
EMPLOYEE_NO_LIKE = re.compile(r"\bE\d{3,8}\b")


def sanitize_quote(text: str, employee_nos: Iterable[str]) -> str | None:
    if not isinstance(text, str):
        return None
    if "@" in text and EMAIL.search(text):
        return None
    cleaned = EMAIL.sub("", text)
    cleaned = PHONE.sub("", cleaned)
    cleaned = EMPLOYEE_NO_LIKE.sub("", cleaned)
    for no in employee_nos:
        if no:
            cleaned = cleaned.replace(no, "")
    cleaned = " ".join(cleaned.split())
    if len(cleaned) < 8:
        return None
    return cleaned[:200]
