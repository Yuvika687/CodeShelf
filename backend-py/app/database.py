from __future__ import annotations

from typing import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings


settings = get_settings()


def _clean_asyncpg_url(url: str) -> tuple[str, bool]:
    parsed = urlsplit(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    wants_ssl = parsed.hostname and "neon.tech" in parsed.hostname
    wants_ssl = bool(wants_ssl or query.get("sslmode") == "require" or query.get("ssl") == "require")

    for key in ("sslmode", "ssl", "channel_binding"):
        query.pop(key, None)

    clean_query = urlencode(query)
    clean_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, clean_query, parsed.fragment))
    return clean_url, wants_ssl


def _engine_kwargs(url: str) -> dict:
    if url.startswith("postgresql"):
        clean_url, wants_ssl = _clean_asyncpg_url(url)
        return {
            "url": clean_url,
            "pool_size": 5,
            "max_overflow": 10,
            "pool_pre_ping": True,
            "pool_recycle": 300,
            "connect_args": {"ssl": "require"} if wants_ssl else {},
        }
    return {"url": url, "connect_args": {"check_same_thread": False} if url.startswith("sqlite") else {}}


engine = create_async_engine(**_engine_kwargs(settings.database_url), echo=False)
async_session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
