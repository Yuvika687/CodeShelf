"""
CodeShelf — Outbound email delivery.

Picks the first configured provider:
  0. Gmail via Google Apps Script (GMAIL_SCRIPT_URL + GMAIL_SCRIPT_SECRET) —
     free, no extra account: a tiny script in the owner's Google account sends
     from their real Gmail (see tools/gmail-relay). ~100 recipients/day.
  1. Brevo  (BREVO_API_KEY)  — free tier, can send from a single verified
     address such as a personal Gmail, no domain needed.
  2. Resend (RESEND_API_KEY) — needs a verified domain to reach other people.
With neither configured, emails are printed in development and reported as
failed in production.

Both providers are called over HTTPS, which matters on Render's free tier
where outbound SMTP ports are blocked.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import httpx

from app.config import get_settings


settings = get_settings()


@dataclass
class DeliveryResult:
    status: str  # "sent" | "failed" | "printed"
    message_id: str = ""
    error_message: str = ""


def provider_name() -> str:
    if settings.gmail_script_url:
        return "gmail-script"
    if settings.brevo_api_key:
        return "brevo"
    if settings.resend_api_key:
        return "resend"
    return ""


def _sender() -> tuple[str, str]:
    """Return (name, address). MAIL_FROM_* wins; otherwise parse RESEND_FROM_EMAIL."""
    if settings.mail_from_email:
        return settings.mail_from_name or "CodeShelf", settings.mail_from_email
    match = re.match(r"\s*(.*?)\s*<([^>]+)>\s*$", settings.resend_from_email or "")
    if match:
        return match.group(1) or "CodeShelf", match.group(2)
    return "CodeShelf", (settings.resend_from_email or "").strip()


async def _send_brevo(to_email: str, to_name: str, subject: str, html: str, text: str) -> DeliveryResult:
    name, address = _sender()
    if not address:
        return DeliveryResult("failed", error_message="MAIL_FROM_EMAIL is not configured for Brevo.")
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": settings.brevo_api_key, "Content-Type": "application/json", "Accept": "application/json"},
            json={
                "sender": {"name": name, "email": address},
                "to": [{"email": to_email, **({"name": to_name} if to_name else {})}],
                "replyTo": {"email": address, "name": name},
                "subject": subject,
                "htmlContent": html,
                "textContent": text,
            },
        )
    if not response.is_success:
        return DeliveryResult("failed", error_message=response.text[:1000])
    data = response.json() if response.content else {}
    return DeliveryResult("sent", message_id=str(data.get("messageId", "")) if isinstance(data, dict) else "")


async def _send_gmail_script(to_email: str, subject: str, html: str, text: str) -> DeliveryResult:
    # Google Apps Script web app (tools/gmail-relay/Code.gs) that sends through the
    # owner's own Gmail. Apps Script answers POSTs with a 302 to the real response.
    name, _ = _sender()
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        response = await client.post(
            settings.gmail_script_url,
            json={
                "secret": settings.gmail_script_secret,
                "to": to_email,
                "subject": subject,
                "html": html,
                "text": text,
                "name": name,
            },
        )
    try:
        data = response.json()
    except ValueError:
        data = {}
    if not response.is_success or not isinstance(data, dict) or not data.get("ok"):
        detail = data.get("error") if isinstance(data, dict) and data.get("error") else response.text[:300]
        return DeliveryResult("failed", error_message=f"Gmail script: {detail}")
    return DeliveryResult("sent", message_id=str(data.get("id", "")))


async def _send_resend(to_email: str, subject: str, html: str, text: str) -> DeliveryResult:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
            json={"from": settings.resend_from_email, "to": [to_email], "subject": subject, "html": html, "text": text},
        )
    if not response.is_success:
        return DeliveryResult("failed", error_message=response.text[:1000])
    data = response.json() if response.content else {}
    return DeliveryResult("sent", message_id=data.get("id", "") if isinstance(data, dict) else "")


async def deliver(to_email: str, subject: str, html: str, text: str, to_name: str = "", label: str = "email") -> DeliveryResult:
    provider = provider_name()
    try:
        if provider == "gmail-script":
            return await _send_gmail_script(to_email, subject, html, text)
        if provider == "brevo":
            return await _send_brevo(to_email, to_name, subject, html, text)
        if provider == "resend":
            return await _send_resend(to_email, subject, html, text)
    except Exception as exc:
        return DeliveryResult("failed", error_message=str(exc))
    if settings.environment.lower() == "production":
        return DeliveryResult("failed", error_message="No email provider configured (set GMAIL_SCRIPT_URL, BREVO_API_KEY or RESEND_API_KEY); email was not sent.")
    print(f"\n--- CodeShelf {label} to {to_email} ---\nSubject: {subject}\n{text}\n")
    return DeliveryResult("printed")
