"""
CodeShelf — At-rest encryption for stored third-party secrets.

Used for GitHub OAuth tokens. Values are Fernet-encrypted (AES-128-CBC + HMAC)
and stored with an ``enc:v1:`` prefix. Rows written before encryption existed
are plaintext without the prefix; they are still readable and get encrypted the
next time they are written (and by migration 009).

The key comes from TOKEN_ENCRYPTION_KEY, falling back to a key derived from
JWT_SECRET. Rotating whichever one is in use makes existing tokens unreadable;
they decrypt to "" and the user simply reconnects GitHub.
"""

from __future__ import annotations

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.config import get_settings


PREFIX = "enc:v1:"


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    settings = get_settings()
    secret = settings.token_encryption_key or settings.jwt_secret
    key = base64.urlsafe_b64encode(hashlib.sha256(f"codeshelf-token-key:{secret}".encode("utf-8")).digest())
    return Fernet(key)


def is_encrypted(value: str | None) -> bool:
    return bool(value) and value.startswith(PREFIX)


def encrypt_secret(value: str | None) -> str | None:
    if value is None or value == "" or is_encrypted(value):
        return value
    return PREFIX + _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str | None) -> str | None:
    if not is_encrypted(value):
        return value
    try:
        return _fernet().decrypt(value[len(PREFIX):].encode("ascii")).decode("utf-8")
    except InvalidToken:
        return ""


class EncryptedText(TypeDecorator):
    """Text column that is transparently encrypted on write and decrypted on read."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt_secret(value)

    def process_result_value(self, value, dialect):
        return decrypt_secret(value)
