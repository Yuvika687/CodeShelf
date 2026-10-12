from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import DailyActivity, User
from app.routes.utils import get_or_create_today_activity


router = APIRouter(prefix="/api", tags=["activity"])


@router.get("/streak")
async def streak(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    today = await get_or_create_today_activity(db, user)
    return {
        "current_streak": user.current_streak,
        "longest_streak": user.longest_streak,
        "completed_today": today.completed_today,
        "minimum_cards": 5,
        "cards_reviewed_today": today.cards_reviewed,
    }


@router.get("/activity")
async def activity(
    days: int = Query(60, ge=1, le=371),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DailyActivity).where(DailyActivity.user_id == user.id).order_by(DailyActivity.date.desc()).limit(days)
    )
    rows = result.scalars().all()
    return {
        "activity": [
            {
                "date": item.date.isoformat(),
                "cards_reviewed": item.cards_reviewed,
                "problems_revised": item.problems_revised,
                "notes_revised": item.notes_revised,
                "mistakes_fixed": item.mistakes_fixed,
                "completed_today": item.completed_today,
            }
            for item in rows
        ]
    }
