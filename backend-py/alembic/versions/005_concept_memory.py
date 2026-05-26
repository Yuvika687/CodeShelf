"""add concept memory cache and chat tree

Revision ID: 005_concept_memory
Revises: 005_learning_artifacts
Create Date: 2026-05-26
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "005_concept_memory"
down_revision = "005_learning_artifacts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "concept_sources",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note_id", sa.String(36), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=True),
        sa.Column("topic", sa.String(160), nullable=False, server_default="General"),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("url", sa.String(700), nullable=False, server_default=""),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("source_type", sa.String(40), nullable=False, server_default="internet"),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_concept_sources_user_id", "concept_sources", ["user_id"])
    op.create_index("ix_concept_sources_note_id", "concept_sources", ["note_id"])
    op.create_index("ix_concept_sources_topic", "concept_sources", ["topic"])
    op.create_index("ix_concept_sources_fetched_at", "concept_sources", ["fetched_at"])

    op.create_table(
        "concept_chat_nodes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note_id", sa.String(36), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=True),
        sa.Column("parent_id", sa.String(36), sa.ForeignKey("concept_chat_nodes.id", ondelete="CASCADE"), nullable=True),
        sa.Column("topic", sa.String(160), nullable=False, server_default="General"),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("sources_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_concept_chat_nodes_user_id", "concept_chat_nodes", ["user_id"])
    op.create_index("ix_concept_chat_nodes_note_id", "concept_chat_nodes", ["note_id"])
    op.create_index("ix_concept_chat_nodes_parent_id", "concept_chat_nodes", ["parent_id"])
    op.create_index("ix_concept_chat_nodes_topic", "concept_chat_nodes", ["topic"])
    op.create_index("ix_concept_chat_nodes_created_at", "concept_chat_nodes", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_concept_chat_nodes_created_at", table_name="concept_chat_nodes")
    op.drop_index("ix_concept_chat_nodes_topic", table_name="concept_chat_nodes")
    op.drop_index("ix_concept_chat_nodes_parent_id", table_name="concept_chat_nodes")
    op.drop_index("ix_concept_chat_nodes_note_id", table_name="concept_chat_nodes")
    op.drop_index("ix_concept_chat_nodes_user_id", table_name="concept_chat_nodes")
    op.drop_table("concept_chat_nodes")

    op.drop_index("ix_concept_sources_fetched_at", table_name="concept_sources")
    op.drop_index("ix_concept_sources_topic", table_name="concept_sources")
    op.drop_index("ix_concept_sources_note_id", table_name="concept_sources")
    op.drop_index("ix_concept_sources_user_id", table_name="concept_sources")
    op.drop_table("concept_sources")
