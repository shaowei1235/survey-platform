from sqlalchemy.pool import NullPool

from app.config import Settings
from app.db import engine_options_for_runtime


def test_cors_origins_are_trimmed_deduplicated_and_empty_items_are_ignored() -> None:
    configured = Settings(
        cors_origins=" https://admin.example.com, ,https://client.example.com,https://admin.example.com "
    )

    assert configured.allowed_origins == ["https://admin.example.com", "https://client.example.com"]


def test_lambda_uses_null_pool_and_keeps_pre_ping() -> None:
    options = engine_options_for_runtime("lambda")

    assert options == {"pool_pre_ping": True, "poolclass": NullPool}


def test_local_keeps_sqlalchemy_default_pool_and_pre_ping() -> None:
    options = engine_options_for_runtime("local")

    assert options == {"pool_pre_ping": True}


def test_llm_defaults_off_in_lambda_and_can_remain_on_locally() -> None:
    assert Settings(app_runtime="lambda", llm_enabled=None).llm_feature_enabled is False
    assert Settings(app_runtime="local", llm_enabled=None).llm_feature_enabled is True
    assert Settings(app_runtime="local", llm_enabled=False).llm_feature_enabled is False
