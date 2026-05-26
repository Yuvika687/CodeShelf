from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models import ConceptChatNode, ConceptSource, Mistake, Note, Problem, RevisionCard, User
from app.routes.ai import ask_gemini, cheap_summary
from app.routes.utils import card_out, mistake_out, note_out, problem_out


router = APIRouter(prefix="/api/concepts", tags=["concepts"])


class ReconstructIn(BaseModel):
    include_internet: bool = False


class ChatIn(BaseModel):
    question: str
    parent_id: str | None = None
    include_internet: bool = True


def short(value: str, limit: int = 700) -> str:
    text = " ".join(str(value or "").split())
    return text if len(text) <= limit else f"{text[: limit - 3].rstrip()}..."


def formula_lines(*blocks: str) -> list[str]:
    formulas: list[str] = []
    patterns = [
        r"\bO\([^)]+\)",
        r"\b[A-Za-z_][A-Za-z0-9_]*\s*=\s*[^,\n;]+",
        r"\b\d+\s*[+\-*/]\s*\d+\b",
        r"\bformula\b|\bcomplexity\b|\binvariant\b|\brecurrence\b|\bstate\b",
    ]
    for block in blocks:
        for raw in str(block or "").splitlines():
            line = raw.strip(" -*`")
            if 5 <= len(line) <= 220 and any(re.search(pattern, line, re.IGNORECASE) for pattern in patterns):
                if line not in formulas:
                    formulas.append(line)
            if len(formulas) >= 8:
                return formulas
    return formulas


def source_out(source: ConceptSource) -> dict:
    return {
        "id": source.id,
        "title": source.title,
        "url": source.url,
        "summary": source.summary,
        "source_type": source.source_type,
        "fetched_at": source.fetched_at.isoformat() if source.fetched_at else None,
    }


def chat_out(node: ConceptChatNode) -> dict:
    try:
        sources = json.loads(node.sources_json or "[]")
    except json.JSONDecodeError:
        sources = []
    return {
        "id": node.id,
        "parent_id": node.parent_id,
        "topic": node.topic,
        "question": node.question,
        "answer": node.answer,
        "sources": sources,
        "created_at": node.created_at.isoformat() if node.created_at else None,
    }


