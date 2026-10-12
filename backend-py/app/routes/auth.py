from __future__ import annotations

import html
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session_factory, get_db
from app.deps import get_current_user
from app.mailer import deliver
from app.jwt_utils import create_access_token, create_email_verification_token, decode_email_verification_token
from app.models import EmailLog, User
from app.routes.utils import ensure_email_preferences, user_out
from app.security import hash_password, verify_password


router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()
RESEND_COOLDOWN_SECONDS = 60


def frontend_url(path: str, params: dict[str, str] | None = None) -> str:
    base = f"{settings.frontend_url.rstrip('/')}{path}"
    return f"{base}?{urlencode(params)}" if params else base


async def send_auth_email(db: AsyncSession, user: User, subject: str, body: str, html_body: str, email_type: str) -> None:
    result = await deliver(user.email, subject, html_body, body, to_name=user.name or "", label=email_type)
    status_value = result.status
    error_message = result.error_message
    message_id = result.message_id
    db.add(
        EmailLog(
            user_id=user.id,
            email_type=email_type,
            recipient=user.email,
            subject=subject,
            body=body,
            provider_message_id=message_id,
            status=status_value,
            error_message=error_message,
        )
    )


def verification_url(user: User) -> str:
    token = create_email_verification_token(user.id, user.email)
    return f"{settings.backend_url.rstrip('/')}/api/auth/verify-email?{urlencode({'token': token})}"


async def send_welcome_email(db: AsyncSession, user: User) -> None:
    subject = "Welcome to CodeShelf — verify your email"
    url = frontend_url("/add-note", {"from": "welcome"})
    verify = verification_url(user)
    text = (
        f"Welcome {user.name}. Verify your email to turn on revision reminders: {verify}\n\n"
        f"Then start by saving one concept, mistake, command, or problem note: {url}"
    )
    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;background:#080b12;color:#eef3ff;padding:28px;">
      <div style="max-width:560px;margin:auto;background:#111827;border:1px solid #253044;border-radius:16px;padding:28px;">
        <p style="letter-spacing:.08em;text-transform:uppercase;color:#d6b76a;font-size:12px;">CodeShelf</p>
        <h1 style="margin:0 0 10px;">Your memory system is ready.</h1>
        <p style="color:#b8c4d9;">Verify this address so CodeShelf can send your daily revision reminders. The link is valid for 48 hours.</p>
        <a href="{html.escape(verify)}" style="display:inline-block;margin-top:12px;padding:13px 18px;background:#d6b76a;color:#121212;border-radius:10px;text-decoration:none;font-weight:700;">Verify email</a>
        <p style="color:#b8c4d9;margin-top:22px;">Then save a coding lesson, generate recall cards, and let daily revision keep it alive.</p>
        <a href="{html.escape(url)}" style="color:#d6b76a;">Add your first note</a>
      </div>
    </div>
    """
    await send_auth_email(db, user, subject, text, html_body, "welcome")


async def send_verification_email(db: AsyncSession, user: User) -> None:
    subject = "Verify your CodeShelf email"
    verify = verification_url(user)
    text = f"Hi {user.name}, verify your email to turn on CodeShelf revision reminders: {verify}\n\nThis link is valid for 48 hours."
    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;background:#080b12;color:#eef3ff;padding:28px;">
      <div style="max-width:560px;margin:auto;background:#111827;border:1px solid #253044;border-radius:16px;padding:28px;">
        <p style="letter-spacing:.08em;text-transform:uppercase;color:#d6b76a;font-size:12px;">CodeShelf</p>
        <h1 style="margin:0 0 10px;">Confirm your email</h1>
        <p style="color:#b8c4d9;">Click below to verify this address and enable revision reminders. The link is valid for 48 hours.</p>
        <a href="{html.escape(verify)}" style="display:inline-block;margin-top:12px;padding:13px 18px;background:#d6b76a;color:#121212;border-radius:10px;text-decoration:none;font-weight:700;">Verify email</a>
      </div>
    </div>
    """
    await send_auth_email(db, user, subject, text, html_body, "verify_email")


async def send_welcome_email_after_response(user_id: str) -> None:
    try:
        async with async_session_factory() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if not user:
                return
            await send_welcome_email(db, user)
            await db.commit()
    except Exception as exc:
        print(f"CodeShelf welcome email failed for user {user_id}: {exc}")


def normalize_email(value: str) -> str:
    return value.strip().lower()


class SignupBody(BaseModel):
    name: str
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/signup")
async def signup(body: SignupBody, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    email = normalize_email(body.email)
    password = body.password

    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        email_verified=False,
        auth_provider="password",
    )
    db.add(user)
    await db.flush()
    await ensure_email_preferences(db, user)
    background_tasks.add_task(send_welcome_email_after_response, user.id)
    return {"token": create_access_token(user.id), "user": user_out(user)}


@router.post("/login")
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    email = normalize_email(body.email)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or user.auth_provider != "password" or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"token": create_access_token(user.id), "user": user_out(user)}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"user": user_out(user)}


@router.get("/verify-email")
async def verify_email(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    payload = decode_email_verification_token(token)
    if not payload:
        return RedirectResponse(frontend_url("/email-settings", {"status": "verify-invalid"}), status_code=302)
    result = await db.execute(select(User).where(User.id == str(payload["sub"])))
    user = result.scalar_one_or_none()
    if not user or normalize_email(user.email) != normalize_email(str(payload.get("email", ""))):
        return RedirectResponse(frontend_url("/email-settings", {"status": "verify-invalid"}), status_code=302)
    if not user.email_verified:
        user.email_verified = True
        await db.flush()
    return RedirectResponse(frontend_url("/email-settings", {"status": "verified"}), status_code=302)


@router.post("/resend-verification")
async def resend_verification(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.email_verified:
        return {"ok": True, "already_verified": True}
    since = datetime.now(timezone.utc) - timedelta(seconds=RESEND_COOLDOWN_SECONDS)
    recent = await db.scalar(
        select(func.count(EmailLog.id)).where(
            EmailLog.user_id == user.id,
            EmailLog.email_type.in_(["verify_email", "welcome"]),
            EmailLog.sent_at >= since,
        )
    )
    if recent:
        raise HTTPException(status_code=429, detail="A verification email was just sent. Check your inbox or try again in a minute.")
    await send_verification_email(db, user)
    return {"ok": True, "already_verified": False, "email": user.email}
