"""encrypt stored GitHub OAuth tokens at rest

Revision ID: 009_encrypt_github_tokens
Revises: 008_extension_pairing_codes
Create Date: 2026-10-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

from app.crypto import encrypt_secret, is_encrypted


revision = "009_encrypt_github_tokens"
down_revision = "008_extension_pairing_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, access_token FROM github_connections")).fetchall()
    for row_id, token in rows:
        if token and not is_encrypted(token):
            conn.execute(
                sa.text("UPDATE github_connections SET access_token = :token WHERE id = :id"),
                {"token": encrypt_secret(token), "id": row_id},
            )


def downgrade() -> None:
    # Tokens stay encrypted; the app reads both forms, so there is nothing to undo safely.
    pass
