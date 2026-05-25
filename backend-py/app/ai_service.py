"""AI service layer – deep revision card generation via Gemini."""

from __future__ import annotations

import json
import re

from app.routes.ai import ask_gemini


CARD_TYPES = ["concept", "why", "complexity", "edge_case", "code_recall", "interview"]


def _build_revision_prompt(title: str, topic: str, content: str, subtopic: str = "") -> str:
    subject = f"{title} ({subtopic})" if subtopic else title
    return (
        "You are an expert coding-interview coach creating deep spaced-repetition revision cards.\n"
        f"Topic: {topic}\n"
        f"Title: {subject}\n"
        f"Content:\n{content[:5000]}\n\n"
        "Generate exactly 6 revision cards, one for each card_type below.\n"
        "Return ONLY valid JSON — no markdown fences, no preamble, no trailing text.\n"
        "Use this exact structure:\n"
        "{\n"
        '  "cards": [\n'
        '    {\n'
        f'      "card_type": "concept",\n'
        f'      "question": "Explain {subject} in simple terms as if teaching a junior developer",\n'
        '      "answer": "..."\n'
        '    },\n'
        '    {\n'
        f'      "card_type": "why",\n'
        f'      "question": "Why do we use {subject} over alternatives? What trade-offs does it involve?",\n'
        '      "answer": "..."\n'
        '    },\n'
        '    {\n'
        f'      "card_type": "complexity",\n'
        f'      "question": "What is the time and space complexity of {subject}, and why?",\n'
        '      "answer": "..."\n'
        '    },\n'
        '    {\n'
        f'      "card_type": "edge_case",\n'
        f'      "question": "What edge cases or common mistakes should you watch for with {subject}?",\n'
        '      "answer": "..."\n'
        '    },\n'
        '    {\n'
        f'      "card_type": "code_recall",\n'
        f'      "question": "Write the core code pattern for {subject} from memory",\n'
        '      "answer": "...(actual working code here)..."\n'
        '    },\n'
        '    {\n'
        f'      "card_type": "interview",\n'
        f'      "question": "How would you explain {subject} clearly in a technical interview?",\n'
        '      "answer": "..."\n'
        '    }\n'
        '  ]\n'
        "}\n\n"
        "Rules:\n"
        "- Answers must be detailed, accurate, and directly based on the provided content.\n"
        "- The code_recall card MUST include real, runnable code — not pseudocode.\n"
        "- Keep answers concise but complete (3-8 sentences for non-code cards).\n"
        "- Do NOT wrap output in ```json``` or any other markdown.\n"
    )


def _safe_parse_cards_json(raw: str) -> dict | None:
    """Parse Gemini's response into a cards dict, handling common formatting issues."""
    if not raw or not raw.strip():
        return None

    text = raw.strip()

    # Strip markdown fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text, flags=re.IGNORECASE)
    text = text.strip()

    # Find the JSON object boundaries
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None

    json_text = text[start : end + 1]

    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError:
        # Attempt minimal repair: trailing commas before ] or }
        repaired = re.sub(r",\s*([}\]])", r"\1", json_text)
        try:
            parsed = json.loads(repaired)
        except json.JSONDecodeError:
            return None

    if not isinstance(parsed, dict):
        return None

    cards = parsed.get("cards")
    if not isinstance(cards, list):
        return None

    # Validate each card
    valid_cards = []
    for card in cards:
        if not isinstance(card, dict):
            continue
        question = str(card.get("question", "")).strip()
        answer = str(card.get("answer", "")).strip()
        card_type = str(card.get("card_type", "recall")).strip()
        if question and answer:
            valid_cards.append(
                {
                    "card_type": card_type if card_type in CARD_TYPES else "concept",
                    "question": question,
                    "answer": answer,
                }
            )

    if not valid_cards:
        return None

    return {"cards": valid_cards}


async def generate_revision_cards(
    title: str, topic: str, content: str, subtopic: str = ""
) -> dict:
    """Generate 6 typed revision cards via Gemini.

    Returns:
        {"cards": [...], "provider": "gemini"} on success
        {"cards": [], "error": "...", "provider": "gemini-error"} on failure
    """
    prompt = _build_revision_prompt(title, topic, content, subtopic)

    try:
        raw_response = await ask_gemini(prompt)
    except Exception as exc:
        return {
            "cards": [],
            "error": f"Gemini API request failed: {exc}",
            "provider": "gemini-error",
        }

    if not raw_response:
        return {
            "cards": [],
            "error": "Gemini returned an empty response. Check your API key and quota.",
            "provider": "gemini-error",
        }

    parsed = _safe_parse_cards_json(raw_response)
    if parsed is None:
        return {
            "cards": [],
            "error": "Gemini returned malformed JSON. Please try again.",
            "provider": "gemini-error",
        }

    return {"cards": parsed["cards"], "provider": "gemini"}
