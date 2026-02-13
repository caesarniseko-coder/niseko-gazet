"""Source reliability scoring: tracks acceptance rates per source feed."""

import structlog

from db.client import _request

logger = structlog.get_logger()

# Reliability tiers and their default quality gate behavior
TIER_CONFIG = {
    "official": {
        "min_confidence_override": None,  # Uses global MIN_CONFIDENCE_SCORE
        "auto_approve": False,
        "force_moderation": False,
    },
    "standard": {
        "min_confidence_override": None,
        "auto_approve": False,
        "force_moderation": False,
    },
    "yellow_press": {
        "min_confidence_override": 60,  # Higher bar for yellow press
        "auto_approve": False,
        "force_moderation": True,  # Always route to moderation
    },
}


def get_tier_config(reliability_tier: str) -> dict:
    """Get quality gate configuration for a reliability tier."""
    return TIER_CONFIG.get(reliability_tier, TIER_CONFIG["standard"])


async def update_source_reliability(source_feed_id: str) -> None:
    """Recalculate reliability score for a source feed based on crawl history.

    Score = (articles that became field notes) / (total relevant articles) * 100
    Only considers the last 100 crawl records for the source.
    """
    try:
        # Count relevant articles from this source
        relevant = await _request(
            "GET",
            "crawl_history",
            params={
                "source_feed_id": f"eq.{source_feed_id}",
                "was_relevant": "eq.true",
                "select": "id,field_note_id",
                "order": "fetched_at.desc",
                "limit": "100",
            },
        )

        if not relevant:
            return

        total_relevant = len(relevant)
        total_published = sum(1 for r in relevant if r.get("field_note_id"))

        if total_relevant == 0:
            return

        score = round((total_published / total_relevant) * 100, 1)

        try:
            await _request(
                "PATCH",
                f"source_feeds?id=eq.{source_feed_id}",
                json={"reliability_score": score},
            )
        except Exception:
            # Column may not exist yet (migration 002 pending)
            logger.debug("reliability.column_missing", source_feed_id=source_feed_id[:8])

        logger.info(
            "reliability.updated",
            source_feed_id=source_feed_id[:8],
            score=score,
            published=total_published,
            relevant=total_relevant,
        )

    except Exception as e:
        logger.error(
            "reliability.update_failed",
            source_feed_id=source_feed_id[:8],
            error=str(e),
        )
