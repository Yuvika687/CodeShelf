from __future__ import annotations

import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Table, Text, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


note_tags = Table(
    "note_tags",
    Base.metadata,
    Column("note_id", String(36), ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String(36), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    auth_provider: Mapped[str] = mapped_column(String(30), default="password")
    firebase_uid: Mapped[str] = mapped_column(String(128), default="", index=True)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    notes: Mapped[list["Note"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    problems: Mapped[list["Problem"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    mistakes: Mapped[list["Mistake"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    revision_cards: Mapped[list["RevisionCard"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    activities: Mapped[list["DailyActivity"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    email_preferences: Mapped["EmailPreference"] = relationship(back_populates="user", cascade="all, delete-orphan", uselist=False)
    github_connection: Mapped["GitHubConnection | None"] = relationship(back_populates="user", cascade="all, delete-orphan", uselist=False)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    notes: Mapped[list["Note"]] = relationship(secondary=note_tags, back_populates="tags")


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    note_type: Mapped[str] = mapped_column(String(40), default="Concept Note", index=True)
    topic: Mapped[str] = mapped_column(String(120), default="General", index=True)
    subtopic: Mapped[str] = mapped_column(String(160), default="")
    difficulty: Mapped[str] = mapped_column(String(20), default="Medium")
    source: Mapped[str] = mapped_column(String(120), default="")
    source_url: Mapped[str] = mapped_column(String(500), default="")
    code_snippet: Mapped[str] = mapped_column(Text, default="")
    language: Mapped[str] = mapped_column(String(60), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="notes")
    tags: Mapped[list["Tag"]] = relationship(secondary=note_tags, back_populates="notes")
    revision_cards: Mapped[list["RevisionCard"]] = relationship(back_populates="note")
    mistakes: Mapped[list["Mistake"]] = relationship(back_populates="note")


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(80), default="LeetCode")
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    url: Mapped[str] = mapped_column(String(500), default="")
    difficulty: Mapped[str] = mapped_column(String(20), default="Medium")
    topic: Mapped[str] = mapped_column(String(120), default="DSA", index=True)
    pattern: Mapped[str] = mapped_column(String(160), default="", index=True)
    status: Mapped[str] = mapped_column(String(30), default="not_started", index=True)
    approach: Mapped[str] = mapped_column(Text, default="")
    code: Mapped[str] = mapped_column(Text, default="")
    language: Mapped[str] = mapped_column(String(60), default="")
    mistake: Mapped[str] = mapped_column(Text, default="")
    time_complexity: Mapped[str] = mapped_column(String(120), default="")
    space_complexity: Mapped[str] = mapped_column(String(120), default="")
    last_solved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_review_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="problems")
    revision_cards: Mapped[list["RevisionCard"]] = relationship(back_populates="problem")
    mistakes: Mapped[list["Mistake"]] = relationship(back_populates="problem")


class Mistake(Base):
    __tablename__ = "mistakes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    note_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("notes.id", ondelete="SET NULL"), nullable=True)
    problem_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("problems.id", ondelete="SET NULL"), nullable=True)
    mistake_title: Mapped[str] = mapped_column(String(300), nullable=False)
    wrong_approach: Mapped[str] = mapped_column(Text, default="")
    correct_approach: Mapped[str] = mapped_column(Text, default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    prevention_tip: Mapped[str] = mapped_column(Text, default="")
    topic: Mapped[str] = mapped_column(String(120), default="General", index=True)
    times_repeated: Mapped[int] = mapped_column(Integer, default=1)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="mistakes")
    note: Mapped["Note | None"] = relationship(back_populates="mistakes")
    problem: Mapped["Problem | None"] = relationship(back_populates="mistakes")
    revision_cards: Mapped[list["RevisionCard"]] = relationship(back_populates="mistake")


class RevisionCard(Base):
    __tablename__ = "revision_cards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    note_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("notes.id", ondelete="CASCADE"), nullable=True)
    problem_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("problems.id", ondelete="CASCADE"), nullable=True)
    mistake_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("mistakes.id", ondelete="CASCADE"), nullable=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    card_type: Mapped[str] = mapped_column(String(60), default="recall")
    topic: Mapped[str] = mapped_column(String(120), default="General", index=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="Medium")
    next_review_date: Mapped[date] = mapped_column(Date, default=date.today, index=True)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    memory_strength: Mapped[float] = mapped_column(Float, default=0.0)
    review_status: Mapped[str] = mapped_column(String(30), default="due")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="revision_cards")
    note: Mapped["Note | None"] = relationship(back_populates="revision_cards")
    problem: Mapped["Problem | None"] = relationship(back_populates="revision_cards")
    mistake: Mapped["Mistake | None"] = relationship(back_populates="revision_cards")
    review_logs: Mapped[list["ReviewLog"]] = relationship(back_populates="revision_card", cascade="all, delete-orphan")


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    revision_card_id: Mapped[str] = mapped_column(String(36), ForeignKey("revision_cards.id", ondelete="CASCADE"), index=True, nullable=False)
    rating: Mapped[str] = mapped_column(String(20), nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    old_interval: Mapped[int] = mapped_column(Integer, default=1)
    new_interval: Mapped[int] = mapped_column(Integer, default=1)

    revision_card: Mapped["RevisionCard"] = relationship(back_populates="review_logs")


class DailyActivity(Base):
    __tablename__ = "daily_activity"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_daily_activity_user_date"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    date: Mapped[date] = mapped_column(Date, default=date.today, index=True)
    cards_reviewed: Mapped[int] = mapped_column(Integer, default=0)
    problems_revised: Mapped[int] = mapped_column(Integer, default=0)
    notes_revised: Mapped[int] = mapped_column(Integer, default=0)
    mistakes_fixed: Mapped[int] = mapped_column(Integer, default=0)
    completed_today: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="activities")


class EmailPreference(Base):
    __tablename__ = "email_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    email_time: Mapped[time] = mapped_column(Time, default=lambda: time(8, 0))
    timezone: Mapped[str] = mapped_column(String(80), default="Asia/Calcutta")
    daily_card_count: Mapped[int] = mapped_column(Integer, default=5)
    include_dsa: Mapped[bool] = mapped_column(Boolean, default=True)
    include_sql: Mapped[bool] = mapped_column(Boolean, default=True)
    include_devops: Mapped[bool] = mapped_column(Boolean, default=True)
    include_mistakes: Mapped[bool] = mapped_column(Boolean, default=True)
    include_summary: Mapped[bool] = mapped_column(Boolean, default=True)
    include_streak_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    reminder_style: Mapped[str] = mapped_column(String(30), default="focused")
    subject_style: Mapped[str] = mapped_column(String(30), default="personal")
    selected_topics_json: Mapped[str] = mapped_column(Text, default="[]")
    selected_note_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="email_preferences")


class EmailLog(Base):
    __tablename__ = "email_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    email_type: Mapped[str] = mapped_column(String(40), default="daily_revision", index=True)
    recipient: Mapped[str] = mapped_column(String(255), default="")
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="")
    card_ids: Mapped[str] = mapped_column(Text, default="")
    provider_message_id: Mapped[str] = mapped_column(String(120), default="")
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(30), default="printed")
    error_message: Mapped[str] = mapped_column(Text, default="")


class ConceptSource(Base):
    __tablename__ = "concept_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    note_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("notes.id", ondelete="CASCADE"), nullable=True, index=True)
    topic: Mapped[str] = mapped_column(String(160), default="General", index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    url: Mapped[str] = mapped_column(String(700), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    source_type: Mapped[str] = mapped_column(String(40), default="internet")
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class ConceptChatNode(Base):
    __tablename__ = "concept_chat_nodes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    note_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("notes.id", ondelete="CASCADE"), nullable=True, index=True)
    parent_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("concept_chat_nodes.id", ondelete="CASCADE"), nullable=True, index=True)
    topic: Mapped[str] = mapped_column(String(160), default="General", index=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    sources_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class GitHubConnection(Base):
    __tablename__ = "github_connections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    github_username: Mapped[str] = mapped_column(String(120), default="")
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    repo_full_name: Mapped[str] = mapped_column(String(300), default="")
    default_branch: Mapped[str] = mapped_column(String(80), default="main")
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="github_connection")
