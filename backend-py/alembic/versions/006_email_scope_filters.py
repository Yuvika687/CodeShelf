"""add email scope filters

Revision ID: 006_email_scope_filters
Revises: 005_concept_memory
Create Date: 2026-05-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "006_email_scope_filters"
down_revision = "005_concept_memory"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("email_preferences", sa.Column("selected_topics_json", sa.Text(), nullable=False, server_default="[]"))
    op.add_column("email_preferences", sa.Column("selected_note_ids_json", sa.Text(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("email_preferences", "selected_note_ids_json")
    op.drop_column("email_preferences", "selected_topics_json")
