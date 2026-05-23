from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.database import engine
from app.routes import activity, ai, auth, dashboard, email, mistakes, notes, problems, revision


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

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(notes.router)
app.include_router(problems.router)
app.include_router(mistakes.router)
app.include_router(revision.router)
app.include_router(activity.router)
app.include_router(email.router)
app.include_router(ai.router)


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
