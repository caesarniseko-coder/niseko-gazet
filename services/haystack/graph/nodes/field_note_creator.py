"""Field Note Creator node: creates field notes via the Next.js API."""

import structlog

from api_client.nextjs import create_field_note
from db.client import record_crawl
from graph.state import PipelineState
from utils.reliability import update_source_reliability

logger = structlog.get_logger()


async def field_note_creator_node(state: PipelineState) -> dict:
    """Create field notes from approved articles via the Next.js API.

    For each approved article:
    1. Map enriched data to field note format
    2. POST to /api/field-notes
    3. Record in crawl_history with field_note_id link
    """
    approved = state.get("approved_articles", [])

    if not approved:
        return {"created_field_notes": []}

    created = []

    for article in approved:
        raw = article["classified"]["raw"]
        classified = article["classified"]

        try:
            # Map risk flags to the API's expected format
            safety_flags = [
                flag["type"]
                for flag in article.get("risk_flags", [])
                if isinstance(flag, dict) and "type" in flag
            ]

            # Map quotes to API format
            quotes = [
                {
                    "speaker": q.get("speaker", "Unknown"),
                    "text": q.get("text", ""),
                    "context": q.get("context", ""),
                }
                for q in article.get("quotes", [])
                if q.get("text")
            ]

            # Map evidence refs
            evidence_refs = [
                {
                    "type": ref.get("type", "link"),
                    "url": ref.get("url", raw["source_url"]),
                    "description": ref.get("description", ""),
                }
                for ref in article.get("evidence_refs", [])
                if ref.get("url")
            ]

            # Always include original source as evidence
            evidence_refs.append({
                "type": "link",
                "url": raw["source_url"],
                "description": f"Original source: {raw['source_name']}",
            })

            # Create the field note
            field_note = await create_field_note(
                what=article["what"],
                who=article.get("who"),
                when_occurred=article.get("when_occurred"),
                where_location=article.get("where_location"),
                why=article.get("why"),
                how=article.get("how"),
                quotes=quotes if quotes else None,
                evidence_refs=evidence_refs,
                confidence_score=article.get("confidence_score", 0),
                safety_legal_flags=safety_flags if safety_flags else None,
                raw_text=raw["body"][:5000],
                source_url=raw["source_url"],
            )

            field_note_id = field_note.get("id")

            # Record in crawl history
            await record_crawl(
                source_feed_id=raw["source_id"],
                source_url=raw["source_url"],
                content_fingerprint=classified["content_fingerprint"],
                pipeline_run_id=state["run_id"],
                raw_data={
                    "title": raw["title"],
                    "body": raw["body"][:1000],
                    "source_name": raw["source_name"],
                },
                status="processed",
                relevance_score=classified["relevance_score"],
                was_relevant=True,
                was_duplicate=False,
                classification_data={
                    "topics": classified["topics"],
                    "geo_tags": classified["geo_tags"],
                    "priority": classified["priority"],
                },
                field_note_id=field_note_id,
            )

            created.append({
                "field_note_id": field_note_id,
                "headline": article["what"][:100],
                "source": raw["source_name"],
                "source_url": raw["source_url"],
            })

            logger.info(
                "field_note_creator.created",
                field_note_id=field_note_id,
                title=raw["title"][:60],
            )

            # Update source reliability score
            await update_source_reliability(raw["source_id"])

        except Exception as e:
            logger.error(
                "field_note_creator.error",
                title=raw["title"][:60],
                error=str(e),
            )
            # Record failed crawl
            try:
                await record_crawl(
                    source_feed_id=raw["source_id"],
                    source_url=raw["source_url"],
                    content_fingerprint=classified["content_fingerprint"],
                    pipeline_run_id=state["run_id"],
                    raw_data={"title": raw["title"]},
                    status="error",
                    relevance_score=classified["relevance_score"],
                    was_relevant=True,
                    error_message=str(e),
                )
            except Exception:
                pass

    return {
        "created_field_notes": created,
        "stats": {
            **state.get("stats", {}),
            "field_notes_created": len(created),
        },
    }
