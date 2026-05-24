from __future__ import annotations

from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.responses import Response

from app.config import get_settings
from app.database import engine
from app.routes import activity, ai, auth, dashboard, email, github, mistakes, notes, problems, revision


settings = get_settings()

app = FastAPI(
    title="CodeShelf API",
    description="Personal coding memory and revision platform. Never forget what you already learned.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def allowed_browser_origin(origin: str | None) -> bool:
    if not origin:
        return False
    parsed = urlparse(origin)
    host = (parsed.hostname or "").lower()
    if parsed.scheme == "https" and (host == "yogender1.me" or host.endswith(".yogender1.me")):
        return True
    if parsed.scheme == "https" and host.endswith(".onrender.com"):
        return True
    if parsed.scheme == "http" and host in {"localhost", "127.0.0.1"}:
        return True
    return False


def cors_headers(origin: str) -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type,x-cron-secret",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
        "X-CodeShelf-CORS": "fallback",
    }


@app.middleware("http")
async def cors_fallback(request, call_next):
    origin = request.headers.get("origin")
    if request.method == "OPTIONS" and allowed_browser_origin(origin):
        return Response(status_code=204, headers=cors_headers(origin))
    response = await call_next(request)
    if allowed_browser_origin(origin):
        response.headers.update(cors_headers(origin))
    return response


app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(notes.router)
app.include_router(problems.router)
app.include_router(mistakes.router)
app.include_router(revision.router)
app.include_router(activity.router)
app.include_router(email.router)
app.include_router(ai.router)
app.include_router(github.router)


@app.get("/")
async def root():
    return {"ok": True, "message": "CodeShelf API is running", "tagline": "Never forget what you already learned."}


@app.get("/api/health")
async def health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"ok": True, "name": "CodeShelf API", "database": "connected", "environment": settings.environment}
    except Exception as exc:
        return {"ok": False, "name": "CodeShelf API", "database": str(exc), "environment": settings.environment}
