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


CN_UI_MARKERS = (
    "问卷",
    "提交",
    "登录",
    "部门",
    "用户",
    "密码",
    "请输入",
    "职级",
    "满意度",
    "自由记述",
    "加载中",
    "点击",
)
SKIP_DIRS = {"node_modules", ".next", "dist", "coverage"}
UI_SUFFIXES = {".tsx", ".ts", ".json"}


def test_qa22_ui_has_no_simplified_chinese() -> None:
    hits: list[str] = []
    for root in (ROOT / "admin/src", ROOT / "client"):
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix not in UI_SUFFIXES:
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            text = path.read_text(encoding="utf-8")
            for marker in CN_UI_MARKERS:
                if marker in text:
                    hits.append(f"{path.relative_to(ROOT)}: {marker}")
    assert hits == []
