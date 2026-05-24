"""
CodeShelf — Chrome Extension Submission Endpoint
==================================================

Receives LeetCode solutions from the CodeShelf Chrome Extension,
saves them to the database, and auto-pushes to the user's connected
GitHub repository.

POST /api/extension/submit
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.github_utils import (
    GitHubSyncError,
    build_solution_path,
    push_file_to_github,
    render_solution_file,
)
from app.models import GitHubConnection, Problem, User
from app.routes.utils import fallback_cards_from_problem, problem_out


router = APIRouter(prefix="/api/extension", tags=["extension"])


# ── Request / Response Schemas ────────────────────────────────────────

class ExtensionSubmission(BaseModel):
    problem_title: str
    problem_url: str
    difficulty: str = "Medium"
    tags: list[str] = []
    code: str
    language: str = "python"
    notes: str = ""
    mistake: str = ""
    approach: str = ""


class GitHubResult(BaseModel):
    synced: bool
    path: str = ""
    commit_sha: str = ""
    html_url: str = ""
    message: str = ""


# ── Submit Endpoint ───────────────────────────────────────────────────

@router.post("/submit")
async def extension_submit(
    body: ExtensionSubmission,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Accept a LeetCode solution from the Chrome Extension.

    1. Check for duplicate (same user + same problem URL)
    2. Save to the CodeShelf database as a Problem
    3. If GitHub is connected, auto-push the solution file
    4. Return the created problem + GitHub sync result
    """

    # ── Duplicate check ───────────────────────────────────────────────
    existing_problem: Problem | None = None
    if body.problem_url:
        dup_result = await db.execute(
            select(Problem).where(
                Problem.user_id == user.id,
                Problem.url == body.problem_url,
            )
        )
        existing_problem = dup_result.scalar_one_or_none()

    # ── Normalize input ───────────────────────────────────────────────
    topic = body.tags[0].strip().title() if body.tags else "DSA"
    pattern = body.tags[1].strip().title() if len(body.tags) > 1 else ""
    difficulty = body.difficulty.strip().capitalize()
    if difficulty.lower() not in {"easy", "medium", "hard"}:
        difficulty = "Medium"

    # ── Save to database ──────────────────────────────────────────────
    if existing_problem:
        problem = existing_problem
        problem.title = body.problem_title.strip() or problem.title
        problem.difficulty = difficulty
        problem.topic = topic
        problem.pattern = pattern
        problem.status = "solved"
        problem.approach = body.approach.strip() or problem.approach
        problem.code = body.code or problem.code
        problem.language = body.language.strip().lower() or problem.language
        problem.mistake = body.mistake.strip() or problem.mistake
    else:
        problem = Problem(
            user_id=user.id,
            platform="LeetCode",
            title=body.problem_title.strip(),
            url=body.problem_url.strip(),
            difficulty=difficulty,
            topic=topic,
            pattern=pattern,
            status="solved",
            approach=body.approach.strip(),
            code=body.code,
            language=body.language.strip().lower(),
            mistake=body.mistake.strip(),
        )
        db.add(problem)
    await db.flush()

    # Generate revision cards
    if not existing_problem:
        db.add_all(fallback_cards_from_problem(problem))
        await db.flush()

    # ── GitHub auto-push ──────────────────────────────────────────────
    gh_result = GitHubResult(synced=False)

    conn_result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.user_id == user.id)
    )
    conn = conn_result.scalar_one_or_none()

    if conn and conn.repo_full_name:
        path = build_solution_path(
            problem_title=problem.title,
            language=problem.language,
            topic=topic,
            platform="leetcode",
        )
        content = render_solution_file(
            code=body.code,
            language=body.language,
            problem_title=body.problem_title,
            url=body.problem_url,
            difficulty=difficulty,
            tags=body.tags,
            approach=body.approach,
            mistake=body.mistake,
        )
        try:
            commit = await push_file_to_github(
                token=conn.access_token,
                repo=conn.repo_full_name,
                branch=conn.default_branch,
                path=path,
                content=content,
                commit_message=f"CodeShelf: {body.problem_title}",
            )
            gh_result = GitHubResult(
                synced=True,
                path=path,
                commit_sha=commit.get("sha", ""),
                html_url=commit.get("html_url", ""),
            )
        except GitHubSyncError as exc:
            # GitHub push failed — still save to DB, but report the error
            gh_result = GitHubResult(
                synced=False,
                message=f"Saved to CodeShelf, but GitHub push failed: {exc.message}",
            )
    elif conn and not conn.repo_full_name:
        gh_result = GitHubResult(
            synced=False,
            message="GitHub is connected but no target repo is selected. Go to Settings → GitHub to pick a repo.",
        )
    else:
        gh_result = GitHubResult(
            synced=False,
            message="GitHub is not connected. Connect your GitHub account in Settings to enable auto-sync.",
        )

    return {
        "ok": True,
        "updated": bool(existing_problem),
        "problem": problem_out(problem),
        "github": gh_result.model_dump(),
    }
