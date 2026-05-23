"""store lean email delivery metadata

Revision ID: 002_email_log_metadata
Revises: 001_initial_schema
Create Date: 2026-05-23
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "002_email_log_metadata"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("email_logs", sa.Column("email_type", sa.String(40), nullable=False, server_default="daily_revision"))
    op.add_column("email_logs", sa.Column("recipient", sa.String(255), nullable=False, server_default=""))
    op.add_column("email_logs", sa.Column("card_ids", sa.Text(), nullable=False, server_default=""))
    op.add_column("email_logs", sa.Column("provider_message_id", sa.String(120), nullable=False, server_default=""))
    op.create_index("ix_email_logs_email_type", "email_logs", ["email_type"])


def downgrade() -> None:
    op.drop_index("ix_email_logs_email_type", table_name="email_logs")
    op.drop_column("email_logs", "provider_message_id")
    op.drop_column("email_logs", "card_ids")
    op.drop_column("email_logs", "recipient")
    op.drop_column("email_logs", "email_type")
