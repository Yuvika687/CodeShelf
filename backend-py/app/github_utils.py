"""
CodeShelf — GitHub Push Utilities
=================================

Standalone helper functions for interacting with the GitHub Contents API.
Used by both the existing save-problem flow and the new Chrome Extension sync.

Error handling:
  - 401 → GitHubAuthError (token expired / revoked)
  - 403 + rate-limit headers → GitHubRateLimitError (with reset timestamp)
  - 409 / SHA mismatch → GitHubConflictError (concurrent push / stale SHA)
"""

from __future__ import annotations

import base64
import re
from datetime import datetime, timezone
from pathlib import PurePosixPath

import httpx


# ── Custom Exceptions ─────────────────────────────────────────────────

class GitHubSyncError(Exception):
    """Base class for GitHub sync errors."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class GitHubAuthError(GitHubSyncError):
    """Token is invalid, expired, or revoked."""
    def __init__(self, message: str = "GitHub token is invalid or expired. Please reconnect your GitHub account."):
        super().__init__(message, status_code=401)


class GitHubRateLimitError(GitHubSyncError):
    """API rate limit exceeded."""
    def __init__(self, reset_at: datetime | None = None):
        reset_str = f" Resets at {reset_at.isoformat()}." if reset_at else ""
        super().__init__(f"GitHub API rate limit exceeded.{reset_str}", status_code=429)
        self.reset_at = reset_at


class GitHubConflictError(GitHubSyncError):
    """Concurrent push or SHA mismatch."""
    def __init__(self, message: str = "File was modified concurrently on GitHub. Please try again."):
        super().__init__(message, status_code=409)


# ── HTTP Helpers ──────────────────────────────────────────────────────

_GITHUB_API = "https://api.github.com"
_API_VERSION = "2022-11-28"


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": _API_VERSION,
    }


def _check_rate_limit(response: httpx.Response) -> None:
    """Raise GitHubRateLimitError if we hit the rate limit."""
    if response.status_code == 403:
        remaining = response.headers.get("x-ratelimit-remaining", "")
        if remaining == "0":
            reset_ts = response.headers.get("x-ratelimit-reset")
            reset_at = None
            if reset_ts:
                try:
                    reset_at = datetime.fromtimestamp(int(reset_ts), tz=timezone.utc)
                except (ValueError, OSError):
                    pass
            raise GitHubRateLimitError(reset_at=reset_at)


def _check_auth(response: httpx.Response) -> None:
    """Raise GitHubAuthError on 401."""
    if response.status_code == 401:
        raise GitHubAuthError()


# ── Public API ────────────────────────────────────────────────────────

async def get_github_user(token: str) -> dict:
    """Fetch the authenticated GitHub user profile."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{_GITHUB_API}/user", headers=_headers(token))
        _check_auth(resp)
        _check_rate_limit(resp)
        resp.raise_for_status()
        return resp.json()


