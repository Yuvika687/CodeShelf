from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models import Note, RevisionCard, User
from app.routes.utils import fallback_cards_from_note, note_out, resolve_tags


router = APIRouter(prefix="/api/notes", tags=["notes"])


class NoteIn(BaseModel):
    title: str
    content: str
    note_type: str = Field(default="Concept Note")
    topic: str = "General"
    subtopic: str = ""
    difficulty: str = "Medium"
    source: str = ""
    source_url: str = ""
    code_snippet: str = ""
    language: str = ""
    summary: str = ""
    tags: list[str] = []
    generate_cards: bool = True
    revision_cards: list[dict[str, str]] = []


@router.get("")
async def list_notes(
    search: str = "",
    topic: str = "",
    note_type: str = "",
    difficulty: str = "",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Note).options(selectinload(Note.tags)).where(Note.user_id == user.id)
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(Note.title.ilike(pattern), Note.content.ilike(pattern), Note.topic.ilike(pattern)))
    if topic:
        query = query.where(Note.topic == topic)
    if note_type:
        query = query.where(Note.note_type == note_type)
    if difficulty:
        query = query.where(Note.difficulty == difficulty)
    result = await db.execute(query.order_by(Note.updated_at.desc()))
    return {"notes": [note_out(note) for note in result.scalars().unique().all()]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_note(body: NoteIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    note = Note(
        user_id=user.id,
        title=body.title.strip(),
        content=body.content,
        note_type=body.note_type,
        topic=body.topic,
        subtopic=body.subtopic,
        difficulty=body.difficulty,
        source=body.source,
        source_url=body.source_url,
        code_snippet=body.code_snippet,
        language=body.language,
        summary=body.summary,
    )
    note.tags = await resolve_tags(db, body.tags)
    db.add(note)
    await db.flush()
    imported_cards = [
        RevisionCard(
            user_id=user.id,
            note_id=note.id,
            question=str(card.get("question", "")).strip(),
            answer=str(card.get("answer", "")).strip(),
            card_type=str(card.get("card_type", "recall")).strip() or "recall",
            topic=body.topic,
            difficulty=body.difficulty,
        )
        for card in body.revision_cards
        if str(card.get("question", "")).strip() and str(card.get("answer", "")).strip()
    ]
    if imported_cards:
        db.add_all(imported_cards)
    elif body.generate_cards:
        db.add_all(fallback_cards_from_note(note))
    await db.flush()
    return {"note": note_out(note)}


@router.get("/{note_id}")
async def get_note(note_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).options(selectinload(Note.tags), selectinload(Note.revision_cards)).where(Note.id == note_id, Note.user_id == user.id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    data = note_out(note)
    data["revision_cards"] = [{"id": card.id, "question": card.question, "next_review_date": card.next_review_date.isoformat()} for card in note.revision_cards]
    return {"note": data}


@router.put("/{note_id}")
async def update_note(note_id: str, body: NoteIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).options(selectinload(Note.tags)).where(Note.id == note_id, Note.user_id == user.id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    for key, value in body.model_dump(exclude={"tags", "generate_cards", "revision_cards"}).items():
        setattr(note, key, value)
    note.tags = await resolve_tags(db, body.tags)
    await db.flush()
    return {"note": note_out(note)}


@router.delete("/{note_id}")
async def delete_note(note_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).where(Note.id == note_id, Note.user_id == user.id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    await db.delete(note)
    return {"ok": True}


@router.post("/{note_id}/generate-cards")
async def generate_note_cards(note_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).where(Note.id == note_id, Note.user_id == user.id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    cards = fallback_cards_from_note(note)
    db.add_all(cards)
    await db.flush()
    return {"cards": [{"id": card.id, "question": card.question, "answer": card.answer} for card in cards]}
