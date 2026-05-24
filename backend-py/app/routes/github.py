from __future__ import annotations

import base64
import re
from pathlib import PurePosixPath

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Problem, User


router = APIRouter(prefix="/api/github", tags=["github"])
settings = get_settings()


class GitHubProblemIn(BaseModel):
    problem_id: str


@router.post("/save-problem")
async def save_problem_to_github(
    body: GitHubProblemIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.github_token or not settings.github_repo:
        raise HTTPException(
            status_code=400,
            detail="GitHub pipeline is not configured. Set GITHUB_TOKEN, GITHUB_REPO, and optional GITHUB_BRANCH on the backend.",
        )

    result = await db.execute(select(Problem).where(Problem.id == body.problem_id, Problem.user_id == user.id))
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found.")

    path = solution_path(problem)
    content = render_solution_file(problem)
    commit = await put_github_file(
        path=path,
        content=content,
        message=f"CodeShelf: save {problem.title}",
    )
    return {"ok": True, "path": path, "commit": commit}


async def put_github_file(path: str, content: str, message: str) -> dict:
    api_url = f"https://api.github.com/repos/{settings.github_repo}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        existing = await client.get(api_url, headers=headers, params={"ref": settings.github_branch})
        sha = None
        if existing.status_code == 200:
            data = existing.json()
            sha = data.get("sha")
        elif existing.status_code != 404:
            raise HTTPException(status_code=existing.status_code, detail=f"GitHub read failed: {existing.text[:500]}")

        payload = {
            "message": message,
            "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
            "branch": settings.github_branch,
        }
        if sha:
            payload["sha"] = sha
        response = await client.put(api_url, headers=headers, json=payload)
        if response.status_code not in {200, 201}:
            raise HTTPException(status_code=response.status_code, detail=f"GitHub commit failed: {response.text[:500]}")
        data = response.json()
        return {
            "sha": data.get("commit", {}).get("sha", ""),
            "html_url": data.get("content", {}).get("html_url", ""),
        }


def solution_path(problem: Problem) -> str:
    platform = slug(problem.platform or "practice")
    topic = slug(problem.topic or "general")
    pattern = slug(problem.pattern or "uncategorized")
    title = slug(problem.title or "solution")
    extension = extension_for_language(problem.language)
    return str(PurePosixPath(platform) / topic / pattern / f"{title}{extension}")


def render_solution_file(problem: Problem) -> str:
    lines = [
        f"# {problem.title}",
        "",
        f"- Platform: {problem.platform or 'Practice'}",
        f"- Difficulty: {problem.difficulty or 'Medium'}",
        f"- Topic: {problem.topic or 'General'}",
        f"- Pattern: {problem.pattern or 'Uncategorized'}",
    ]
    if problem.url:
        lines.append(f"- Source: {problem.url}")
    if problem.time_complexity:
        lines.append(f"- Time Complexity: {problem.time_complexity}")
    if problem.space_complexity:
        lines.append(f"- Space Complexity: {problem.space_complexity}")
    lines.extend(["", "## Approach", "", problem.approach or "Add approach notes in CodeShelf.", ""])
    if problem.mistake:
        lines.extend(["## Mistake To Avoid", "", problem.mistake, ""])
    lines.extend(["## Solution", "", f"```{problem.language or ''}", problem.code or "// Add solution code in CodeShelf.", "```", ""])
    return "\n".join(lines)


def slug(value: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return clean or "untitled"


def extension_for_language(language: str) -> str:
    clean = (language or "").strip().lower()
    if clean in {"cpp", "c++"}:
        return ".cpp.md"
    if clean in {"js", "javascript"}:
        return ".js.md"
    if clean in {"py", "python"}:
        return ".py.md"
    if clean == "sql":
        return ".sql.md"
    if clean in {"java"}:
        return ".java.md"
    return ".md"