async def list_github_repos(token: str) -> list[dict]:
    """List repos the authenticated user can push to (up to 100)."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{_GITHUB_API}/user/repos",
            headers=_headers(token),
            params={"sort": "updated", "per_page": 100, "affiliation": "owner,collaborator"},
        )
        _check_auth(resp)
        _check_rate_limit(resp)
        resp.raise_for_status()
        return [
            {
                "full_name": r["full_name"],
                "name": r["name"],
                "private": r["private"],
                "default_branch": r.get("default_branch", "main"),
                "html_url": r["html_url"],
            }
            for r in resp.json()
            if r.get("permissions", {}).get("push", False)
        ]


async def push_file_to_github(
    token: str,
    repo: str,
    branch: str,
    path: str,
    content: str,
    commit_message: str,
) -> dict:
    """
    Create or update a file on GitHub via the Contents API.

    Returns: {"sha": "...", "html_url": "..."}
    Raises: GitHubAuthError, GitHubRateLimitError, GitHubConflictError
    """
    api_url = f"{_GITHUB_API}/repos/{repo}/contents/{path}"
    headers = _headers(token)

    async with httpx.AsyncClient(timeout=30) as client:
        # 1. Check if file already exists (to get SHA for updates)
        existing = await client.get(api_url, headers=headers, params={"ref": branch})
        _check_auth(existing)
        _check_rate_limit(existing)

        sha = None
        if existing.status_code == 200:
            sha = existing.json().get("sha")
        elif existing.status_code != 404:
            existing.raise_for_status()

        # 2. Build payload
        payload: dict = {
            "message": commit_message,
            "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
            "branch": branch,
        }
        if sha:
            payload["sha"] = sha

        # 3. Push (PUT)
        resp = await client.put(api_url, headers=headers, json=payload)
        _check_auth(resp)
        _check_rate_limit(resp)

        # Handle SHA conflict — retry once with fresh SHA
        if resp.status_code == 409 or (resp.status_code == 422 and "sha" in resp.text.lower()):
            fresh = await client.get(api_url, headers=headers, params={"ref": branch})
            if fresh.status_code == 200:
                payload["sha"] = fresh.json().get("sha")
                resp = await client.put(api_url, headers=headers, json=payload)
                _check_auth(resp)
                _check_rate_limit(resp)
            else:
                raise GitHubConflictError()

        if resp.status_code not in {200, 201}:
            if resp.status_code == 409:
                raise GitHubConflictError()
            resp.raise_for_status()

        data = resp.json()
        return {
            "sha": data.get("commit", {}).get("sha", ""),
            "html_url": data.get("content", {}).get("html_url", ""),
        }


# ── File Generation Helpers ───────────────────────────────────────────

LANGUAGE_EXTENSIONS: dict[str, str] = {
    "python": ".py",
    "py": ".py",
    "cpp": ".cpp",
    "c++": ".cpp",
    "c": ".c",
    "java": ".java",
    "javascript": ".js",
    "js": ".js",
    "typescript": ".ts",
    "ts": ".ts",
    "go": ".go",
    "rust": ".rs",
    "sql": ".sql",
    "ruby": ".rb",
    "swift": ".swift",
    "kotlin": ".kt",
    "scala": ".scala",
    "php": ".php",
    "csharp": ".cs",
    "c#": ".cs",
    "r": ".r",
    "dart": ".dart",
}

# Comment prefixes per file extension
_COMMENT_STYLES: dict[str, tuple[str, str, str]] = {
    # (line_prefix, block_start, block_end)
    ".py": ("#", '"""', '"""'),
    ".rb": ("#", "=begin", "=end"),
    ".r": ("#", "#", "#"),
    ".cpp": ("//", "/*", "*/"),
    ".c": ("//", "/*", "*/"),
    ".java": ("//", "/*", "*/"),
    ".js": ("//", "/*", "*/"),
    ".ts": ("//", "/*", "*/"),
    ".go": ("//", "/*", "*/"),
    ".rs": ("//", "/*", "*/"),
    ".swift": ("//", "/*", "*/"),
    ".kt": ("//", "/*", "*/"),
    ".scala": ("//", "/*", "*/"),
    ".cs": ("//", "/*", "*/"),
    ".php": ("//", "/*", "*/"),
    ".dart": ("//", "/*", "*/"),
    ".sql": ("--", "/*", "*/"),
}


def extension_for_language(language: str | None) -> str:
    """Map a language name to its file extension."""
    clean = (language or "").strip().lower()
    return LANGUAGE_EXTENSIONS.get(clean, ".txt")


def slug(value: str) -> str:
    """Convert a string to a URL/path-safe slug."""
    clean = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return clean or "untitled"


def build_solution_path(
    problem_title: str,
    language: str,
    topic: str = "general",
    platform: str = "leetcode",
) -> str:
    """
    Build the file path within the GitHub repo.

    CodeShelf-Solutions/
      leetcode/
        {topic}/
          {problem-title}.{ext}
    """
    ext = extension_for_language(language)
    return str(
        PurePosixPath("CodeShelf-Solutions")
        / slug(platform)
        / slug(topic)
        / f"{slug(problem_title)}{ext}"
    )


def _comment_prefix(ext: str) -> str:
    """Get the single-line comment prefix for a file extension."""
    style = _COMMENT_STYLES.get(ext)
    return style[0] if style else "#"


def render_header_comment(
    ext: str,
    problem_title: str,
    url: str = "",
    difficulty: str = "",
    tags: list[str] | None = None,
    approach: str = "",
    mistake: str = "",
) -> str:
    """
    Generate a decorated header comment block for the solution file.

    Adapts comment syntax to the file's language.
    """
    prefix = _comment_prefix(ext)
    sep = f"{prefix} {'=' * 58}"

    lines = [
        sep,
        f"{prefix}  CodeShelf — LeetCode Solution",
        sep,
        f"{prefix}  Problem:    {problem_title}",
    ]
    if url:
        lines.append(f"{prefix}  URL:        {url}")
    if difficulty:
        lines.append(f"{prefix}  Difficulty: {difficulty.capitalize()}")
    if tags:
        lines.append(f"{prefix}  Tags:       {', '.join(tags)}")
    if approach:
        # Wrap long approach text across lines
        for i, chunk in enumerate(approach.split("\n")):
            label = "Approach:  " if i == 0 else "           "
            lines.append(f"{prefix}  {label}{chunk.strip()}")
    if mistake:
        for i, chunk in enumerate(mistake.split("\n")):
            label = "Mistakes:  " if i == 0 else "           "
            lines.append(f"{prefix}  {label}{chunk.strip()}")
    lines.append(sep)
    lines.append("")

    return "\n".join(lines)


def render_solution_file(
    code: str,
    language: str,
    problem_title: str,
    url: str = "",
    difficulty: str = "",
    tags: list[str] | None = None,
    approach: str = "",
    mistake: str = "",
) -> str:
    """
    Generate the full file content: header comment + solution code.
    """
    ext = extension_for_language(language)
    header = render_header_comment(
        ext=ext,
        problem_title=problem_title,
        url=url,
        difficulty=difficulty,
        tags=tags,
        approach=approach,
        mistake=mistake,
    )
    # Ensure code ends with a newline
    code_body = code.rstrip() + "\n" if code else ""
    return header + code_body
