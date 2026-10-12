"""persist extension pairing codes

Revision ID: 008_extension_pairing_codes
Revises: 007_email_frequency
Create Date: 2026-10-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "008_extension_pairing_codes"
down_revision = "007_email_frequency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "extension_pairing_codes",
        sa.Column("code_hash", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_extension_pairing_codes_user_id", "extension_pairing_codes", ["user_id"])
    op.create_index("ix_extension_pairing_codes_expires_at", "extension_pairing_codes", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_extension_pairing_codes_expires_at", table_name="extension_pairing_codes")
    op.drop_index("ix_extension_pairing_codes_user_id", table_name="extension_pairing_codes")
    op.drop_table("extension_pairing_codes")
