from __future__ import annotations

import html
import json
import random
from datetime import date, datetime, time, timedelta, timezone
from urllib.parse import urlencode
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import GEMINI_MODEL, get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import DailyActivity, EmailLog, EmailPreference, Mistake, ReviewLog, RevisionCard, User
from app.routes.utils import MIN_DAILY_CARDS, ensure_email_preferences, get_or_create_today_activity, next_interval, recalc_streak


router = APIRouter(prefix="/api/email", tags=["email"])
settings = get_settings()


class EmailPreferencesIn(BaseModel):
    enabled: bool = False
    email_time: str = "08:00"
    timezone: str = "Asia/Calcutta"
    emails_per_day: int = 1
    daily_card_count: int = 5
    include_dsa: bool = True
    include_sql: bool = True
    include_devops: bool = True
    include_mistakes: bool = True
    include_summary: bool = True
    include_streak_alert: bool = True
    reminder_style: str = "focused"
    subject_style: str = "personal"
    selected_topics: list[str] = []
    selected_note_ids: list[str] = []


class SessionReviewIn(BaseModel):
    token: str
    rating: str


def parse_time(value: str) -> time:
    hour, minute = [int(part) for part in value.split(":", 1)]
    return time(hour, minute)


def clamp_card_count(value: int) -> int:
    return max(3, min(10, int(value or 5)))


def clamp_email_count(value: int) -> int:
    return max(1, min(10, int(value or 1)))


def parse_json_list(value: str) -> list[str]:
    try:
        parsed = json.loads(value or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item).strip() for item in parsed if str(item).strip()]


def clean_list(values: list[str], limit: int = 40) -> list[str]:
    cleaned = []
    seen = set()
    for value in values:
        text = str(value).strip()
        key = text.lower()
        if text and key not in seen:
            cleaned.append(text)
            seen.add(key)
        if len(cleaned) >= limit:
            break
    return cleaned


def prefs_out(prefs: EmailPreference) -> dict:
    next_send = next_send_time(prefs)
    return {
        "enabled": prefs.enabled,
        "email_time": prefs.email_time.strftime("%H:%M"),
        "timezone": prefs.timezone,
        "emails_per_day": clamp_email_count(prefs.emails_per_day),
        "send_times": daily_send_labels(prefs),
        "next_send_at": next_send["iso"],
        "next_send_label": next_send["label"],
        "daily_card_count": prefs.daily_card_count,
        "include_dsa": prefs.include_dsa,
        "include_sql": prefs.include_sql,
        "include_devops": prefs.include_devops,
        "include_mistakes": prefs.include_mistakes,
        "include_summary": prefs.include_summary,
        "include_streak_alert": prefs.include_streak_alert,
        "reminder_style": prefs.reminder_style,
        "subject_style": prefs.subject_style,
        "selected_topics": parse_json_list(prefs.selected_topics_json),
        "selected_note_ids": parse_json_list(prefs.selected_note_ids_json),
    }


def cron_allowed(x_cron_secret: str | None) -> None:
    if settings.cron_secret and x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=401, detail="Invalid cron secret.")


def action_url(path: str, params: dict[str, str]) -> str:
    return f"{settings.backend_url.rstrip('/')}{path}?{urlencode(params)}"


def frontend_url(path: str, params: dict[str, str] | None = None) -> str:
    base = f"{settings.frontend_url.rstrip('/')}{path}"
    return f"{base}?{urlencode(params)}" if params else base


