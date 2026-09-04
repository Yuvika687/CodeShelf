from __future__ import annotations

import html
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session_factory, get_db
from app.deps import get_current_user
from app.jwt_utils import create_access_token
from app.models import EmailLog, User
from app.routes.utils import ensure_email_preferences, user_out
from app.security import hash_password, verify_password


router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def frontend_url(path: str, params: dict[str, str] | None = None) -> str:
    base = f"{settings.frontend_url.rstrip('/')}{path}"
    return f"{base}?{urlencode(params)}" if params else base


async def send_auth_email(db: AsyncSession, user: User, subject: str, body: str, html_body: str, email_type: str) -> None:
    status_value = "printed"
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
                        "subject": subject,
                        "html": html_body,
                        "text": body,
                    },
                )
            status_value = "sent" if response.is_success else "failed"
            data = response.json() if response.content else {}
            message_id = data.get("id", "") if isinstance(data, dict) else ""
            if not response.is_success:
                error_message = response.text[:1000]
        except Exception as exc:
            status_value = "failed"
            error_message = str(exc)
    else:
        print(f"\n--- CodeShelf {email_type} to {user.email} ---\nSubject: {subject}\n{body}\n")
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


async def send_welcome_email(db: AsyncSession, user: User) -> None:
    subject = "Welcome to CodeShelf"
    url = frontend_url("/add-note", {"from": "welcome"})
    text = f"Welcome {user.name}. Start by saving one concept, mistake, command, or problem note: {url}"
    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;background:#080b12;color:#eef3ff;padding:28px;">
      <div style="max-width:560px;margin:auto;background:#111827;border:1px solid #253044;border-radius:16px;padding:28px;">
        <p style="letter-spacing:.08em;text-transform:uppercase;color:#d6b76a;font-size:12px;">CodeShelf</p>
        <h1 style="margin:0 0 10px;">Your memory system is ready.</h1>
        <p style="color:#b8c4d9;">Save a coding lesson, generate recall cards, and let daily revision keep it alive.</p>
        <a href="{html.escape(url)}" style="display:inline-block;margin-top:12px;padding:13px 18px;background:#d6b76a;color:#121212;border-radius:10px;text-decoration:none;font-weight:700;">Add your first note</a>
      </div>
    </div>
    """
    await send_auth_email(db, user, subject, text, html_body, "welcome")


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
