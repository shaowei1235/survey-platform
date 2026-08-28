from __future__ import annotations

ANSWERABLE = {"radio", "checkbox", "input", "textarea"}
KNOWN_TYPES = ANSWERABLE | {"title", "paragraph"}


def _as_list(value) -> list:
    return value if isinstance(value, list) else []


def validate_component_list(component_list: list) -> None:
    from app.errors import ApiError

    if not isinstance(component_list, list):
        raise ApiError("INVALID_COMPONENT")
    seen: set[str] = set()
    for item in component_list:
        if not isinstance(item, dict):
            raise ApiError("INVALID_COMPONENT")
        fe_id = item.get("fe_id")
        typ = item.get("type")
        props = item.get("props") or {}
        if not isinstance(fe_id, str) or not fe_id or fe_id in seen:
            raise ApiError("INVALID_COMPONENT")
        if typ not in KNOWN_TYPES or not isinstance(props, dict):
            raise ApiError("INVALID_COMPONENT")
        seen.add(fe_id)
        if typ in {"radio", "checkbox"}:
            options = _as_list(props.get("options"))
            if len(options) < 2:
                raise ApiError("INVALID_COMPONENT")
            values = []
            for opt in options:
                if not isinstance(opt, dict) or not opt.get("value") or not opt.get("label"):
                    raise ApiError("INVALID_COMPONENT")
                values.append(str(opt["value"]))
                if typ == "radio" and props.get("scoreEnabled"):
                    if "score" not in opt or not isinstance(opt["score"], int):
                        raise ApiError("INVALID_COMPONENT")
            if len(values) != len(set(values)):
                raise ApiError("INVALID_COMPONENT")


def has_answerable(component_list: list) -> bool:
    return any(isinstance(i, dict) and i.get("type") in ANSWERABLE for i in component_list)


def required_answerable(component_list: list) -> list[dict]:
    out = []
    for item in component_list:
        if item.get("type") in ANSWERABLE and (item.get("props") or {}).get("required"):
            out.append(item)
    return out


def component_map(component_list: list) -> dict[str, dict]:
    return {c["fe_id"]: c for c in component_list if isinstance(c, dict) and "fe_id" in c}


def likert_questions(component_list: list) -> list[dict]:
    out = []
    for c in component_list:
        props = c.get("props") or {}
        if c.get("type") == "radio" and props.get("scoreEnabled"):
            out.append(c)
    return out


def option_score(question: dict, value: str) -> int | None:
    for opt in (question.get("props") or {}).get("options") or []:
        if str(opt.get("value")) == str(value):
            score = opt.get("score")
            return int(score) if score is not None else None
    return None