def create_email_token(payload: dict, hours: int = 24) -> str:
    now = datetime.now(timezone.utc)
    data = {
        **payload,
        "type": payload.get("type", "email_action"),
        "iat": now,
        "exp": now + timedelta(hours=hours),
    }
    return jwt.encode(data, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_email_token(token: str, expected_type: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload


async def ask_gemini(prompt: str) -> str:
    if not settings.gemini_api_key:
        return ""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                params={"key": settings.gemini_api_key},
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
        if not response.is_success:
            return ""
        data = response.json()
        return "\n".join(part.get("text", "") for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", []))
    except Exception:
        return ""


def short_text(value: str, limit: int = 130) -> str:
    text = " ".join((value or "").split())
    return text if len(text) <= limit else f"{text[: limit - 3].rstrip()}..."


def scoped_card_query(query, prefs: EmailPreference):
    selected_note_ids = parse_json_list(prefs.selected_note_ids_json)
    selected_topics = parse_json_list(prefs.selected_topics_json)
    if selected_note_ids:
        query = query.where(RevisionCard.note_id.in_(selected_note_ids))
    if selected_topics:
        query = query.where(RevisionCard.topic.in_(selected_topics))
    else:
        allowed_topics = []
        if prefs.include_dsa:
            allowed_topics.append("DSA")
        if prefs.include_sql:
            allowed_topics.append("SQL")
        if prefs.include_devops:
            allowed_topics.append("DevOps")
        if allowed_topics and len(allowed_topics) < 3:
            query = query.where(RevisionCard.topic.in_(allowed_topics))
    if not prefs.include_mistakes:
        query = query.where(RevisionCard.card_type != "mistake", RevisionCard.mistake_id.is_(None))
    return query


async def due_cards(db: AsyncSession, user: User, prefs: EmailPreference, limit: int) -> list[RevisionCard]:
    today = date.today()
    due_query = scoped_card_query(
        select(RevisionCard)
        .where(RevisionCard.user_id == user.id, RevisionCard.next_review_date <= today),
        prefs,
    )
    result = await db.execute(due_query.order_by(RevisionCard.next_review_date.asc(), RevisionCard.memory_strength.asc()).limit(limit))
    cards = result.scalars().all()
    if cards:
        return cards
    fallback_query = scoped_card_query(
        select(RevisionCard)
        .where(RevisionCard.user_id == user.id),
        prefs,
    )
    fallback = await db.execute(fallback_query.order_by(RevisionCard.updated_at.desc()).limit(limit))
    return fallback.scalars().all()


async def weak_topics(db: AsyncSession, user: User, prefs: EmailPreference | None = None, limit: int = 3) -> list[str]:
    query = (
        select(RevisionCard.topic, func.count(ReviewLog.id))
        .join(ReviewLog, ReviewLog.revision_card_id == RevisionCard.id)
        .where(RevisionCard.user_id == user.id, ReviewLog.rating.in_(["forgot", "again", "hard"]))
    )
    if prefs:
        query = scoped_card_query(query, prefs)
    result = await db.execute(query.group_by(RevisionCard.topic).order_by(func.count(ReviewLog.id).desc()).limit(limit))
    topics = [topic for topic, _count in result.all()]
    selected_topics = parse_json_list(prefs.selected_topics_json) if prefs else []
    return topics or selected_topics[:limit] or ["Selected notes"]


def option_set(card: RevisionCard) -> tuple[list[dict[str, str]], str]:
    correct_text = short_text(card.answer, 100) or "Review the saved answer"
    distractors = [
        "Only the brute-force approach",
        "It depends on unrelated input size",
        "No review is needed for this topic",
        "Use the same answer for every edge case",
        "Skip the invariant and test manually",
    ]
    options = [correct_text, *random.sample(distractors, 3)]
    random.shuffle(options)
    labels = ["A", "B", "C", "D"]
    rows = [{"label": label, "text": text} for label, text in zip(labels, options)]
    correct_label = next(row["label"] for row in rows if row["text"] == correct_text)
    return rows, correct_label


def build_card_blocks(cards: list[RevisionCard], limit: int = 5) -> list[dict]:
    blocks = []
    for index, card in enumerate(cards[:limit], 1):
        blocks.append(
            {
                "index": index,
                "id": card.id,
                "question": card.question,
                "answer": card.answer,
                "topic": card.topic,
                "remembered_url": action_url(
                    "/api/email/review",
                    {
                        "token": create_email_token(
                            {"sub": card.user_id, "card_id": card.id, "rating": "good", "type": "email_review"},
                            hours=24,
                        )
                    },
                ),
                "forgot_url": action_url(
                    "/api/email/review",
                    {
                        "token": create_email_token(
                            {"sub": card.user_id, "card_id": card.id, "rating": "forgot", "type": "email_review"},
                            hours=24,
                        )
                    },
                ),
                "review_token": create_email_token(
                    {"sub": card.user_id, "card_id": card.id, "type": "email_review_card"},
                    hours=24,
                ),
            }
        )
    return blocks


def streak_bar(days: int) -> str:
    filled = min(days, 14)
    return ("█" * filled) + ("░" * (14 - filled))


async def personalized_intro(user: User, topics: list[str], due_count: int, style: str = "focused") -> str:
    fallback = (
        f"Hey {user.name}, your revision queue has {due_count} card"
        f"{'' if due_count == 1 else 's'} today. Focus on {', '.join(topics[:2])} and keep the streak alive."
    )
    prompt = (
        f"Write one {style} CodeShelf daily revision intro for a busy developer. "
        "No markdown. Under 35 words. Make it specific, calm, and action-oriented. "
        "Mention due cards or weak topics, but do not sound spammy, salesy, or dramatic. "
        f"User: {user.name}. Current streak: {user.current_streak}. Due cards: {due_count}. Weak topics: {', '.join(topics)}."
    )
    return short_text(await ask_gemini(prompt), 220) or fallback


async def build_daily_email(db: AsyncSession, user: User) -> dict:
    prefs = await ensure_email_preferences(db, user)
    if not user.email_verified:
        return {}
    target_count = clamp_card_count(prefs.daily_card_count)
    cards = await due_cards(db, user, prefs, target_count)
    topics = await weak_topics(db, user, prefs)
    mistake_query = select(Mistake).where(Mistake.user_id == user.id)
    selected_topics = parse_json_list(prefs.selected_topics_json)
    selected_note_ids = parse_json_list(prefs.selected_note_ids_json)
    if selected_topics:
        mistake_query = mistake_query.where(Mistake.topic.in_(selected_topics))
    if selected_note_ids:
        mistake_query = mistake_query.where(Mistake.note_id.in_(selected_note_ids))
    mistake = (await db.execute(mistake_query.limit(1))).scalar_one_or_none()
    activity = await get_or_create_today_activity(db, user)
    card_blocks = build_card_blocks(cards, min(5, target_count))
    plan = [card.question for card in cards[:5]] or ["Add your first revision card", "Review one mistake", "Revise one coding pattern"]
    if mistake and len(plan) < 5:
        plan.append(f"Review mistake: {mistake.mistake_title}")
    intro = await personalized_intro(user, topics, len(cards), prefs.reminder_style)
    subject = (
        f"{user.name}, protect your {user.current_streak}-day CodeShelf streak"
        if prefs.subject_style == "streak"
        else f"{user.name}, today's CodeShelf revision is ready"
    )
    unsubscribe = action_url(
        "/api/email/unsubscribe",
        {"token": create_email_token({"sub": user.id, "type": "email_unsubscribe"}, hours=24 * 30)},
    )
    session_url = action_url(
        "/api/email/session",
        {
            "token": create_email_token(
                {"sub": user.id, "card_ids": [card.id for card in cards[: min(5, target_count)]], "type": "email_session"},
                hours=24,
            )
        },
    )
    context = {
        "email_type": "daily_revision",
        "subject": subject,
        "intro": intro,
        "user": user,
        "cards": card_blocks,
        "plan": plan,
        "weak_topics": topics,
        "include_summary": prefs.include_summary,
        "activity": activity,
        "streak_bar": streak_bar(user.current_streak or 0),
        "open_url": frontend_url("/revision/today", {"from": "email"}),
        "session_url": session_url,
        "preferences_url": frontend_url("/email-settings"),
        "unsubscribe_url": unsubscribe,
        "card_ids": [card.id for card in cards[: min(5, target_count)]],
    }
    return {**context, "html": render_daily_html(context), "text": render_daily_text(context)}


def pref_zone(prefs: EmailPreference):
    try:
        return ZoneInfo(prefs.timezone)
    except ZoneInfoNotFoundError:
        return timezone.utc


def daily_send_slots(prefs: EmailPreference, local_day: date) -> list[datetime]:
    zone = pref_zone(prefs)
    first_slot = datetime.combine(local_day, prefs.email_time, tzinfo=zone)
    return [first_slot + timedelta(hours=index) for index in range(clamp_email_count(prefs.emails_per_day))]


def daily_send_labels(prefs: EmailPreference) -> list[str]:
    zone = pref_zone(prefs)
    today_local = datetime.now(timezone.utc).astimezone(zone).date()
    return [slot.strftime("%H:%M") for slot in daily_send_slots(prefs, today_local)]


def next_send_time(prefs: EmailPreference) -> dict[str, str]:
    zone = pref_zone(prefs)
    now_local = datetime.now(timezone.utc).astimezone(zone)
    slots = daily_send_slots(prefs, now_local.date()) + daily_send_slots(prefs, now_local.date() + timedelta(days=1))
    target = next((slot for slot in slots if slot > now_local), slots[-1])
    return {
        "iso": target.isoformat(),
        "label": target.strftime("%a, %d %b at %I:%M %p %Z").replace(" 0", " "),
    }


def current_daily_slot(prefs: EmailPreference, now_utc: datetime | None = None, window_minutes: int = 75) -> datetime | None:
    zone = pref_zone(prefs)
    local_now = (now_utc or datetime.now(timezone.utc)).astimezone(zone)
    slots = daily_send_slots(prefs, local_now.date() - timedelta(days=1)) + daily_send_slots(prefs, local_now.date())
    eligible = []
    for slot in slots:
        minutes_after_slot = (local_now - slot).total_seconds() / 60
        if 0 <= minutes_after_slot < window_minutes:
            eligible.append(slot)
    return eligible[-1] if eligible else None


def daily_window_open(prefs: EmailPreference, now_utc: datetime | None = None, window_minutes: int = 75) -> bool:
    return current_daily_slot(prefs, now_utc, window_minutes) is not None


def local_day_bounds_utc(prefs: EmailPreference, now_utc: datetime | None = None) -> tuple[datetime, datetime]:
    zone = pref_zone(prefs)
    local_now = (now_utc or datetime.now(timezone.utc)).astimezone(zone)
    local_start = datetime.combine(local_now.date(), time.min, tzinfo=zone)
    local_end = local_start + timedelta(days=1)
    return local_start.astimezone(timezone.utc), local_end.astimezone(timezone.utc)


async def build_weekly_digest(db: AsyncSession, user: User) -> dict:
    if not user.email_verified:
        return {}
    since = date.today() - timedelta(days=7)
    rows = (
        await db.execute(
            select(DailyActivity)
            .where(DailyActivity.user_id == user.id, DailyActivity.date >= since)
            .order_by(DailyActivity.date.desc())
        )
    ).scalars().all()
    cards_reviewed = sum(item.cards_reviewed for item in rows)
    mistakes_fixed = sum(item.mistakes_fixed for item in rows)
    prefs = await ensure_email_preferences(db, user)
    topics = await weak_topics(db, user, prefs)
    subject = f"{user.name}, your CodeShelf weekly digest"
    text = (
        f"This week you reviewed {cards_reviewed} cards and fixed {mistakes_fixed} mistakes.\n"
        f"Current streak: {user.current_streak} days.\n"
        f"Next focus: {', '.join(topics)}.\n\nOpen CodeShelf: {frontend_url('/revision/today')}"
    )
    html_body = render_simple_html(
        "Weekly Digest",
        subject,
        [
            f"Cards reviewed: {cards_reviewed}",
            f"Mistakes fixed: {mistakes_fixed}",
            f"Current streak: {user.current_streak} days",
            f"Next focus: {', '.join(topics)}",
        ],
        frontend_url("/revision/today", {"from": "weekly-email"}),
    )
    return {"email_type": "weekly_digest", "subject": subject, "html": html_body, "text": text, "card_ids": []}


async def build_streak_alert(db: AsyncSession, user: User) -> dict | None:
    prefs = await ensure_email_preferences(db, user)
    if not user.email_verified or not prefs.include_streak_alert:
        return None
    activity = await get_or_create_today_activity(db, user)
    if activity.completed_today or activity.cards_reviewed > 0 or user.current_streak <= 0:
        return None
    subject = f"{user.name}, your {user.current_streak}-day streak needs one revision"
    text = f"Your CodeShelf streak can continue with a quick revision today.\n\nOpen CodeShelf: {frontend_url('/revision/today')}"
    html_body = render_simple_html(
        "Streak Alert",
        subject,
        [f"Current streak: {user.current_streak} days", "Finish a quick revision to keep it going."],
        frontend_url("/revision/today", {"from": "streak-email"}),
    )
    return {"email_type": "streak_alert", "subject": subject, "html": html_body, "text": text, "card_ids": []}


def render_daily_text(ctx: dict) -> str:
    card_count = len(ctx["cards"])
    lines = [
        "CodeShelf - Daily Revision",
        "",
        f"{ctx['user'].name}, are you ready for the battle?",
        f"{card_count} questions are waiting. Start the sprint and record all answers on one page.",
        "",
        f"Streak: {ctx['user'].current_streak} days",
        f"Today: {ctx['activity'].cards_reviewed}/{MIN_DAILY_CARDS} reviews done. Your streak completes at {MIN_DAILY_CARDS}.",
        f"Weak topics: {', '.join(ctx['weak_topics'])}",
        "",
        f"Start sprint: {ctx['session_url']}",
        "",
        "Questions in this sprint:",
    ]
    for card in ctx["cards"]:
        lines.append(f"Q{card['index']}: {card['question']}")
    lines.extend(["Today's revision plan:", *[f"{idx}. {item}" for idx, item in enumerate(ctx["plan"], 1)], "", ctx["open_url"]])
    return "\n".join(lines)


def render_daily_html(ctx: dict) -> str:
    card_count = len(ctx["cards"])
    card_html = ""
    for card in ctx["cards"]:
        card_html += f"""
        <tr>
          <td style="padding:14px 0;border-top:1px solid #edf0f5;">
            <p style="margin:0 0 5px;color:#647084;font-size:13px;">Question {card['index']} · {html.escape(card['topic'])}</p>
            <h3 style="margin:0;color:#172033;font-size:17px;line-height:1.38;">{html.escape(card['question'])}</h3>
          </td>
        </tr>
        """
    plan_items = "".join(f"<li style=\"margin:7px 0;\">{html.escape(item)}</li>" for item in ctx["plan"])
    return f"""
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4e8f0;">
                <tr><td style="padding:26px 28px;background:#172033;color:#ffffff;"><h1 style="margin:0;font-size:24px;">CodeShelf Daily Revision</h1><p style="margin:8px 0 0;color:#cbd5e1;">Never forget what you learned.</p></td></tr>
                <tr><td style="padding:26px 28px;">
                  <p style="margin:0 0 8px;color:#647084;font-size:13px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;">Revision Sprint</p>
                  <h2 style="margin:0 0 10px;font-size:26px;line-height:1.2;color:#172033;">{html.escape(ctx['user'].name)}, are you ready for the battle?</h2>
                  <p style="margin:0 0 18px;font-size:17px;line-height:1.55;">{card_count} question{'' if card_count == 1 else 's'} are waiting. Tap once, answer everything on one page, and CodeShelf records your progress live.</p>
                  <div style="padding:16px;border-radius:12px;background:#f7f9fc;border:1px solid #e7ebf2;">
                    <p style="margin:0 0 6px;"><strong>Streak:</strong> {html.escape(ctx['streak_bar'])} {ctx['user'].current_streak} days</p>
                    <p style="margin:0 0 6px;"><strong>Today:</strong> {ctx['activity'].cards_reviewed}/{MIN_DAILY_CARDS} reviews done · streak completes at {MIN_DAILY_CARDS}</p>
                    <p style="margin:0;"><strong>Weak:</strong> {html.escape(', '.join(ctx['weak_topics']))}</p>
                  </div>
                  <a href="{html.escape(ctx['session_url'])}" style="display:block;margin:20px 0 6px;padding:15px 18px;background:#2563eb;color:#ffffff;text-align:center;text-decoration:none;border-radius:12px;font-weight:bold;font-size:16px;">Start {card_count}-Question Battle</a>
                  <p style="margin:0 0 12px;color:#647084;font-size:13px;text-align:center;">Works on desktop and mobile.</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">{card_html}</table>
                  <h2 style="font-size:18px;margin:22px 0 8px;">Today's revision plan</h2>
                  <ol style="padding-left:22px;margin:0 0 22px;">{plan_items}</ol>
                  <a href="{html.escape(ctx['open_url'])}" style="display:inline-block;padding:13px 18px;background:#172033;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;">Open Full CodeShelf</a>
                </td></tr>
                <tr><td style="padding:18px 28px;background:#f7f9fc;color:#647084;font-size:13px;">
                  CodeShelf · <a href="{html.escape(ctx['preferences_url'])}" style="color:#2563eb;">Email preferences</a> · <a href="{html.escape(ctx['unsubscribe_url'])}" style="color:#2563eb;">Unsubscribe</a>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """


def render_simple_html(label: str, subject: str, facts: list[str], cta_url: str) -> str:
    facts_html = "".join(f"<li style=\"margin:8px 0;\">{html.escape(fact)}</li>" for fact in facts)
    return f"""
    <!doctype html>
    <html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;"><tr><td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #e4e8f0;border-radius:14px;">
          <tr><td style="padding:24px 28px;background:#172033;color:#ffffff;border-radius:14px 14px 0 0;"><p style="margin:0;color:#cbd5e1;">CodeShelf</p><h1 style="margin:6px 0 0;font-size:24px;">{html.escape(label)}</h1></td></tr>
          <tr><td style="padding:24px 28px;"><h2 style="margin:0 0 14px;font-size:20px;">{html.escape(subject)}</h2><ul style="padding-left:22px;">{facts_html}</ul><a href="{html.escape(cta_url)}" style="display:inline-block;margin-top:14px;padding:13px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;">Open CodeShelf</a></td></tr>
        </table>
      </td></tr></table>
    </body></html>
    """


def render_email_action_html(title: str, message: str, rating: str = "", result: str = "saved") -> str:
    color = "#16a34a" if result in {"saved", "correct"} else "#dc2626"
    safe_rating = html.escape(rating)
    return f"""
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{html.escape(title)}</title>
      </head>
      <body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <main style="min-height:100vh;display:grid;place-items:center;padding:24px;">
          <section style="max-width:520px;width:100%;background:#ffffff;border:1px solid #e4e8f0;border-radius:16px;overflow:hidden;box-shadow:0 18px 60px rgba(15,23,42,.12);">
            <div style="background:#172033;color:#ffffff;padding:22px 24px;">
              <p style="margin:0 0 6px;color:#cbd5e1;font-size:13px;">CodeShelf Email Action</p>
              <h1 style="margin:0;font-size:24px;">{html.escape(title)}</h1>
            </div>
            <div style="padding:24px;">
              <div style="width:48px;height:48px;border-radius:50%;background:{color};color:#ffffff;display:grid;place-items:center;font-size:24px;font-weight:bold;">✓</div>
              <p style="font-size:17px;line-height:1.55;margin:18px 0 8px;">{html.escape(message)}</p>
              {f'<p style="margin:0 0 18px;color:#647084;">Rating saved: <strong>{safe_rating}</strong></p>' if rating else ''}
              <a href="{html.escape(frontend_url('/revision/today', {'from': 'email-action'}))}" style="display:inline-block;padding:12px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;">Open Today Revision</a>
            </div>
          </section>
        </main>
      </body>
    </html>
    """


def render_email_session_html(user: User, cards: list[RevisionCard]) -> str:
    sprint_cards = [
        {
            "id": card.id,
            "question": card.question,
            "answer": card.answer,
            "topic": card.topic,
            "difficulty": card.difficulty,
            "token": create_email_token(
                {"sub": user.id, "card_id": card.id, "type": "email_review_card"},
                hours=24,
            ),
        }
        for card in cards
    ]
    data = json.dumps(sprint_cards).replace("</", "<\\/")
    return f"""
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>CodeShelf Battle Sprint</title>
        <style>
          * {{ box-sizing: border-box; }}
          body {{ margin: 0; min-height: 100vh; background: #f4f6fb; color: #172033; font-family: Arial, Helvetica, sans-serif; }}
          main {{ min-height: 100vh; display: grid; place-items: center; padding: 18px; }}
          .shell {{ width: min(720px, 100%); background: #fff; border: 1px solid #e4e8f0; border-radius: 18px; overflow: hidden; box-shadow: 0 22px 70px rgba(15, 23, 42, .14); }}
          .hero {{ padding: 28px; background: #172033; color: #fff; }}
          .hero p {{ margin: 0 0 8px; color: #cbd5e1; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }}
          .hero h1 {{ margin: 0; font-size: clamp(26px, 6vw, 42px); line-height: 1.08; }}
          .hero span {{ color: #93c5fd; }}
          .body {{ padding: 24px; }}
          .intro {{ color: #475569; font-size: 17px; line-height: 1.55; margin: 0 0 18px; }}
          .battle-btn, .rate button, .open-app {{ border: 0; border-radius: 12px; padding: 13px 16px; font-weight: 800; font-size: 15px; cursor: pointer; }}
          .battle-btn {{ width: 100%; background: #2563eb; color: white; font-size: 17px; }}
          .card {{ display: none; margin-top: 18px; padding: 18px; border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; }}
          .card.active {{ display: block; }}
          .meta {{ margin: 0 0 8px; color: #64748b; font-size: 13px; font-weight: 700; }}
          h2 {{ margin: 0 0 14px; font-size: clamp(22px, 5vw, 30px); line-height: 1.25; }}
          .answer {{ display: none; margin: 14px 0; padding: 14px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; white-space: pre-wrap; }}
          .answer.show {{ display: block; }}
          .rate {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }}
          .show {{ background: #172033; color: white; }}
          .forgot {{ background: #dc2626; color: white; }}
          .remembered {{ background: #16a34a; color: white; }}
          .status {{ margin: 14px 0 0; min-height: 24px; color: #475569; font-weight: 700; }}
          .progress {{ height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin: 18px 0 0; }}
          .bar {{ height: 100%; width: 0%; background: #2563eb; transition: width .25s ease; }}
          .done {{ display: none; text-align: center; padding: 22px 0 4px; }}
          .done h2 {{ color: #16a34a; }}
          .open-app {{ display: inline-block; margin-top: 10px; background: #172033; color: #fff; text-decoration: none; }}
          @media (max-width: 520px) {{ .hero, .body {{ padding: 20px; }} .rate {{ grid-template-columns: 1fr; }} }}
        </style>
      </head>
      <body>
        <main>
          <section class="shell">
            <div class="hero">
              <p>CodeShelf Battle Sprint</p>
              <h1>{html.escape(user.name)}, are you ready for the <span>battle?</span></h1>
            </div>
            <div class="body">
              <p class="intro">{len(cards)} questions. One page. No repeated email redirects. Tap a rating and your CodeShelf progress updates live.</p>
              <button class="battle-btn" id="start">I am ready. Go on.</button>
              <div class="progress"><div class="bar" id="bar"></div></div>
              <div id="cards"></div>
              <div class="done" id="done">
                <h2>Battle complete.</h2>
                <p class="intro">Your responses were recorded in CodeShelf.</p>
                <a class="open-app" href="{html.escape(frontend_url('/revision/today', {'from': 'email-session'}))}">Open Today Revision</a>
              </div>
            </div>
          </section>
        </main>
        <script>
          const cards = {data};
          const root = document.getElementById('cards');
          const done = document.getElementById('done');
          const bar = document.getElementById('bar');
          let index = 0;
          let completed = 0;
          root.innerHTML = cards.map((card, i) => `
            <article class="card" data-index="${{i}}">
              <p class="meta">Question ${{i + 1}} / ${{cards.length}} · ${{escapeHtml(card.topic || 'General')}} · ${{escapeHtml(card.difficulty || 'Medium')}}</p>
              <h2>${{escapeHtml(card.question)}}</h2>
              <button class="battle-btn show" type="button" data-show="${{i}}">Show answer</button>
              <div class="answer" id="answer-${{i}}">${{escapeHtml(card.answer)}}</div>
              <div class="rate">
                <button class="forgot" type="button" data-rate="${{i}}" data-rating="forgot">I forgot</button>
                <button class="remembered" type="button" data-rate="${{i}}" data-rating="good">I remembered</button>
              </div>
              <p class="status" id="status-${{i}}"></p>
            </article>
          `).join('');
          function escapeHtml(value) {{
            return String(value || '').replace(/[&<>"']/g, ch => ({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'": '&#039;'}}[ch]));
          }}
          function showCard(i) {{
            document.querySelectorAll('.card').forEach(card => card.classList.remove('active'));
            const next = document.querySelector(`[data-index="${{i}}"]`);
            if (next) next.classList.add('active');
          }}
          function updateProgress() {{
            bar.style.width = `${{cards.length ? Math.round((completed / cards.length) * 100) : 100}}%`;
          }}
          document.getElementById('start').addEventListener('click', () => {{
            document.getElementById('start').style.display = 'none';
            showCard(0);
          }});
          root.addEventListener('click', async (event) => {{
            const show = event.target.closest('[data-show]');
            if (show) {{
              document.getElementById(`answer-${{show.dataset.show}}`).classList.add('show');
              return;
            }}
            const button = event.target.closest('[data-rate]');
            if (!button || button.disabled) return;
            const i = Number(button.dataset.rate);
            const card = cards[i];
            const status = document.getElementById(`status-${{i}}`);
            button.closest('.rate').querySelectorAll('button').forEach(item => item.disabled = true);
            status.textContent = 'Saving...';
            try {{
              const response = await fetch('/api/email/session-review', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{ token: card.token, rating: button.dataset.rating }})
              }});
              if (!response.ok) throw new Error('Could not save this answer.');
              completed += 1;
              updateProgress();
              status.textContent = 'Saved to CodeShelf.';
              setTimeout(() => {{
                index += 1;
                if (index >= cards.length) {{
                  document.querySelectorAll('.card').forEach(card => card.classList.remove('active'));
                  done.style.display = 'block';
                }} else {{
                  showCard(index);
                }}
              }}, 450);
            }} catch (error) {{
              status.textContent = error.message || 'Save failed. Try again.';
              button.closest('.rate').querySelectorAll('button').forEach(item => item.disabled = false);
            }}
          }});
          updateProgress();
        </script>
      </body>
    </html>
    """


async def send_email(db: AsyncSession, user: User, payload: dict) -> dict:
    status = "printed"
    error_message = ""
    message_id = ""
    if settings.resend_api_key:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
                    json={
                        "from": settings.resend_from_email,
                        "to": [user.email],
                        "subject": payload["subject"],
                        "html": payload["html"],
                        "text": payload["text"],
                    },
                )
            status = "sent" if response.is_success else "failed"
            data = response.json() if response.content else {}
            message_id = data.get("id", "") if isinstance(data, dict) else ""
            if not response.is_success:
                error_message = response.text[:1000]
        except Exception as exc:
            status = "failed"
            error_message = str(exc)
    else:
        if settings.environment.lower() == "production":
            status = "failed"
            error_message = "RESEND_API_KEY is not configured; email was not sent."
        else:
            print(f"\n--- CodeShelf email preview to {user.email} ---\nSubject: {payload['subject']}\n{payload['text']}\n")

    db.add(
        EmailLog(
            user_id=user.id,
            email_type=payload["email_type"],
            recipient=user.email,
            subject=payload["subject"],
            body="",
            card_ids=",".join(str(card_id) for card_id in payload.get("card_ids", [])),
            provider_message_id=message_id,
            status=status,
            error_message=error_message,
        )
    )
    await db.flush()
    return {"subject": payload["subject"], "body": payload["text"], "html": payload["html"], "status": status, "error_message": error_message}


async def send_to_enabled_users(db: AsyncSession, builder) -> dict:
    result = await db.execute(select(User).join(EmailPreference).where(EmailPreference.enabled.is_(True)))
    users = result.scalars().all()
    sent = 0
    skipped = 0
    failed = 0
    skipped_outside_window = 0
    skipped_duplicate = 0
    skipped_empty_payload = 0
    failed_details = []
    for user in users:
        prefs = await ensure_email_preferences(db, user)
        daily_slot = None
        if builder.__name__ == "build_daily_email":
            daily_slot = current_daily_slot(prefs)
            if not daily_slot:
                skipped += 1
                skipped_outside_window += 1
                continue
        payload = await builder(db, user)
        if not payload:
            skipped += 1
            skipped_empty_payload += 1
            continue
        if daily_slot:
            day_start = daily_slot.astimezone(timezone.utc)
            day_end = (daily_slot + timedelta(minutes=75)).astimezone(timezone.utc)
        else:
            day_start, day_end = local_day_bounds_utc(prefs)
        duplicate = (
            await db.execute(
                select(EmailLog.id)
                .where(
                    EmailLog.user_id == user.id,
                    EmailLog.email_type == payload["email_type"],
                    EmailLog.sent_at >= day_start,
                    EmailLog.sent_at < day_end,
                    EmailLog.status.in_(["sent", "printed"]),
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if duplicate:
            skipped += 1
            skipped_duplicate += 1
            continue
        outcome = await send_email(db, user, payload)
        sent += 1 if outcome["status"] in {"sent", "printed"} else 0
        if outcome["status"] == "failed":
            failed += 1
            failed_details.append({"user_id": user.id, "email": user.email, "error": outcome.get("error_message", "")[:300]})
    return {
        "users": len(users),
        "sent": sent,
        "skipped": skipped,
        "failed": failed,
        "skipped_outside_window": skipped_outside_window,
        "skipped_duplicate": skipped_duplicate,
        "skipped_empty_payload": skipped_empty_payload,
        "failed_details": failed_details[:10],
    }


async def apply_email_review(db: AsyncSession, user_id: str, card_id: str, rating: str) -> bool:
    result = await db.execute(select(RevisionCard).where(RevisionCard.id == card_id, RevisionCard.user_id == user_id))
    card = result.scalar_one_or_none()
    if not card:
        return False
    old_interval = card.interval_days
    interval, memory_delta = next_interval(rating, old_interval)
    card.interval_days = interval
    card.memory_strength = max(0.0, min(1.0, card.memory_strength + memory_delta))
    card.last_reviewed_at = datetime.now(timezone.utc)
    card.next_review_date = date.today() + timedelta(days=interval)
    card.review_status = "reviewed_from_email"
    db.add(ReviewLog(user_id=user_id, revision_card_id=card.id, rating=rating, old_interval=old_interval, new_interval=interval))
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one()
    activity = await get_or_create_today_activity(db, user)
    activity.cards_reviewed += 1
    if card.problem_id:
        activity.problems_revised += 1
    if card.note_id:
        activity.notes_revised += 1
    if card.mistake_id or card.card_type == "mistake":
        activity.mistakes_fixed += 1
    activity.completed_today = activity.cards_reviewed >= MIN_DAILY_CARDS
    await recalc_streak(db, user)
    await db.flush()
    return True


@router.get("/preferences")
async def get_preferences(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    prefs = await ensure_email_preferences(db, user)
    return {"preferences": prefs_out(prefs)}


@router.put("/preferences")
async def update_preferences(body: EmailPreferencesIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if body.enabled and not user.email_verified:
        raise HTTPException(status_code=403, detail="Verify your email before enabling reminders.")
    prefs = await ensure_email_preferences(db, user)
    prefs.enabled = body.enabled
    prefs.email_time = parse_time(body.email_time)
    prefs.timezone = body.timezone
    prefs.emails_per_day = clamp_email_count(body.emails_per_day)
    prefs.daily_card_count = clamp_card_count(body.daily_card_count)
    prefs.include_dsa = body.include_dsa
    prefs.include_sql = body.include_sql
    prefs.include_devops = body.include_devops
    prefs.include_mistakes = body.include_mistakes
    prefs.include_summary = body.include_summary
    prefs.include_streak_alert = body.include_streak_alert
    prefs.reminder_style = body.reminder_style
    prefs.subject_style = body.subject_style
    prefs.selected_topics_json = json.dumps(clean_list(body.selected_topics))
    prefs.selected_note_ids_json = json.dumps(clean_list(body.selected_note_ids, limit=100))
    await db.flush()
    return {"preferences": prefs_out(prefs)}


@router.post("/preview")
async def preview_email(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Verify your email before generating reminder previews.")
    payload = await build_daily_email(db, user)
    return {"subject": payload["subject"], "body": payload["text"], "html": payload["html"]}


@router.post("/send-test")
async def send_test(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Verify your email before sending test reminders.")
    payload = await build_daily_email(db, user)
    if not payload:
        raise HTTPException(status_code=400, detail="No email payload could be built for this user.")
    payload["email_type"] = "test_daily_revision"
    payload["subject"] = f"[Test] {payload['subject']}"
    return await send_email(db, user, payload)


@router.post("/send-daily")
async def send_daily(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Verify your email before sending reminders.")
    payload = await build_daily_email(db, user)
    if not payload:
        raise HTTPException(status_code=400, detail="No email payload could be built for this user.")
    return await send_email(db, user, payload)


@router.post("/cron-daily")
async def cron_daily(x_cron_secret: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    cron_allowed(x_cron_secret)
    return await send_to_enabled_users(db, build_daily_email)


@router.post("/cron-weekly")
async def cron_weekly(x_cron_secret: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    cron_allowed(x_cron_secret)
    return await send_to_enabled_users(db, build_weekly_digest)


@router.post("/cron-streak-alert")
async def cron_streak_alert(x_cron_secret: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    cron_allowed(x_cron_secret)
    return await send_to_enabled_users(db, build_streak_alert)


@router.post("/cron-cleanup")
async def cron_cleanup(x_cron_secret: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    cron_allowed(x_cron_secret)
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    result = await db.execute(delete(EmailLog).where(EmailLog.sent_at < cutoff))
    return {"deleted_email_logs": result.rowcount or 0, "older_than_days": 90}


@router.get("/session")
async def email_session(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    payload = decode_email_token(token, "email_session")
    if not payload:
        return HTMLResponse(render_email_action_html("Link expired", "This email sprint link is invalid or expired.", result="invalid"), status_code=400)
    user_id = str(payload.get("sub") or "")
    card_ids = [str(card_id) for card_id in payload.get("card_ids", []) if card_id]
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user or not card_ids:
        return HTMLResponse(render_email_action_html("Sprint unavailable", "No cards were found for this sprint.", result="missing"), status_code=404)
    rows = (
        await db.execute(
            select(RevisionCard).where(RevisionCard.user_id == user.id, RevisionCard.id.in_(card_ids))
        )
    ).scalars().all()
    by_id = {card.id: card for card in rows}
    cards = [by_id[card_id] for card_id in card_ids if card_id in by_id]
    if not cards:
        return HTMLResponse(render_email_action_html("Sprint unavailable", "No cards were found for this sprint.", result="missing"), status_code=404)
    return HTMLResponse(render_email_session_html(user, cards))


@router.post("/session-review")
async def review_from_email_session(body: SessionReviewIn, db: AsyncSession = Depends(get_db)):
    payload = decode_email_token(body.token, "email_review_card")
    if not payload:
        raise HTTPException(status_code=400, detail="This review link is invalid or expired.")
    rating = body.rating.lower()
    if rating not in {"forgot", "hard", "good", "easy"}:
        raise HTTPException(status_code=400, detail="Invalid rating.")
    saved = await apply_email_review(db, str(payload["sub"]), str(payload["card_id"]), rating)
    if not saved:
        raise HTTPException(status_code=404, detail="Card not found.")
    return {"ok": True, "rating": rating}


@router.get("/answer")
async def answer_from_email(token: str = Query(...), selected: str = Query(...), db: AsyncSession = Depends(get_db)):
    payload = decode_email_token(token, "email_answer")
    if not payload:
        return HTMLResponse(render_email_action_html("Link expired", "This email action link is invalid or expired.", result="invalid"), status_code=400)
    selected_label = selected.strip().upper()
    correct = selected_label == str(payload.get("correct_label", "")).upper()
    saved = await apply_email_review(db, str(payload["sub"]), str(payload["card_id"]), "good" if correct else "hard")
    result = "correct" if correct else "wrong"
    if not saved:
        result = "missing"
    message = "Your answer was saved to CodeShelf." if saved else "This card was not found, so nothing changed."
    return HTMLResponse(render_email_action_html("Answer recorded", message, "good" if correct else "hard", result=result))


@router.get("/review")
async def review_from_email(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    payload = decode_email_token(token, "email_review")
    if not payload:
        return HTMLResponse(render_email_action_html("Link expired", "This email action link is invalid or expired.", result="invalid"), status_code=400)
    rating = str(payload.get("rating", "good")).lower()
    if rating not in {"forgot", "hard", "good", "easy"}:
        rating = "good"
    saved = await apply_email_review(db, str(payload["sub"]), str(payload["card_id"]), rating)
    message = "Your review was saved to CodeShelf." if saved else "This card was not found, so nothing changed."
    return HTMLResponse(render_email_action_html("Review recorded", message, rating, result="saved" if saved else "missing"))


@router.get("/unsubscribe")
async def unsubscribe(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    payload = decode_email_token(token, "email_unsubscribe")
    if not payload:
        return RedirectResponse(frontend_url("/email-settings", {"status": "invalid-unsubscribe"}), status_code=302)
    user = (await db.execute(select(User).where(User.id == str(payload["sub"])))).scalar_one_or_none()
    if user:
        prefs = await ensure_email_preferences(db, user)
        prefs.enabled = False
        await db.flush()
    return RedirectResponse(frontend_url("/email-settings", {"status": "unsubscribed"}), status_code=302)
