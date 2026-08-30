from __future__ import annotations

import json
import re
from collections.abc import Iterator

import httpx

from app.config import settings
from app.errors import ApiError

NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")
TOLERANCE = 0.05

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
    "日本語で短い定性的な結論を書いてください。conclusion に数値・平均点・人数を書かないでください。"
    "数字の提示は evidence 側で行います。evidence に無い部署や項目に言及しないでください。"
    "出力はJSONで conclusion のみです。"
)

SUMMARY_SYSTEM = (
    "あなたは社内ES調査の自由記述を要約します。与えられたquotesだけを使い、"
    "高頻度の課題を topics に、否定的傾向を negative_tendency に日本語で書いてください。"
    "人数や点数の具体値は出さないでください。count_hint は high/mid/low のみです。"
)

INTENT_STREAM_SYSTEM = (
    "あなたは社内ES調査の分析補助です。与えられたevidence JSONの数字だけを根拠に、"
    "日本語の短いMarkdownで定性的な結論を書いてください。見出し・箇条書き・太字は使ってよいです。"
    "番号付きリスト（1. 2.）は使わず、ハイフンの箇条書きにしてください。"
    "数値・平均点・人数は本文に書かないでください。数字の提示は evidence 側で行います。"
    "evidence に無い部署や項目に言及しないでください。"
    "JSONは出力しないでください。Markdown本文のみです。"
)

SUMMARY_STREAM_SYSTEM = (
    "あなたは社内ES調査の自由記述を要約します。与えられたquotesだけを使い、"
    "日本語のMarkdownで書いてください。見出し・箇条書き・太字は使ってよいです。"
    "番号付きリスト（1. 2.）は使わず、ハイフンの箇条書きにしてください。"
    "高頻度の課題は箇条書きにし、各項目の相対的な言及の多さを「多い」「中程度」「少ない」で示してください。"
    "否定的傾向も本文に書いてください。"
    "人数や点数の具体値（アラビア数字）は出さないでください。"
    "JSONは出力しないでください。Markdown本文のみです。"
)


def _collect_numbers(value: object, into: list[float]) -> None:
    if isinstance(value, bool) or value is None:
        return
    if isinstance(value, (int, float)):
        into.append(float(value))
        return
    if isinstance(value, dict):
        for item in value.values():
            _collect_numbers(item, into)
        return
    if isinstance(value, list):
        for item in value:
            _collect_numbers(item, into)


def assert_model_numbers(parsed: dict, evidence: dict) -> None:
    blob = json.dumps(parsed, ensure_ascii=False)
    if "avg_score" in blob:
        raise ApiError("AI_NUMBER_MISMATCH")
    allowed: list[float] = []
    _collect_numbers(evidence, allowed)
    for raw in NUMBER_RE.findall(blob):
        val = float(raw)
        if not any(abs(val - item) <= TOLERANCE for item in allowed):
            raise ApiError("AI_NUMBER_MISMATCH")


def assert_summary_has_no_counts(parsed: dict) -> None:
    blob = json.dumps(parsed, ensure_ascii=False)
    if NUMBER_RE.search(blob):
        raise ApiError("AI_NUMBER_MISMATCH")


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


def stream_markdown(system: str, user_payload: dict) -> Iterator[str]:
    if not settings.llm_base_url or not settings.llm_api_key or not settings.llm_model:
        raise ApiError("AI_UPSTREAM_FAILED")
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
        "stream": True,
    }
    timeout = httpx.Timeout(60.0, connect=10.0)
    try:
        with httpx.Client(timeout=timeout) as client:
            with client.stream(
                "POST", url, headers={"Authorization": f"Bearer {settings.llm_api_key}"}, json=body
            ) as res:
                if res.status_code >= 400:
                    raise ApiError("AI_UPSTREAM_FAILED")
                for line in res.iter_lines():
                    if not line:
                        continue
                    if line.startswith("data:"):
                        payload = line[5:].strip()
                        if payload == "[DONE]":
                            break
                        try:
                            chunk = json.loads(payload)
                        except json.JSONDecodeError:
                            continue
                        try:
                            delta = chunk["choices"][0].get("delta", {}).get("content") or ""
                        except (KeyError, IndexError, TypeError):
                            continue
                        if delta:
                            yield delta
    except httpx.TimeoutException as exc:
        raise ApiError("AI_TIMEOUT") from exc
    except httpx.HTTPError as exc:
        raise ApiError("AI_UPSTREAM_FAILED") from exc
