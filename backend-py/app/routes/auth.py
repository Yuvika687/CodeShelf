from __future__ import annotations

import html
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import firebase_admin
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from firebase_admin import auth as firebase_auth, credentials
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.jwt_utils import create_access_token
from app.models import EmailLog, User
from app.routes.utils import ensure_email_preferences, user_out
from app.security import hash_password, verify_password


router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


class SignupIn(BaseModel):
    name: str
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


class GoogleIn(BaseModel):
    id_token: str


class ResendVerificationIn(BaseModel):
    email: str


def frontend_url(path: str, params: dict[str, str] | None = None) -> str:
    base = f"{settings.frontend_url.rstrip('/')}{path}"
    return f"{base}?{urlencode(params)}" if params else base


def backend_url(path: str, params: dict[str, str]) -> str:
    return f"{settings.backend_url.rstrip('/')}{path}?{urlencode(params)}"


def create_email_token(user: User, token_type: str, hours: int = 24) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "email": user.email,
        "type": token_type,
        "iat": now,
        "exp": now + timedelta(hours=hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_email_token(token: str, expected_type: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    return payload if payload.get("type") == expected_type else None


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


async def send_verification_email(db: AsyncSession, user: User) -> None:
    token = create_email_token(user, "verify_email", hours=24)
    url = backend_url("/api/auth/verify-email", {"token": token})
    subject = "Verify your CodeShelf email"
    text = f"Hi {user.name}, verify your email to activate reminders and protect your CodeShelf account:\n\n{url}"
    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;background:#080b12;color:#eef3ff;padding:28px;">
      <div style="max-width:560px;margin:auto;background:#111827;border:1px solid #253044;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 10px;">Verify CodeShelf</h1>
        <p style="color:#b8c4d9;">Hi {html.escape(user.name)}, confirm this email before reminders can be enabled.</p>
        <a href="{html.escape(url)}" style="display:inline-block;margin-top:12px;padding:13px 18px;background:#d6b76a;color:#121212;border-radius:10px;text-decoration:none;font-weight:700;">Verify email</a>
      </div>
    </div>
    """
    await send_auth_email(db, user, subject, text, html_body, "email_verification")


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


def init_firebase_admin() -> None:
    if firebase_admin._apps:
        return
    if settings.firebase_service_account_json:
        firebase_admin.initialize_app(credentials.Certificate(json.loads(settings.firebase_service_account_json)))
        return
    options = {"projectId": settings.firebase_project_id} if settings.firebase_project_id else None
    firebase_admin.initialize_app(options=options)


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(body: SignupIn, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email is already registered.")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")
    user = User(
        name=body.name.strip(),
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        email_verified=False,
        auth_provider="password",
    )
    db.add(user)
    await db.flush()
    await ensure_email_preferences(db, user)
    await send_verification_email(db, user)
    return {"message": "Verification email sent. Open your inbox to activate CodeShelf.", "user": user_out(user)}


@router.post("/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash, "bcrypt"):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.email_verified:
        await send_verification_email(db, user)
        raise HTTPException(status_code=403, detail="Please verify your email first. We sent a fresh verification link.")
    return {"token": create_access_token(user.id), "user": user_out(user)}


@router.post("/google")
async def google_login(body: GoogleIn, db: AsyncSession = Depends(get_db)):
    try:
        init_firebase_admin()
        decoded = firebase_auth.verify_id_token(body.id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified.")
    email = str(decoded.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="Google account did not provide an email.")
    if not decoded.get("email_verified", False):
        raise HTTPException(status_code=403, detail="Google email is not verified.")
    firebase_uid = str(decoded.get("uid") or "")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    is_new = False
    if not user:
        user = User(
            name=str(decoded.get("name") or email.split("@")[0]),
            email=email,
            password_hash="firebase-google",
            email_verified=True,
            auth_provider="google",
            firebase_uid=firebase_uid,
        )
        db.add(user)
        await db.flush()
        await ensure_email_preferences(db, user)
        is_new = True
    else:
        user.email_verified = True
        user.auth_provider = "google" if user.auth_provider != "password" else user.auth_provider
        user.firebase_uid = user.firebase_uid or firebase_uid
    if is_new:
        await send_welcome_email(db, user)
    return {"token": create_access_token(user.id), "user": user_out(user)}


@router.get("/verify-email")
async def verify_email(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    payload = decode_email_token(token, "verify_email")
    if not payload:
        return RedirectResponse(frontend_url("/login", {"verified": "invalid"}), status_code=302)
    result = await db.execute(select(User).where(User.id == str(payload.get("sub")), User.email == str(payload.get("email"))))
    user = result.scalar_one_or_none()
    if not user:
        return RedirectResponse(frontend_url("/login", {"verified": "missing"}), status_code=302)
    first_verify = not user.email_verified
    user.email_verified = True
    if first_verify:
        await send_welcome_email(db, user)
    return RedirectResponse(frontend_url("/login", {"verified": "success"}), status_code=302)


@router.post("/resend-verification")
async def resend_verification(body: ResendVerificationIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    if user and not user.email_verified:
        await send_verification_email(db, user)
    return {"message": "If that account needs verification, a fresh link has been sent."}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"user": user_out(user)}
