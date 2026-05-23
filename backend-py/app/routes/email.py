from __future__ import annotations

import html
import random
from datetime import date, datetime, time, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import func, select
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
    daily_card_count: int = 5
    include_dsa: bool = True
    include_sql: bool = True
    include_devops: bool = True
    include_mistakes: bool = True


def parse_time(value: str) -> time:
    hour, minute = [int(part) for part in value.split(":", 1)]
    return time(hour, minute)


def prefs_out(prefs: EmailPreference) -> dict:
    return {
        "enabled": prefs.enabled,
        "email_time": prefs.email_time.strftime("%H:%M"),
        "timezone": prefs.timezone,
        "daily_card_count": prefs.daily_card_count,
        "include_dsa": prefs.include_dsa,
        "include_sql": prefs.include_sql,
        "include_devops": prefs.include_devops,
        "include_mistakes": prefs.include_mistakes,
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


async def due_cards(db: AsyncSession, user: User, limit: int) -> list[RevisionCard]:
    today = date.today()
    result = await db.execute(
        select(RevisionCard)
        .where(RevisionCard.user_id == user.id, RevisionCard.next_review_date <= today)
        .order_by(RevisionCard.next_review_date.asc(), RevisionCard.memory_strength.asc())
        .limit(limit)
    )
    cards = result.scalars().all()
    if cards:
        return cards
    fallback = await db.execute(
        select(RevisionCard)
        .where(RevisionCard.user_id == user.id)
        .order_by(RevisionCard.updated_at.desc())
        .limit(limit)
    )
    return fallback.scalars().all()


async def weak_topics(db: AsyncSession, user: User, limit: int = 3) -> list[str]:
    result = await db.execute(
        select(RevisionCard.topic, func.count(ReviewLog.id))
        .join(ReviewLog, ReviewLog.revision_card_id == RevisionCard.id)
        .where(RevisionCard.user_id == user.id, ReviewLog.rating.in_(["forgot", "again", "hard"]))
        .group_by(RevisionCard.topic)
        .order_by(func.count(ReviewLog.id).desc())
        .limit(limit)
    )
    topics = [topic for topic, _count in result.all()]
    return topics or ["DSA patterns"]


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


def build_card_blocks(cards: list[RevisionCard]) -> list[dict]:
    blocks = []
    for index, card in enumerate(cards[:3], 1):
        options, correct_label = option_set(card)
        token = create_email_token(
            {"sub": card.user_id, "card_id": card.id, "correct_label": correct_label, "type": "email_answer"},
            hours=24,
        )
        blocks.append(
            {
                "index": index,
                "id": card.id,
                "question": card.question,
                "topic": card.topic,
                "options": [
                    {
                        **option,
                        "url": action_url("/api/email/answer", {"token": token, "selected": option["label"]}),
                    }
                    for option in options
                ],
            }
        )
    return blocks


def streak_bar(days: int) -> str:
    filled = min(days, 14)
    return ("█" * filled) + ("░" * (14 - filled))


async def personalized_intro(user: User, topics: list[str], due_count: int) -> str:
    fallback = (
        f"Hey {user.name}, your revision queue has {due_count} card"
        f"{'' if due_count == 1 else 's'} today. Focus on {', '.join(topics[:2])} and keep the streak alive."
    )
    prompt = (
        "Write one warm, concise CodeShelf daily revision intro. "
        "No markdown. Under 35 words. "
        f"User: {user.name}. Current streak: {user.current_streak}. Due cards: {due_count}. Weak topics: {', '.join(topics)}."
    )
    return short_text(await ask_gemini(prompt), 220) or fallback


async def build_daily_email(db: AsyncSession, user: User) -> dict:
    prefs = await ensure_email_preferences(db, user)
    cards = await due_cards(db, user, max(3, prefs.daily_card_count))
    topics = await weak_topics(db, user)
    mistake = (await db.execute(select(Mistake).where(Mistake.user_id == user.id).limit(1))).scalar_one_or_none()
    activity = await get_or_create_today_activity(db, user)
    card_blocks = build_card_blocks(cards)
    plan = [card.question for card in cards[:5]] or ["Add your first revision card", "Review one mistake", "Revise one coding pattern"]
    if mistake and len(plan) < 5:
        plan.append(f"Review mistake: {mistake.mistake_title}")
    intro = await personalized_intro(user, topics, len(cards))
    subject = f"{user.name}, today's CodeShelf revision is ready"
    unsubscribe = action_url(
        "/api/email/unsubscribe",
        {"token": create_email_token({"sub": user.id, "type": "email_unsubscribe"}, hours=24 * 30)},
    )
    context = {
        "email_type": "daily_revision",
        "subject": subject,
        "intro": intro,
        "user": user,
        "cards": card_blocks,
        "plan": plan,
        "weak_topics": topics,
        "activity": activity,
        "streak_bar": streak_bar(user.current_streak or 0),
        "open_url": frontend_url("/revision/today", {"from": "email"}),
        "preferences_url": frontend_url("/email-settings"),
        "unsubscribe_url": unsubscribe,
        "card_ids": [card.id for card in cards[:3]],
    }
    return {**context, "html": render_daily_html(context), "text": render_daily_text(context)}


async def build_weekly_digest(db: AsyncSession, user: User) -> dict:
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
    topics = await weak_topics(db, user)
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
    lines = [
        "CodeShelf - Daily Revision",
        "",
        ctx["intro"],
        "",
        f"Streak: {ctx['user'].current_streak} days",
        f"Today: {len(ctx['card_ids'])} quick email questions",
        f"Weak topics: {', '.join(ctx['weak_topics'])}",
        "",
        "Quick quiz:",
    ]
    for card in ctx["cards"]:
        lines.append(f"Q{card['index']}: {card['question']}")
        for option in card["options"]:
            lines.append(f"{option['label']}. {option['text']} - {option['url']}")
        lines.append("")
    lines.extend(["Today's revision plan:", *[f"{idx}. {item}" for idx, item in enumerate(ctx["plan"], 1)], "", ctx["open_url"]])
    return "\n".join(lines)


def render_daily_html(ctx: dict) -> str:
    card_html = ""
    for card in ctx["cards"]:
        options = "".join(
            f"""
            <a href="{html.escape(option['url'])}" style="display:inline-block;margin:6px 8px 6px 0;padding:10px 12px;border:1px solid #d6dbe6;border-radius:8px;color:#172033;text-decoration:none;background:#ffffff;">
              <strong>{html.escape(option['label'])}</strong> {html.escape(option['text'])}
            </a>
            """
            for option in card["options"]
        )
        card_html += f"""
        <tr>
          <td style="padding:18px 0;border-top:1px solid #edf0f5;">
            <p style="margin:0 0 6px;color:#647084;font-size:13px;">Q{card['index']} · {html.escape(card['topic'])}</p>
            <h3 style="margin:0 0 10px;color:#172033;font-size:18px;line-height:1.35;">{html.escape(card['question'])}</h3>
            <div>{options}</div>
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
                  <p style="margin:0 0 18px;font-size:17px;line-height:1.55;">{html.escape(ctx['intro'])}</p>
                  <div style="padding:16px;border-radius:12px;background:#f7f9fc;border:1px solid #e7ebf2;">
                    <p style="margin:0 0 6px;"><strong>Streak:</strong> {html.escape(ctx['streak_bar'])} {ctx['user'].current_streak} days</p>
                    <p style="margin:0 0 6px;"><strong>Today:</strong> {len(ctx['card_ids'])} inbox questions · {ctx['activity'].cards_reviewed}/{MIN_DAILY_CARDS} app reviews done</p>
                    <p style="margin:0;"><strong>Weak:</strong> {html.escape(', '.join(ctx['weak_topics']))}</p>
                  </div>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">{card_html}</table>
                  <h2 style="font-size:18px;margin:22px 0 8px;">Today's revision plan</h2>
                  <ol style="padding-left:22px;margin:0 0 22px;">{plan_items}</ol>
                  <a href="{html.escape(ctx['open_url'])}" style="display:inline-block;padding:13px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;">Open CodeShelf & Start Revision</a>
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
        print(f"\n--- CodeShelf email preview to {user.email} ---\nSubject: {payload['subject']}\n{payload['text']}\n")

    db.add(
        EmailLog(
            user_id=user.id,
            email_type=payload["email_type"],
            recipient=user.email,
            subject=payload["subject"],
            body="",
            card_ids=",".join(payload.get("card_ids", [])),
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
    for user in users:
        payload = await builder(db, user)
        if not payload:
            skipped += 1
            continue
        outcome = await send_email(db, user, payload)
        sent += 1 if outcome["status"] in {"sent", "printed"} else 0
        failed += 1 if outcome["status"] == "failed" else 0
    return {"users": len(users), "sent": sent, "skipped": skipped, "failed": failed}


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
    prefs = await ensure_email_preferences(db, user)
    prefs.enabled = body.enabled
    prefs.email_time = parse_time(body.email_time)
    prefs.timezone = body.timezone
    prefs.daily_card_count = body.daily_card_count
    prefs.include_dsa = body.include_dsa
    prefs.include_sql = body.include_sql
    prefs.include_devops = body.include_devops
    prefs.include_mistakes = body.include_mistakes
    await db.flush()
    return {"preferences": prefs_out(prefs)}


@router.post("/preview")
async def preview_email(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    payload = await build_daily_email(db, user)
    return {"subject": payload["subject"], "body": payload["text"], "html": payload["html"]}


@router.post("/send-test")
async def send_test(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await send_daily(user, db)


@router.post("/send-daily")
async def send_daily(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await send_email(db, user, await build_daily_email(db, user))


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


@router.get("/answer")
async def answer_from_email(token: str = Query(...), selected: str = Query(...), db: AsyncSession = Depends(get_db)):
    payload = decode_email_token(token, "email_answer")
    if not payload:
        return RedirectResponse(frontend_url("/revision/today", {"from": "email", "result": "invalid"}), status_code=302)
    selected_label = selected.strip().upper()
    correct = selected_label == str(payload.get("correct_label", "")).upper()
    saved = await apply_email_review(db, str(payload["sub"]), str(payload["card_id"]), "good" if correct else "hard")
    result = "correct" if correct else "wrong"
    if not saved:
        result = "missing"
    return RedirectResponse(frontend_url("/revision/today", {"from": "email", "result": result}), status_code=302)


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
