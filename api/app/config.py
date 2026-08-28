from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://survey:survey@127.0.0.1:5432/survey"
    jwt_secret: str = "change-me-to-at-least-32-characters-long"
    jwt_algorithm: str = "HS256"
    access_token_seconds: int = 900
    refresh_token_days: int = 7
    admin_origin: str = "http://localhost:5173"
    client_origin: str = "http://localhost:3000"
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""
    min_cell_n: int = 5


settings = Settings()
