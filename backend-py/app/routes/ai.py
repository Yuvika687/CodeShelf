from __future__ import annotations

import asyncio
import json
import re

import httpx
from fastapi import APIRouter, Depends
from gradio_client import Client
from pydantic import BaseModel

from app.config import GEMINI_MODEL, get_settings
from app.deps import get_current_user
from app.models import User


router = APIRouter(prefix="/api/ai", tags=["ai"])
settings = get_settings()


class TextIn(BaseModel):
    text: str = ""
    note_id: str | None = None
    title: str = ""
    topic: str = "General"


def clean_text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def cheap_summary(text: str, max_sentences: int = 3) -> str:
    clean = re.sub(r"```[\s\S]*?```", " ", text or "")
    sentences = [item.strip() for item in re.split(r"(?<=[.!?])\s+|\n+", clean) if len(item.strip()) > 24]
    return " ".join(sentences[:max_sentences]) or clean[:320]


def text_from_space_result(result) -> str:
    if isinstance(result, str):
        return result.strip()
    if isinstance(result, dict):
        for key in ("summary", "text", "output", "result"):
            value = result.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return str(result)
    if isinstance(result, (list, tuple)):
        for item in result:
            text = text_from_space_result(item)
            if text:
                return text
    return ""


def parse_cards_from_text(raw: str, topic: str = "General") -> list[dict[str, str]]:
    text = clean_text(raw)
    if not text:
        return []
    unfenced = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()
    start_candidates = [idx for idx in (unfenced.find("["), unfenced.find("{")) if idx >= 0]
    if not start_candidates:
        return []
    start = min(start_candidates)
    end = unfenced.rfind("]") if unfenced[start] == "[" else unfenced.rfind("}")
    if end < start:
        return []
    try:
        parsed = json.loads(unfenced[start : end + 1])
    except json.JSONDecodeError:
        return []
    if isinstance(parsed, dict):
        parsed = parsed.get("revision_cards") or parsed.get("cards") or []
    if not isinstance(parsed, list):
        return []
    cards = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        question = clean_text(item.get("question"))
        answer = clean_text(item.get("answer"))
        if question and answer:
            cards.append(
                {
                    "question": question,
                    "answer": answer,
                    "card_type": clean_text(item.get("card_type")) or "recall",
                    "topic": clean_text(item.get("topic")) or topic,
                }
            )
    return cards[:8]


def fallback_card_dicts(title: str, topic: str, text: str) -> list[dict[str, str]]:
    summary = cheap_summary(text, 2)
    subject = title or topic or "this note"
    return [
        {"question": f"What is the key idea of {subject}?", "answer": summary, "card_type": "concept", "topic": topic},
        {"question": f"Explain {subject} like you are walking.", "answer": summary[:240], "card_type": "walk", "topic": topic},
    ]


def predict_hf_space_sync(text: str) -> str:
    client = Client(settings.hf_space_id, hf_token=settings.hf_api_key or None)
    result = client.predict(text[:6000], api_name=settings.hf_space_api_name)
    return text_from_space_result(result)


async def summarize_with_hf_space(text: str) -> str:
    if not settings.hf_space_id or not text:
        return ""
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(predict_hf_space_sync, text),
            timeout=10,
        )
    except asyncio.TimeoutError:
        # Timed out — fall back to extractive summary (first 3 sentences)
        return cheap_summary(text, 3)
    except Exception:
        return ""


async def ask_gemini(prompt: str) -> str:
    if not settings.gemini_api_key:
        return ""
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                params={"key": settings.gemini_api_key},
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            data = response.json()
            if not response.is_success:
                return ""
            return "\n".join(part.get("text", "") for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", []))
    except Exception:
        return ""


@router.post("/summarize-note")
async def summarize_note(body: TextIn, user: User = Depends(get_current_user)):
    space_summary = await summarize_with_hf_space(body.text)
    if space_summary:
        return {"summary": space_summary, "provider": "huggingface-space"}
    if settings.hf_api_key and body.text:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
                    headers={"Authorization": f"Bearer {settings.hf_api_key}"},
                    json={"inputs": body.text[:6000]},
                )
                data = response.json()
                if response.is_success and data:
                    return {"summary": data[0].get("summary_text", cheap_summary(body.text)), "provider": "huggingface-bart"}
        except Exception:
            pass
    return {"summary": cheap_summary(body.text), "provider": "fallback"}


@router.post("/generate-cards")
async def generate_cards(body: TextIn, user: User = Depends(get_current_user)):
    gemini = await ask_gemini(
        "Create 5 concise active-recall revision cards for a developer. Return only valid JSON, no markdown, "
        "as an array of objects with question, answer, card_type, topic. "
        "Cover concept, formula/complexity, code recall, edge case, and interview explanation when possible. "
        "Answers must be grounded in the content, include concrete formulas/code where available, and avoid invented facts. "
        f"Topic: {body.topic}\nTitle: {body.title}\nContent:\n{body.text[:5000]}"
    )
    if gemini:
        cards = parse_cards_from_text(gemini, body.topic)
        if cards:
            return {"cards": cards, "provider": "gemini"}
    return {"cards": fallback_card_dicts(body.title, body.topic, body.text), "provider": "fallback" if not settings.gemini_api_key else "gemini-ready-fallback"}


@router.post("/generate-email-preview")
async def generate_email_preview(body: TextIn, user: User = Depends(get_current_user)):
    gemini = await ask_gemini(
        f"Write a short CodeShelf daily coding revision reminder email for {user.name}. "
        "Keep it useful for a busy developer: one warm intro, 3 concrete revision tasks, 1 weak topic, "
        "1 formula/code recall prompt if relevant, and one CTA link. No hype, no long theory. "
        f"Topic context: {body.topic}. Notes: {body.text[:2500]}"
    )
    if gemini:
        return {"subject": f"{user.name}, today's coding revision is ready", "body": gemini, "provider": "gemini"}
    return {
        "subject": f"{user.name}, today's coding revision is ready",
        "body": f"Today you should revise:\n1. {body.topic}\n2. One weak problem\n3. One mistake\n\nStart here: {settings.frontend_url}/revision/today",
        "provider": "fallback",
    }


@router.post("/explain-for-walk-mode")
async def explain_for_walk_mode(body: TextIn, user: User = Depends(get_current_user)):
    gemini = await ask_gemini(
        "Explain this in a short audio-friendly way for someone walking. Keep it under 90 words. "
        "Use a memory hook, one concrete formula/code/invariant if relevant, and one recall question.\n"
        f"Title: {body.title}\nContent:\n{body.text[:3000]}"
    )
    if gemini:
        return {"explanation": gemini, "provider": "gemini"}
    return {"explanation": cheap_summary(body.text, 2), "provider": "fallback"}
