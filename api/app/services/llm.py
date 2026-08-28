from __future__ import annotations

import json

import httpx

from app.config import settings
from app.errors import ApiError

INTENT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["conclusion"],
    "properties": {"conclusion": {"type": "string", "minLength": 1, "maxLength": 2000}},
}

SUMMARY_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["topics", "negative_tendency"],
    "properties": {
        "topics": {
            "type": "array",
            "maxItems": 10,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["label", "count_hint"],
                "properties": {
                    "label": {"type": "string"},
                    "count_hint": {"type": "string", "enum": ["high", "mid", "low"]},
                },
            },
        },
        "negative_tendency": {"type": "string", "maxLength": 1000},
    },
}

INTENT_SYSTEM = (
    "あなたは社内ES調査の分析補助です。与えられたevidence JSONの数字だけを根拠に、"
    "日本語で短い結論を書いてください。数字を捏造してはいけません。evidenceに無い部署や数値に言及しないでください。"
    "出力はJSONで conclusion のみです。"
)

SUMMARY_SYSTEM = (
    "あなたは社内ES調査の自由記述を要約します。与えられたquotesだけを使い、"
    "高频课题を topics に、否定的傾向を negative_tendency に日本語で書いてください。"
    "人数の具体値は出さないでください。count_hint は high/mid/low のみです。"
)


def complete_json(system: str, user_payload: dict, schema: dict, schema_name: str) -> dict:
    if not settings.llm_base_url or not settings.llm_api_key or not settings.llm_model:
        raise ApiError("AI_UPSTREAM_FAILED")
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": schema_name, "strict": True, "schema": schema},
        },
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            res = client.post(url, headers={"Authorization": f"Bearer {settings.llm_api_key}"}, json=body)
    except httpx.TimeoutException as exc:
        raise ApiError("AI_TIMEOUT") from exc
    except httpx.HTTPError as exc:
        raise ApiError("AI_UPSTREAM_FAILED") from exc
    if res.status_code >= 400:
        # some providers reject json_schema; retry json_object
        body["response_format"] = {"type": "json_object"}
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(url, headers={"Authorization": f"Bearer {settings.llm_api_key}"}, json=body)
        except httpx.TimeoutException as exc:
            raise ApiError("AI_TIMEOUT") from exc
        except httpx.HTTPError as exc:
            raise ApiError("AI_UPSTREAM_FAILED") from exc
        if res.status_code >= 400:
            raise ApiError("AI_UPSTREAM_FAILED")
    try:
        content = res.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError, TypeError) as exc:
        raise ApiError("AI_UPSTREAM_FAILED") from exc
