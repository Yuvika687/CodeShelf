from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]
GEMINI_MODEL = "gemini-2.5-flash-lite"


def normalize_origin(value: str) -> list[str]:
    origin = value.strip().rstrip("/")
    if not origin:
        return []
    if origin.startswith(("http://", "https://")):
        return [origin]
    return [f"https://{origin}", f"http://{origin}"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = "sqlite+aiosqlite:///./codeshelf_dev.db"
    database_url_sync: str = ""

    jwt_secret: str = "codeshelf-dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_days: int = 14

    backend_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    frontend_url: str = "http://127.0.0.1:5173"
    backend_url: str = "http://127.0.0.1:8000"
    environment: str = "development"
    port: int = 8000
    cron_secret: str = ""

    resend_api_key: str = ""
    resend_from_email: str = "CodeShelf <onboarding@resend.dev>"
    gemini_api_key: str = ""
    hf_api_key: str = ""
    hf_space_id: str = ""
    hf_space_api_name: str = "/predict"
    firebase_project_id: str = ""
    firebase_service_account_json: str = ""

    @property
    def cors_origins(self) -> list[str]:
        origins: list[str] = []
        for origin in self.backend_cors_origins.split(","):
            origins.extend(normalize_origin(origin))
        origins.extend(normalize_origin(self.frontend_url))
        return list(dict.fromkeys(origins))

    @property
    def cors_origin_regex(self) -> str:
        if self.environment.lower() == "production":
            return r"https://([a-z0-9-]+\.)*yogender1\.me|https://[a-z0-9-]+\.onrender\.com"
        return r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

    @property
    def sync_database_url(self) -> str:
        if self.database_url_sync:
            return self.database_url_sync
        return self.database_url.replace("+asyncpg", "").replace("+aiosqlite", "")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
