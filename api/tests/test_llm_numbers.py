from app.errors import ApiError
from app.services.llm import assert_model_numbers, assert_summary_has_no_counts


def test_qa20_unit_invented_score() -> None:
    evidence = {"department_avg_by_fe_id": {"c_q1": 3.2}, "low_questions": [{"avg_score": 3.2, "n": 5}]}
    assert_model_numbers({"conclusion": "労働時間への不満が相対的に目立ちます。"}, evidence)
    try:
        assert_model_numbers({"conclusion": "平均は1.11です。"}, evidence)
        raise AssertionError("expected mismatch")
    except ApiError as exc:
        assert exc.error_code == "AI_NUMBER_MISMATCH"


def test_markdown_invented_score_mismatch() -> None:
    evidence = {"department_avg_by_fe_id": {"c_q1": 3.2}, "low_questions": [{"avg_score": 3.2, "n": 5}]}
    try:
        assert_model_numbers({"conclusion": "**平均**は1.11です。"}, evidence)
        raise AssertionError("expected mismatch")
    except ApiError as exc:
        assert exc.error_code == "AI_NUMBER_MISMATCH"


def test_qa20_unit_avg_score_key() -> None:
    evidence = {"low_questions": [{"avg_score": 3.2}]}
    try:
        assert_model_numbers({"conclusion": "ok", "avg_score": 9}, evidence)
        raise AssertionError("expected mismatch")
    except ApiError as exc:
        assert exc.error_code == "AI_NUMBER_MISMATCH"


def test_summary_rejects_headcount() -> None:
    assert_summary_has_no_counts({"topics": [{"label": "残業", "count_hint": "high"}], "negative_tendency": "負荷が高い。"})
    try:
        assert_summary_has_no_counts({"topics": [], "negative_tendency": "12人が言及"})
        raise AssertionError("expected mismatch")
    except ApiError as exc:
        assert exc.error_code == "AI_NUMBER_MISMATCH"
