"""add email frequency preference

Revision ID: 007_email_frequency
Revises: 006_email_scope_filters
Create Date: 2026-05-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "007_email_frequency"
down_revision = "006_email_scope_filters"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("email_preferences", sa.Column("emails_per_day", sa.Integer(), nullable=False, server_default="1"))


def downgrade() -> None:
    op.drop_column("email_preferences", "emails_per_day")
