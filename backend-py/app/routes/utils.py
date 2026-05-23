from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DailyActivity, EmailPreference, Mistake, Note, Problem, RevisionCard, Tag, User


MIN_DAILY_CARDS = 5


def iso(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def user_out(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "email_verified": user.email_verified,
        "auth_provider": user.auth_provider,
        "current_streak": user.current_streak,
        "longest_streak": user.longest_streak,
        "created_at": iso(user.created_at),
    }


def note_out(note: Note) -> dict[str, Any]:
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "note_type": note.note_type,
        "topic": note.topic,
        "subtopic": note.subtopic,
        "difficulty": note.difficulty,
        "source": note.source,
        "source_url": note.source_url,
        "code_snippet": note.code_snippet,
        "language": note.language,
        "summary": note.summary,
        "tags": [tag.name for tag in note.tags],
        "created_at": iso(note.created_at),
        "updated_at": iso(note.updated_at),
    }


def problem_out(problem: Problem) -> dict[str, Any]:
    return {
        "id": problem.id,
        "platform": problem.platform,
        "title": problem.title,
        "url": problem.url,
        "difficulty": problem.difficulty,
        "topic": problem.topic,
        "pattern": problem.pattern,
        "status": problem.status,
        "approach": problem.approach,
        "code": problem.code,
        "language": problem.language,
        "mistake": problem.mistake,
        "time_complexity": problem.time_complexity,
        "space_complexity": problem.space_complexity,
        "last_solved_at": iso(problem.last_solved_at),
        "next_review_date": iso(problem.next_review_date),
        "created_at": iso(problem.created_at),
        "updated_at": iso(problem.updated_at),
    }


def mistake_out(mistake: Mistake) -> dict[str, Any]:
    return {
        "id": mistake.id,
        "note_id": mistake.note_id,
        "problem_id": mistake.problem_id,
        "mistake_title": mistake.mistake_title,
        "wrong_approach": mistake.wrong_approach,
        "correct_approach": mistake.correct_approach,
        "reason": mistake.reason,
        "prevention_tip": mistake.prevention_tip,
        "topic": mistake.topic,
        "times_repeated": mistake.times_repeated,
        "last_seen_at": iso(mistake.last_seen_at),
        "created_at": iso(mistake.created_at),
    }


def card_out(card: RevisionCard) -> dict[str, Any]:
    return {
        "id": card.id,
        "note_id": card.note_id,
        "problem_id": card.problem_id,
        "mistake_id": card.mistake_id,
        "question": card.question,
        "answer": card.answer,
        "card_type": card.card_type,
        "topic": card.topic,
        "difficulty": card.difficulty,
        "next_review_date": iso(card.next_review_date),
        "last_reviewed_at": iso(card.last_reviewed_at),
        "interval_days": card.interval_days,
        "memory_strength": card.memory_strength,
        "review_status": card.review_status,
        "created_at": iso(card.created_at),
        "updated_at": iso(card.updated_at),
    }


async def resolve_tags(db: AsyncSession, names: list[str]) -> list[Tag]:
    cleaned = []
    for name in names:
        text = str(name).strip()
        if text and text.lower() not in [item.lower() for item in cleaned]:
            cleaned.append(text)
    if not cleaned:
        return []
    result = await db.execute(select(Tag).where(Tag.name.in_(cleaned)))
    existing = {tag.name.lower(): tag for tag in result.scalars().all()}
    tags = []
    for name in cleaned:
        tag = existing.get(name.lower())
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            await db.flush()
        tags.append(tag)
    return tags


def fallback_cards_from_note(note: Note) -> list[RevisionCard]:
    summary = note.summary or note.content.strip().split("\n")[0][:280]
    cards = [
        RevisionCard(
            user_id=note.user_id,
            note_id=note.id,
            question=f"What is the core idea of {note.title}?",
            answer=summary or note.content[:500],
            card_type="concept",
            topic=note.topic,
            difficulty=note.difficulty,
        )
    ]
    if note.code_snippet:
        cards.append(
            RevisionCard(
                user_id=note.user_id,
                note_id=note.id,
                question=f"When would you use this {note.language or 'code'} snippet from {note.title}?",
                answer=note.code_snippet[:1200],
                card_type="code",
                topic=note.topic,
                difficulty=note.difficulty,
            )
        )
    return cards


def fallback_cards_from_problem(problem: Problem) -> list[RevisionCard]:
    cards = [
        RevisionCard(
            user_id=problem.user_id,
            problem_id=problem.id,
            question=f"What is the approach for {problem.title}?",
            answer=problem.approach or "Explain the invariant, data structure, and final return condition.",
            card_type="problem",
            topic=problem.topic,
            difficulty=problem.difficulty,
        )
    ]
    if problem.mistake:
        cards.append(
            RevisionCard(
                user_id=problem.user_id,
                problem_id=problem.id,
                question=f"What mistake should you avoid in {problem.title}?",
                answer=problem.mistake,
                card_type="mistake",
                topic=problem.topic,
                difficulty=problem.difficulty,
            )
        )
    return cards


def fallback_card_from_mistake(mistake: Mistake) -> RevisionCard:
    return RevisionCard(
        user_id=mistake.user_id,
        note_id=mistake.note_id,
        problem_id=mistake.problem_id,
        mistake_id=mistake.id,
        question=f"What went wrong: {mistake.mistake_title}?",
        answer=f"Correct approach: {mistake.correct_approach}\nPrevention: {mistake.prevention_tip}",
        card_type="mistake",
        topic=mistake.topic,
        difficulty="Hard",
    )


def next_interval(rating: str, old_interval: int) -> tuple[int, float]:
    rating = rating.lower()
    if rating in {"again", "forgot", "i forgot"}:
        return 1, -0.25
    if rating == "hard":
        return max(2, min(old_interval + 1, old_interval * 2)), 0.05
    if rating == "easy":
        return max(7, old_interval * 2), 0.3
    return max(4, old_interval + 4), 0.18


async def get_or_create_today_activity(db: AsyncSession, user: User) -> DailyActivity:
    today = date.today()
    result = await db.execute(select(DailyActivity).where(DailyActivity.user_id == user.id, DailyActivity.date == today))
    activity = result.scalar_one_or_none()
    if activity:
        return activity
    activity = DailyActivity(user_id=user.id, date=today)
    db.add(activity)
    await db.flush()
    return activity


async def recalc_streak(db: AsyncSession, user: User) -> None:
    result = await db.execute(
        select(DailyActivity.date)
        .where(DailyActivity.user_id == user.id, DailyActivity.completed_today.is_(True))
        .order_by(DailyActivity.date.desc())
    )
    dates = [row[0] for row in result.all()]
    streak = 0
    expected = date.today()
    for day in dates:
        if day == expected:
            streak += 1
            expected -= timedelta(days=1)
        elif day < expected:
            break
    user.current_streak = streak
    user.longest_streak = max(user.longest_streak or 0, streak)


async def ensure_email_preferences(db: AsyncSession, user: User) -> EmailPreference:
    result = await db.execute(select(EmailPreference).where(EmailPreference.user_id == user.id))
    prefs = result.scalar_one_or_none()
    if prefs:
        return prefs
    prefs = EmailPreference(user_id=user.id)
    db.add(prefs)
    await db.flush()
    return prefs
