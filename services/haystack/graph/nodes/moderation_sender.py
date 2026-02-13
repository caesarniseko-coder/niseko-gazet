"""Moderation Sender node: sends flagged articles to moderation queue."""

import json
import structlog

from db.client import create_moderation_item, record_crawl
from graph.state import PipelineState

logger = structlog.get_logger()


async def moderation_sender_node(state: PipelineState) -> dict:
    """Send flagged articles to the moderation queue for human review.

    Flagged articles have either:
    - High-risk flags (minor_involved, allegation, etc.)
    - Low confidence scores below threshold
    """
    flagged = state.get("flagged_articles", [])
    run_id = state.get("run_id", "")

    if not flagged:
        return {}

    sent_count = 0

    for article in flagged:
        classified = article.get("classified", {})
        raw = classified.get("raw", {})
        title = raw.get("title", "Untitled")

        # Build human-readable content for moderator
        risk_flags = article.get("risk_flags", [])
        risk_summary = ", ".join(
            f.get("type", "unknown") for f in risk_flags
        ) if risk_flags else "low confidence"

        content = (
            f"**{title}**\n\n"
            f"Source: {raw.get('source_name', 'Unknown')} — {raw.get('source_url', '')}\n"
            f"Confidence: {article.get('confidence_score', 0)}/100\n"
            f"Risk flags: {risk_summary}\n\n"
            f"**What:** {article.get('what', 'N/A')}\n"
            f"**Who:** {article.get('who', 'N/A')}\n"
            f"**Where:** {article.get('where_location', 'N/A')}\n"
        )

        metadata = {
            "pipeline_run_id": run_id,
            "source_id": raw.get("source_id"),
            "source_url": raw.get("source_url"),
            "confidence_score": article.get("confidence_score"),
            "risk_flags": [f.get("type") for f in risk_flags],
            "topics": classified.get("topics", []),
            "geo_tags": classified.get("geo_tags", []),
            "enriched_data": {
                "what": article.get("what"),
                "who": article.get("who"),
                "when_occurred": article.get("when_occurred"),
                "where_location": article.get("where_location"),
                "why": article.get("why"),
                "how": article.get("how"),
            },
        }

        try:
            mod_item = await create_moderation_item(
                content=content,
                item_type="haystack_flagged",
                metadata=metadata,
            )
            mod_id = mod_item.get("id")

            # Record in crawl history with moderation_item_id
            fingerprint = classified.get("content_fingerprint", "")
            if fingerprint:
                await record_crawl(
                    source_feed_id=raw.get("source_id", ""),
                    source_url=raw.get("source_url", ""),
                    content_fingerprint=fingerprint,
                    pipeline_run_id=run_id,
                    raw_data=raw.get("raw_metadata", {}),
                    status="flagged",
                    relevance_score=classified.get("relevance_score"),
                    was_relevant=True,
                    classification_data={
                        "topics": classified.get("topics", []),
                        "priority": classified.get("priority"),
                    },
                    moderation_item_id=mod_id,
                )

            sent_count += 1
            logger.info(
                "moderation.sent",
                title=title[:60],
                moderation_id=mod_id,
                risk_flags=risk_summary,
            )

        except Exception as e:
            logger.error(
                "moderation.send_failed",
                title=title[:60],
                error=str(e),
            )

    logger.info("moderation_sender.done", sent=sent_count, total=len(flagged))

    return {
        "stats": {
            **state.get("stats", {}),
            "moderation_sent_count": sent_count,
        },
    }
