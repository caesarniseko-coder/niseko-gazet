"""Supabase REST client for Haystack pipeline data."""

import httpx
import structlog
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

logger = structlog.get_logger()

_headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def _url(table: str) -> str:
    return f"{SUPABASE_URL}/rest/v1/{table}"


async def _request(method: str, table: str, **kwargs) -> dict | list | None:
    """Make an authenticated request to Supabase REST API."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.request(method, _url(table), headers=_headers, **kwargs)
        resp.raise_for_status()
        if resp.status_code == 204:
            return None
        return resp.json()


# ── Source Feeds ───────────────────────────────────────


async def get_active_sources(source_type: Optional[str] = None) -> list[dict]:
    """Get all active source feeds, optionally filtered by type."""
    params = {"is_active": "eq.true", "order": "last_fetched_at.asc.nullsfirst"}
    if source_type:
        params["source_type"] = f"eq.{source_type}"
    return await _request("GET", "source_feeds", params=params) or []


async def update_source_fetched(source_id: str, error: Optional[str] = None) -> None:
    """Update a source feed's last_fetched_at timestamp."""
    data = {
        "last_fetched_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if error:
        data["last_error"] = error
        # Increment consecutive errors via a separate read+write
    else:
        data["last_error"] = None
        data["consecutive_errors"] = 0

    await _request(
        "PATCH",
        f"source_feeds?id=eq.{source_id}",
        json=data,
    )


# ── Crawl History ──────────────────────────────────────


async def check_duplicate(content_fingerprint: str) -> Optional[dict]:
    """Check if a content fingerprint already exists in crawl history."""
    result = await _request(
        "GET",
        "crawl_history",
        params={
            "content_fingerprint": f"eq.{content_fingerprint}",
            "select": "id,source_url,field_note_id",
            "limit": "1",
        },
    )
    return result[0] if result else None


async def record_crawl(
    source_feed_id: str,
    source_url: str,
    content_fingerprint: str,
    pipeline_run_id: str,
    raw_data: dict,
    status: str = "processed",
    relevance_score: Optional[float] = None,
    was_relevant: bool = False,
    was_duplicate: bool = False,
    classification_data: Optional[dict] = None,
    field_note_id: Optional[str] = None,
    moderation_item_id: Optional[str] = None,
    error_message: Optional[str] = None,
) -> dict:
    """Record a crawled article in history."""
    data = {
        "id": str(uuid4()),
        "source_feed_id": source_feed_id,
        "source_url": source_url,
        "content_fingerprint": content_fingerprint,
        "pipeline_run_id": pipeline_run_id,
        "raw_data": raw_data,
        "status": status,
        "relevance_score": relevance_score,
        "was_relevant": was_relevant,
        "was_duplicate": was_duplicate,
        "classification_data": classification_data,
        "field_note_id": field_note_id,
        "moderation_item_id": moderation_item_id,
        "error_message": error_message,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await _request("POST", "crawl_history", json=data)
    return result[0] if isinstance(result, list) else result


# ── Pipeline Runs ──────────────────────────────────────


async def create_run(run_type: str) -> dict:
    """Create a new pipeline run record."""
    data = {
        "id": str(uuid4()),
        "run_type": run_type,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "stats": {},
        "errors": [],
        "sources_polled": [],
    }
    result = await _request("POST", "pipeline_runs", json=data)
    return result[0] if isinstance(result, list) else result


async def complete_run(
    run_id: str,
    stats: dict,
    errors: list,
    sources_polled: list[str],
    status: str = "completed",
) -> None:
    """Mark a pipeline run as completed."""
    await _request(
        "PATCH",
        f"pipeline_runs?id=eq.{run_id}",
        json={
            "status": status,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "stats": stats,
            "errors": errors,
            "sources_polled": sources_polled,
        },
    )


async def get_recent_runs(limit: int = 20) -> list[dict]:
    """Get recent pipeline runs."""
    return await _request(
        "GET",
        "pipeline_runs",
        params={"order": "started_at.desc", "limit": str(limit)},
    ) or []


async def get_run_by_id(run_id: str) -> Optional[dict]:
    """Get a specific pipeline run."""
    result = await _request(
        "GET",
        "pipeline_runs",
        params={"id": f"eq.{run_id}"},
    )
    return result[0] if result else None


# ── Moderation Queue ──────────────────────────────────


async def create_moderation_item(
    content: str,
    item_type: str = "haystack_flagged",
    metadata: dict | None = None,
) -> dict:
    """Insert a flagged article into the moderation queue."""
    data = {
        "id": str(uuid4()),
        "type": item_type,
        "content": content,
        "status": "pending",
        "metadata": metadata or {},
    }
    result = await _request("POST", "moderation_queue", json=data)
    return result[0] if isinstance(result, list) else result


# ── Health Check ───────────────────────────────────────


async def check_health() -> dict:
    """Check Supabase connectivity."""
    try:
        await _request("GET", "pipeline_runs", params={"limit": "1"})
        return {"status": "connected"}
    except Exception as e:
        return {"status": "error", "error": str(e)}
