from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]
GEMINI_MODEL = "gemini-2.5-flash-lite"
DEFAULT_JWT_SECRET = "codeshelf-dev-secret-change-in-production"


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

    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expiry_days: int = 14

    backend_cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:3000,"
        "https://code.yogender1.me,"
        "https://yogender1.me,"
        "https://code-shelf-eight.vercel.app,"
        "https://code-shelf-8nlk.vercel.app"
    )
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
    github_token: str = ""
    github_repo: str = ""
    github_branch: str = "main"
    github_client_id: str = ""
    github_client_secret: str = ""

    @property
    def cors_origins(self) -> list[str]:
        origins: list[str] = []
        for origin in self.backend_cors_origins.split(","):
            origins.extend(normalize_origin(origin))
        origins.extend(normalize_origin(self.frontend_url))
        return list(dict.fromkeys(origins))

    @property
    def cors_origin_regex(self) -> str:
        # Scoped to this project's own Vercel deployments (prod + per-deploy
        # preview URLs), not every app hosted on vercel.app/onrender.com.
        return (
            r"https://([a-z0-9-]+\.)*yogender1\.me"
            r"|https://code-shelf(-[a-z0-9]+)?(-yuvika-malhotras-projects)?\.vercel\.app"
            r"|https?://(localhost|127\.0\.0\.1)(:\d+)?"
        )

    @property
    def sync_database_url(self) -> str:
        if self.database_url_sync:
            return self.database_url_sync
        return self.database_url.replace("+asyncpg", "").replace("+aiosqlite", "")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    if settings.environment == "production" and settings.jwt_secret == DEFAULT_JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET is unset (using the public default) while ENVIRONMENT=production. "
            "Set a real JWT_SECRET before starting the server — anyone can forge login tokens otherwise."
        )
    return settings
