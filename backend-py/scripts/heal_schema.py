"""
One-time repair for production databases where `alembic_version` was stamped
ahead of the actual schema (so `alembic upgrade head` sees pending migrations
as already applied and skips them, even though the underlying tables/columns
were never created).

Brings the live schema up to date with the current models by:
  1. Creating any tables that don't exist yet (idempotent).
  2. Adding any columns that migrations 002/003/006/007 added to tables
     that already existed before alembic was introduced (idempotent, guarded
     by information_schema checks).
  3. Creating any indexes those migrations added (idempotent).

Safe to run multiple times — every step is a no-op once the schema matches.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.database import engine
from app.models.base import Base

# (table, column, DDL type + default clause)
COLUMNS_TO_ENSURE = [
    ("users", "email_verified", "BOOLEAN NOT NULL DEFAULT TRUE"),
    ("users", "auth_provider", "VARCHAR(30) NOT NULL DEFAULT 'password'"),
    ("users", "firebase_uid", "VARCHAR(128) NOT NULL DEFAULT ''"),
    ("email_preferences", "include_summary", "BOOLEAN NOT NULL DEFAULT TRUE"),
    ("email_preferences", "include_streak_alert", "BOOLEAN NOT NULL DEFAULT TRUE"),
    ("email_preferences", "reminder_style", "VARCHAR(30) NOT NULL DEFAULT 'focused'"),
    ("email_preferences", "subject_style", "VARCHAR(30) NOT NULL DEFAULT 'personal'"),
    ("email_preferences", "selected_topics_json", "TEXT NOT NULL DEFAULT '[]'"),
    ("email_preferences", "selected_note_ids_json", "TEXT NOT NULL DEFAULT '[]'"),
    ("email_preferences", "emails_per_day", "INTEGER NOT NULL DEFAULT 1"),
    ("email_logs", "email_type", "VARCHAR(40) NOT NULL DEFAULT 'daily_revision'"),
    ("email_logs", "recipient", "VARCHAR(255) NOT NULL DEFAULT ''"),
    ("email_logs", "card_ids", "TEXT NOT NULL DEFAULT ''"),
    ("email_logs", "provider_message_id", "VARCHAR(120) NOT NULL DEFAULT ''"),
]

INDEXES_TO_ENSURE = [
    ("ix_users_firebase_uid", "users", "firebase_uid"),
    ("ix_email_logs_email_type", "email_logs", "email_type"),
]


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("create_all: done (created any missing tables)")

        for table, column, ddl in COLUMNS_TO_ENSURE:
            table_exists = await conn.scalar(
                text("SELECT to_regclass(:t)"), {"t": table}
            )
            if not table_exists:
                continue
            exists = await conn.scalar(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = :t AND column_name = :c"
                ),
                {"t": table, "c": column},
            )
            if exists:
                continue
            await conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {ddl}'))
            print(f"added column: {table}.{column}")

        for index_name, table, column in INDEXES_TO_ENSURE:
            await conn.execute(
                text(f'CREATE INDEX IF NOT EXISTS "{index_name}" ON "{table}" ("{column}")')
            )

    await engine.dispose()
    print("schema heal complete")


if __name__ == "__main__":
    asyncio.run(main())
