from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_qa08_fill_page_has_no_attribute_inputs() -> None:
    text = (ROOT / "client/app/surveys/[id]/page.tsx").read_text()
    assert "department_id" not in text
    assert "job_grade" not in text
    assert "generation" not in text
    assert "AnswerField" in text


def test_qa23_en_locale_files_exist_without_switcher() -> None:
    assert (ROOT / "admin/src/locales/en/translation.json").is_file()
    assert (ROOT / "client/messages/en.json").is_file()
    admin_app = (ROOT / "admin/src/App.tsx").read_text()
    client_login = (ROOT / "client/app/login/page.tsx").read_text()
    assert "changeLanguage" not in admin_app
    assert "changeLanguage" not in client_login
