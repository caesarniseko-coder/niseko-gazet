"""Archive node: records rejected/duplicate articles in crawl history."""

import structlog

from db.client import record_crawl
from graph.state import PipelineState

logger = structlog.get_logger()


async def archive_node(state: PipelineState) -> dict:
    """Archive rejected articles to crawl_history for dedup tracking.

    Even rejected articles get recorded so we don't re-process them
    in future pipeline runs.
    """
    rejected = state.get("rejected_articles", [])
    flagged = state.get("flagged_articles", [])
    run_id = state["run_id"]

    archived_count = 0

    # Archive rejected articles
    for article in rejected:
        raw = article["raw"]
        try:
            await record_crawl(
                source_feed_id=raw["source_id"],
                source_url=raw["source_url"],
                content_fingerprint=article["content_fingerprint"],
                pipeline_run_id=run_id,
                raw_data={
                    "title": raw["title"],
                    "body": raw["body"][:500],
                },
                status="rejected",
                relevance_score=article["relevance_score"],
                was_relevant=False,
                was_duplicate=article["is_duplicate"],
                classification_data={
                    "topics": article["topics"],
                    "reasoning": article["classification_reasoning"],
                },
            )
            archived_count += 1
        except Exception as e:
            logger.error(
                "archive.error",
                title=raw["title"][:60],
                error=str(e),
            )

    # Archive flagged articles (they go to moderation, but still track them)
    for article in flagged:
        raw = article["classified"]["raw"]
        classified = article["classified"]
        try:
            await record_crawl(
                source_feed_id=raw["source_id"],
                source_url=raw["source_url"],
                content_fingerprint=classified["content_fingerprint"],
                pipeline_run_id=run_id,
                raw_data={
                    "title": raw["title"],
                    "body": raw["body"][:500],
                },
                status="flagged",
                relevance_score=classified["relevance_score"],
                was_relevant=True,
                classification_data={
                    "topics": classified["topics"],
                    "risk_flags": [f.get("type") for f in article.get("risk_flags", [])],
                },
            )
        except Exception as e:
            logger.error(
                "archive.flagged_error",
                title=raw["title"][:60],
                error=str(e),
            )

    logger.info(
        "archive.done",
        rejected_archived=archived_count,
        flagged_archived=len(flagged),
    )

    return {
        "stats": {
            **state.get("stats", {}),
            "archived_count": archived_count,
        },
    }
