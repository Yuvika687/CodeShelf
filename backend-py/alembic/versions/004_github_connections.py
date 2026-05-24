"""add github_connections table

Revision ID: 004_github_connections
Revises: 003_auth_email_preferences
Create Date: 2026-05-24
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "004_github_connections"
down_revision = "003_auth_email_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "github_connections",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("github_username", sa.String(120), nullable=False, server_default=""),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("repo_full_name", sa.String(300), nullable=False, server_default=""),
        sa.Column("default_branch", sa.String(80), nullable=False, server_default="main"),
        sa.Column("connected_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_github_connections_user_id", "github_connections", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_github_connections_user_id", table_name="github_connections")
    op.drop_table("github_connections")
