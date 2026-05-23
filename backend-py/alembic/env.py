from __future__ import annotations

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings  # noqa: E402
from app.models import Base  # noqa: E402


config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
target_metadata = Base.metadata
sync_url = settings.sync_database_url
async_url = settings.database_url
config.set_main_option("sqlalchemy.url", sync_url)


def clean_asyncpg_url(url: str) -> tuple[str, bool]:
    parsed = urlsplit(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    wants_ssl = parsed.hostname and "neon.tech" in parsed.hostname
    wants_ssl = bool(wants_ssl or query.get("sslmode") == "require" or query.get("ssl") == "require")

    for key in ("sslmode", "ssl", "channel_binding"):
        query.pop(key, None)

    clean_query = urlencode(query)
    clean_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, clean_query, parsed.fragment))
    return clean_url, wants_ssl


def run_migrations_offline() -> None:
    context.configure(url=sync_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    clean_url, wants_ssl = clean_asyncpg_url(async_url)
    config.set_main_option("sqlalchemy.url", clean_url)
    connect_args = {}
    if clean_url.startswith("postgresql") and wants_ssl:
        connect_args["ssl"] = "require"
    if clean_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
