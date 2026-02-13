"""Field note creation via Supabase REST API.

Creates field notes directly in the database, bypassing the Next.js API.
This ensures field notes are created even when the web server isn't running.
"""

import structlog
from datetime import datetime, timezone
from uuid import uuid4

from db.client import _request

logger = structlog.get_logger()

# Haystack bot user ID (created by migration)
BOT_USER_ID = "b0000000-0000-0000-0000-000000000001"


async def create_field_note(
    what: str,
    who: str | None = None,
    when_occurred: str | None = None,
    where_location: str | None = None,
    why: str | None = None,
    how: str | None = None,
    quotes: list[dict] | None = None,
    evidence_refs: list[dict] | None = None,
    confidence_score: int = 0,
    safety_legal_flags: list[str] | None = None,
    raw_text: str | None = None,
    source_url: str | None = None,
) -> dict:
    """Create a field note directly in Supabase.

    This inserts into the field_notes table with status='raw' and
    author_id set to the Haystack bot user. The field note then enters
    the existing editorial pipeline (Field Note -> Cizer -> Story).
    """
    field_note_id = str(uuid4())

    data = {
        "id": field_note_id,
        "author_id": BOT_USER_ID,
        "what": what,
        "status": "raw",
        "confidence_score": confidence_score,
        "quotes": quotes or [],
        "evidence_refs": evidence_refs or [],
        "safety_legal_flags": safety_legal_flags or [],
        "contacts": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if who:
        data["who"] = who
    if when_occurred:
        data["when_occurred"] = when_occurred
    if where_location:
        data["where_location"] = where_location
    if why:
        data["why"] = why
    if how:
        data["how"] = how
    if raw_text:
        data["raw_text"] = raw_text

    result = await _request("POST", "field_notes", json=data)
    created = result[0] if isinstance(result, list) else result

    logger.info(
        "field_note.created",
        field_note_id=created.get("id"),
        what=what[:80],
        source_url=source_url,
    )

    return created
