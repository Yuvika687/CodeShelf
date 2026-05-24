"""
CodeShelf — GitHub OAuth & Sync Routes
========================================

Per-user GitHub integration via OAuth.

Endpoints:
  GET  /api/github/connect        — Redirect to GitHub OAuth authorization
  GET  /api/github/callback       — OAuth callback, exchange code for token
  GET  /api/github/status         — Check if user has GitHub connected
  POST /api/github/disconnect     — Remove GitHub connection
  GET  /api/github/repos          — List user's pushable repos
  POST /api/github/set-repo       — Set target repo for pushes
  POST /api/github/save-problem   — Push an existing problem to GitHub
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.github_utils import (
    GitHubAuthError,
    GitHubConflictError,
    GitHubRateLimitError,
    GitHubSyncError,
    build_solution_path,
    get_github_user,
    list_github_repos,
    push_file_to_github,
    render_solution_file,
)
from app.models import GitHubConnection, Problem, User


router = APIRouter(prefix="/api/github", tags=["github"])
settings = get_settings()


# ── Pydantic schemas ──────────────────────────────────────────────────

class SetRepoIn(BaseModel):
    repo_full_name: str
    default_branch: str = "main"


class GitHubProblemIn(BaseModel):
    problem_id: str


# ── Helpers ───────────────────────────────────────────────────────────

def _require_oauth_config() -> None:
    """Raise if GitHub OAuth is not configured on the backend."""
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(
            status_code=503,
            detail="GitHub OAuth is not configured on the server. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
        )


async def _get_connection(user: User, db: AsyncSession) -> GitHubConnection:
    """Fetch the user's GitHub connection or raise 400."""
    result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.user_id == user.id)
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(
            status_code=400,
            detail="GitHub is not connected. Please connect your GitHub account first via Settings → GitHub.",
        )
    return conn


def _handle_github_error(exc: GitHubSyncError) -> None:
    """Convert a GitHubSyncError into an HTTPException."""
    raise HTTPException(status_code=exc.status_code, detail=exc.message)


# ── OAuth Flow ────────────────────────────────────────────────────────

@router.get("/connect")
async def github_connect(
    token: str = Query(..., description="JWT token for identifying the user after OAuth redirect"),
):
    """
    Redirect the user to GitHub's OAuth authorization page.

    The frontend should open this URL in a new window/tab, passing the JWT
    as a query param so we can identify the user in the callback.
    """
    _require_oauth_config()
    # We encode the JWT in the state parameter so the callback can identify the user
    authorize_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&scope=repo"
        f"&state={token}"
        f"&redirect_uri={settings.backend_url.rstrip('/')}/api/github/callback"
    )
    return RedirectResponse(url=authorize_url)


@router.get("/callback")
async def github_callback(
    code: str = Query(...),
    state: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """
    GitHub OAuth callback. Exchanges the code for an access token,
    fetches the GitHub username, and stores the connection.
    """
    _require_oauth_config()

    # 1. Identify the user from the state (JWT)
    from app.jwt_utils import decode_token
    user_id = decode_token(state)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please try connecting GitHub again.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    # 2. Exchange code for access token
    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
    if token_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to exchange GitHub authorization code.")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        error = token_data.get("error_description", token_data.get("error", "Unknown error"))
        raise HTTPException(status_code=400, detail=f"GitHub OAuth failed: {error}")

    # 3. Fetch GitHub user info
    try:
        gh_user = await get_github_user(access_token)
    except GitHubSyncError as exc:
        _handle_github_error(exc)

    github_username = gh_user.get("login", "")

    # 4. Upsert GitHubConnection
    result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.user_id == user.id)
    )
    conn = result.scalar_one_or_none()
    if conn:
        conn.access_token = access_token
        conn.github_username = github_username
    else:
        conn = GitHubConnection(
            user_id=user.id,
            access_token=access_token,
            github_username=github_username,
        )
        db.add(conn)
    await db.flush()

    # 5. Redirect to frontend success page
    redirect_url = f"{settings.frontend_url.rstrip('/')}/#/settings?github=connected"
    return RedirectResponse(url=redirect_url)


# ── Connection Management ─────────────────────────────────────────────

@router.get("/status")
async def github_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if the user has connected their GitHub account."""
    result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.user_id == user.id)
    )
    conn = result.scalar_one_or_none()
    if not conn:
        return {
            "connected": False,
            "github_username": None,
            "repo": None,
            "branch": None,
        }
    return {
        "connected": True,
        "github_username": conn.github_username,
        "repo": conn.repo_full_name or None,
        "branch": conn.default_branch,
    }


@router.post("/disconnect")
async def github_disconnect(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the user's GitHub connection."""
    result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.user_id == user.id)
    )
    conn = result.scalar_one_or_none()
    if conn:
        await db.delete(conn)
    return {"ok": True, "message": "GitHub account disconnected."}


@router.get("/repos")
async def github_repos(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the user's GitHub repos they can push to."""
    conn = await _get_connection(user, db)
    try:
        repos = await list_github_repos(conn.access_token)
    except GitHubSyncError as exc:
        _handle_github_error(exc)
    return {"repos": repos}


@router.post("/set-repo")
async def github_set_repo(
    body: SetRepoIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set the target repo for GitHub pushes."""
    conn = await _get_connection(user, db)
    conn.repo_full_name = body.repo_full_name
    conn.default_branch = body.default_branch
    await db.flush()
    return {
        "ok": True,
        "repo": conn.repo_full_name,
        "branch": conn.default_branch,
    }


# ── Push Problem to GitHub ────────────────────────────────────────────

@router.post("/save-problem")
async def save_problem_to_github(
    body: GitHubProblemIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Push an existing CodeShelf problem to the user's connected GitHub repo."""
    conn = await _get_connection(user, db)
    if not conn.repo_full_name:
        raise HTTPException(
            status_code=400,
            detail="No target repo selected. Use /api/github/set-repo to choose a repository.",
        )

    # Fetch the problem
    result = await db.execute(
        select(Problem).where(Problem.id == body.problem_id, Problem.user_id == user.id)
    )
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found.")

    # Build file path and content
    path = build_solution_path(
        problem_title=problem.title,
        language=problem.language,
        topic=problem.topic or "general",
        platform=problem.platform or "leetcode",
    )
    content = render_solution_file(
        code=problem.code or "",
        language=problem.language or "python",
        problem_title=problem.title,
        url=problem.url or "",
        difficulty=problem.difficulty or "",
        approach=problem.approach or "",
        mistake=problem.mistake or "",
    )

    try:
        commit = await push_file_to_github(
            token=conn.access_token,
            repo=conn.repo_full_name,
            branch=conn.default_branch,
            path=path,
            content=content,
            commit_message=f"CodeShelf: {problem.title}",
        )
    except GitHubSyncError as exc:
        _handle_github_error(exc)

    return {"ok": True, "path": path, "commit": commit}