async def get_owned_note(db: AsyncSession, user: User, note_id: str) -> Note:
    result = await db.execute(
        select(Note)
        .options(selectinload(Note.tags), selectinload(Note.revision_cards))
        .where(Note.id == note_id, Note.user_id == user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    return note


async def local_memory(db: AsyncSession, user: User, note: Note) -> dict:
    topic_pattern = f"%{note.topic}%"
    problem_result = await db.execute(
        select(Problem)
        .where(
            Problem.user_id == user.id,
            or_(Problem.topic == note.topic, Problem.pattern.ilike(topic_pattern), Problem.title.ilike(f"%{note.title}%")),
        )
        .order_by(Problem.updated_at.desc())
        .limit(6)
    )
    mistake_result = await db.execute(
        select(Mistake)
        .where(Mistake.user_id == user.id, or_(Mistake.note_id == note.id, Mistake.topic == note.topic))
        .order_by(Mistake.created_at.desc())
        .limit(6)
    )
    card_result = await db.execute(
        select(RevisionCard)
        .where(RevisionCard.user_id == user.id, or_(RevisionCard.note_id == note.id, RevisionCard.topic == note.topic))
        .order_by(RevisionCard.memory_strength.asc(), RevisionCard.next_review_date.asc())
        .limit(12)
    )
    problems = problem_result.scalars().all()
    mistakes = mistake_result.scalars().all()
    cards = card_result.scalars().all()
    formulas = formula_lines(
        note.summary,
        note.content,
        note.code_snippet,
        "\n".join(f"{item.time_complexity} {item.space_complexity} {item.approach}" for item in problems),
        "\n".join(card.answer for card in cards),
    )
    return {
        "problems": [problem_out(problem) for problem in problems],
        "mistakes": [mistake_out(mistake) for mistake in mistakes],
        "cards": [card_out(card) for card in cards],
        "formulas": formulas,
    }


def fallback_reconstruction(note: Note, memory: dict, sources: list[dict] | None = None) -> dict:
    mistakes = memory.get("mistakes", [])
    cards = memory.get("cards", [])
    problems = memory.get("problems", [])
    formulas = memory.get("formulas", [])
    return {
        "provider": "local-memory",
        "headline": f"Rebuild {note.title} from your saved memory.",
        "simple": note.summary or cheap_summary(note.content, 2),
        "deep": short(note.content or note.summary, 950),
        "formulas": formulas[:8] or [item for item in [problems[0].get("time_complexity") if problems else "", problems[0].get("space_complexity") if problems else ""] if item],
        "code_pattern": short(note.code_snippet or (problems[0].get("code") if problems else ""), 1200),
        "mistake_memory": [
            {
                "title": item["mistake_title"],
                "wrong": short(item["wrong_approach"], 220),
                "correct": short(item["correct_approach"], 260),
                "prevention": short(item["prevention_tip"], 220),
            }
            for item in mistakes[:4]
        ],
        "active_recall": [{"question": item["question"], "answer": short(item["answer"], 320), "type": item["card_type"]} for item in cards[:6]],
        "internet_takeaways": [{"title": source["title"], "summary": source["summary"], "url": source["url"]} for source in (sources or [])[:4]],
    }


async def cached_sources(db: AsyncSession, user: User, note: Note) -> list[ConceptSource]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    result = await db.execute(
        select(ConceptSource)
        .where(
            ConceptSource.user_id == user.id,
            or_(ConceptSource.note_id == note.id, ConceptSource.topic == note.topic),
            ConceptSource.fetched_at >= cutoff,
        )
        .order_by(ConceptSource.fetched_at.desc())
        .limit(6)
    )
    return result.scalars().all()


async def fetch_public_sources(query: str) -> list[dict]:
    sources: list[dict] = []
    headers = {"User-Agent": "CodeShelf/1.0 concept memory"}
    async with httpx.AsyncClient(timeout=8, headers=headers, follow_redirects=True) as client:
        try:
            wiki = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={"action": "query", "list": "search", "srsearch": query, "srlimit": 3, "format": "json"},
            )
            for row in wiki.json().get("query", {}).get("search", []):
                title = str(row.get("title") or "").strip()
                snippet = re.sub(r"<[^>]+>", "", str(row.get("snippet") or "")).strip()
                if title and snippet:
                    sources.append(
                        {
                            "title": title,
                            "url": f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}",
                            "summary": short(snippet, 520),
                            "source_type": "wikipedia",
                        }
                    )
        except Exception:
            pass

        try:
            ddg = await client.get("https://api.duckduckgo.com/", params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1})
            data = ddg.json()
            if data.get("AbstractText") and data.get("AbstractURL"):
                sources.append(
                    {
                        "title": data.get("Heading") or query,
                        "url": data["AbstractURL"],
                        "summary": short(data["AbstractText"], 700),
                        "source_type": "duckduckgo",
                    }
                )
            for item in data.get("RelatedTopics", [])[:5]:
                if isinstance(item, dict) and item.get("Text") and item.get("FirstURL"):
                    sources.append(
                        {
                            "title": short(item["Text"].split(" - ")[0], 90),
                            "url": item["FirstURL"],
                            "summary": short(item["Text"], 520),
                            "source_type": "duckduckgo",
                        }
                    )
        except Exception:
            pass

    deduped: list[dict] = []
    seen: set[str] = set()
    for source in sources:
        key = source.get("url") or source.get("title")
        if key and key not in seen:
            deduped.append(source)
            seen.add(key)
        if len(deduped) >= 5:
            break
    return deduped


async def save_sources(db: AsyncSession, user: User, note: Note, rows: list[dict]) -> list[ConceptSource]:
    existing = await cached_sources(db, user, note)
    existing_urls = {item.url for item in existing}
    saved = list(existing)
    for row in rows:
        if row["url"] in existing_urls:
            continue
        source = ConceptSource(
            user_id=user.id,
            note_id=note.id,
            topic=note.topic,
            title=short(row["title"], 290),
            url=row["url"],
            summary=short(row["summary"], 900),
            source_type=row.get("source_type", "internet"),
        )
        db.add(source)
        saved.insert(0, source)
    await db.flush()
    return saved[:6]


async def ai_reconstruction(note: Note, memory: dict, sources: list[dict]) -> dict:
    fallback = fallback_reconstruction(note, memory, sources)
    prompt = (
        "You are CodeShelf's RAG memory reconstruction engine for developers. "
        "Goal: answer the emotional request 'I forgot this; remind me exactly how I learned it before.' "
        "Return ONLY valid JSON, no markdown, no comments, no trailing prose. "
        "Required keys: headline, simple, deep, formulas, code_pattern, mistake_memory, active_recall, internet_takeaways. "
        "Use the user's saved note, cards, solved problems, and mistakes as primary evidence. "
        "Use internet sources only as secondary context and mention the source title inside internet_takeaways. "
        "Do not invent citations, formulas, code, or complexities. If unsure, write a concise verification note. "
        "Make formulas concrete: include Big-O, recurrence, invariant, state transition, SQL clause order, command syntax, or API shape when relevant. "
        "Make code_pattern a runnable snippet or precise skeleton from the user's language/content when possible. "
        "Make mistake_memory focus on wrong approach -> correct approach -> prevention. "
        "Make active_recall a list of direct questions the user can answer without looking.\n\n"
        "JSON shape reminder:\n"
        '{"headline":"...","simple":"...","deep":"...","formulas":["..."],"code_pattern":"...",'
        '"mistake_memory":[{"title":"...","wrong":"...","correct":"...","prevention":"..."}],'
        '"active_recall":[{"question":"...","answer":"...","type":"..."}],'
        '"internet_takeaways":[{"title":"...","summary":"...","url":"..."}]}\n\n'
        f"Title: {note.title}\nTopic: {note.topic}\nSummary: {note.summary}\nContent: {short(note.content, 2400)}\n"
        f"Code: {short(note.code_snippet, 1200)}\n"
        f"Local memory JSON: {json.dumps(memory, default=str)[:4200]}\n"
        f"Sources JSON: {json.dumps(sources)[:2200]}"
    )
    raw = await ask_gemini(prompt)
    if not raw:
        return fallback
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.IGNORECASE)
    try:
        parsed = json.loads(text[text.find("{") : text.rfind("}") + 1])
    except Exception:
        return fallback
    return {"provider": "gemini", **fallback, **parsed}


