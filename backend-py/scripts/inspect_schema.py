"""Read-only diagnostic: print every table/column/type in the live database."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.database import engine  # noqa: E402


async def main() -> None:
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT table_name, column_name, data_type, is_nullable "
                "FROM information_schema.columns "
                "WHERE table_schema = 'public' "
                "ORDER BY table_name, ordinal_position"
            )
        )
        rows = result.fetchall()

    print("=== SCHEMA DUMP START ===")
    current_table = None
    for table_name, column_name, data_type, is_nullable in rows:
        if table_name != current_table:
            print(f"\n[{table_name}]")
            current_table = table_name
        print(f"  {column_name}: {data_type} (nullable={is_nullable})")
    print("\n=== SCHEMA DUMP END ===")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
