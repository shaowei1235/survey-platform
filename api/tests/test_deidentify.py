from app.services.deidentify import sanitize_quote


def test_qa21_drops_email_and_employee_no() -> None:
    nos = ["E-SALES-01", "E-HR"]
    assert sanitize_quote("連絡は foo@example.com まで", nos) is None
    cleaned = sanitize_quote("残業が多く、E-SALES-01としては改善してほしいです。", nos)
    assert cleaned is not None
    assert "E-SALES-01" not in cleaned
    assert "@" not in cleaned
