import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_runtime: Literal["local", "lambda"] = Field(
        default_factory=lambda: "lambda" if os.getenv("AWS_LAMBDA_FUNCTION_NAME") else "local"
    )
    database_url: str = "postgresql+psycopg://survey:survey@127.0.0.1:5432/survey"
    jwt_secret: str = "change-me-to-at-least-32-characters-long"
    jwt_algorithm: str = "HS256"
    access_token_seconds: int = 900
    refresh_token_days: int = 7
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    llm_enabled: bool | None = None
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""
    min_cell_n: int = 5

    @property
    def allowed_origins(self) -> list[str]:
        return list(dict.fromkeys(origin.strip() for origin in self.cors_origins.split(",") if origin.strip()))

    @property
    def llm_feature_enabled(self) -> bool:
        if self.llm_enabled is not None:
            return self.llm_enabled
        return self.app_runtime != "lambda"


settings = Settings()
