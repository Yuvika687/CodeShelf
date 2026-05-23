"""auth verification and richer email preferences

Revision ID: 003_auth_email_preferences
Revises: 002_email_log_metadata
Create Date: 2026-05-24
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "003_auth_email_preferences"
down_revision = "002_email_log_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("auth_provider", sa.String(30), nullable=False, server_default="password"))
    op.add_column("users", sa.Column("firebase_uid", sa.String(128), nullable=False, server_default=""))
    op.create_index("ix_users_firebase_uid", "users", ["firebase_uid"], unique=False)

    op.add_column("email_preferences", sa.Column("include_summary", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("email_preferences", sa.Column("include_streak_alert", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("email_preferences", sa.Column("reminder_style", sa.String(30), nullable=False, server_default="focused"))
    op.add_column("email_preferences", sa.Column("subject_style", sa.String(30), nullable=False, server_default="personal"))


def downgrade() -> None:
    op.drop_column("email_preferences", "subject_style")
    op.drop_column("email_preferences", "reminder_style")
    op.drop_column("email_preferences", "include_streak_alert")
    op.drop_column("email_preferences", "include_summary")
    op.drop_index("ix_users_firebase_uid", table_name="users")
    op.drop_column("users", "firebase_uid")
    op.drop_column("users", "auth_provider")
    op.drop_column("users", "email_verified")