@router.get("/notes/{note_id}")
async def concept_detail(note_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    note = await get_owned_note(db, user, note_id)
    memory = await local_memory(db, user, note)
    sources = [source_out(source) for source in await cached_sources(db, user, note)]
    chat_result = await db.execute(
        select(ConceptChatNode)
        .where(ConceptChatNode.user_id == user.id, ConceptChatNode.note_id == note.id)
        .order_by(ConceptChatNode.created_at.desc())
        .limit(30)
    )
    note_data = note_out(note)
    note_data["revision_cards"] = [
        {"id": card.id, "question": card.question, "answer": card.answer, "card_type": card.card_type or "recall", "next_review_date": card.next_review_date.isoformat()}
        for card in note.revision_cards
    ]
    return {
        "note": note_data,
        "memory": memory,
        "sources": sources,
        "reconstruction": fallback_reconstruction(note, memory, sources),
        "chat_tree": [chat_out(node) for node in chat_result.scalars().all()],
    }


@router.post("/notes/{note_id}/research")
async def research_concept(note_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    note = await get_owned_note(db, user, note_id)
    query = " ".join(part for part in [note.title, note.topic, note.subtopic, "formula complexity code pattern"] if part)
    rows = await fetch_public_sources(query)
    sources = await save_sources(db, user, note, rows)
    return {"sources": [source_out(source) for source in sources], "fetched": len(rows)}


@router.post("/notes/{note_id}/reconstruct")
async def reconstruct_concept(body: ReconstructIn, note_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    note = await get_owned_note(db, user, note_id)
    if body.include_internet and not await cached_sources(db, user, note):
        rows = await fetch_public_sources(" ".join([note.title, note.topic, "formula complexity code pattern"]))
        await save_sources(db, user, note, rows)
    memory = await local_memory(db, user, note)
    sources = [source_out(source) for source in await cached_sources(db, user, note)]
    return {"reconstruction": await ai_reconstruction(note, memory, sources), "sources": sources}


@router.post("/notes/{note_id}/chat")
async def chat_concept(body: ChatIn, note_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    note = await get_owned_note(db, user, note_id)
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")
    if body.include_internet and not await cached_sources(db, user, note):
        rows = await fetch_public_sources(" ".join([note.title, note.topic, question]))
        await save_sources(db, user, note, rows)
    memory = await local_memory(db, user, note)
    sources = [source_out(source) for source in await cached_sources(db, user, note)]
    prompt = (
        "Answer as CodeShelf's recall coach inside a persistent chat tree. "
        "The user is trying to recover a concept they once learned. Use this response structure:\n"
        "1. Memory hook: one sentence connecting the concept to the user's saved note/problem/mistake.\n"
        "2. Core explanation: concise but complete.\n"
        "3. Formula/code/invariant: include concrete syntax, Big-O, recurrence, state transition, or command pattern when relevant.\n"
        "4. Edge case or common mistake: show how to avoid it.\n"
        "5. Recall check: one question the user should answer from memory.\n"
        "Ground the answer in local memory first. Use internet sources only as supporting context. "
        "If the saved data is insufficient, say exactly what is missing instead of hallucinating.\n\n"
        f"User question: {question}\nConcept: {note.title} / {note.topic}\n"
        f"Saved note: {short(note.content, 2600)}\nSaved code: {short(note.code_snippet, 1000)}\n"
        f"Local memory JSON: {json.dumps(memory, default=str)[:3600]}\nSources: {json.dumps(sources)[:1800]}"
    )
    answer = await ask_gemini(prompt)
    if not answer:
        answer = (
            f"Start from your saved note: {note.summary or cheap_summary(note.content, 2)}\n\n"
            f"Formula/code signals: {', '.join(memory.get('formulas', [])[:4]) or 'No explicit formulas saved yet.'}\n\n"
            "Recall check: explain the invariant, then write the core code pattern without looking."
        )
    node = ConceptChatNode(
        user_id=user.id,
        note_id=note.id,
        parent_id=body.parent_id,
        topic=note.topic,
        question=question,
        answer=answer.strip(),
        sources_json=json.dumps([{"title": item["title"], "url": item["url"]} for item in sources[:4]]),
    )
    db.add(node)
    await db.flush()
    return {"node": chat_out(node)}
