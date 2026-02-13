"""Breaking News detection node: identifies and alerts on high-priority stories."""

import structlog
import httpx
from datetime import datetime, timezone

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
from graph.state import PipelineState

logger = structlog.get_logger()


async def breaking_news_node(state: PipelineState) -> dict:
    """Detect breaking news articles and trigger alerts.

    Articles classified as priority="breaking" get:
    1. Logged as breaking news alerts
    2. A notification record in the moderation_queue for immediate editor attention
    3. Boosted confidence threshold (bypass quality gate minimum)

    This node passes articles through unchanged — it only adds side-effects.
    """
    classified = state.get("classified_articles", [])

    if not classified:
        return {}

    breaking_articles = [
        a for a in classified if a.get("priority") == "breaking"
    ]

    if not breaking_articles:
        return {}

    logger.warning(
        "breaking_news.detected",
        count=len(breaking_articles),
        titles=[a["raw"]["title"][:80] for a in breaking_articles],
    )

    # Create a moderation queue alert for each breaking article
    for article in breaking_articles:
        raw = article["raw"]
        try:
            await _send_breaking_alert(
                title=raw["title"],
                source_name=raw["source_name"],
                source_url=raw["source_url"],
                topics=article.get("topics", []),
                relevance_score=article.get("relevance_score", 0),
                reasoning=article.get("classification_reasoning", ""),
            )
        except Exception as e:
            logger.error("breaking_news.alert_failed", title=raw["title"][:60], error=str(e))

    return {
        "stats": {
            **state.get("stats", {}),
            "breaking_count": len(breaking_articles),
        },
    }


async def _send_breaking_alert(
    title: str,
    source_name: str,
    source_url: str,
    topics: list[str],
    relevance_score: float,
    reasoning: str,
) -> None:
    """Send a breaking news alert to the moderation queue."""
    from uuid import uuid4

    content = (
        f"🔴 BREAKING NEWS ALERT\n\n"
        f"Title: {title}\n"
        f"Source: {source_name}\n"
        f"URL: {source_url}\n"
        f"Topics: {', '.join(topics)}\n"
        f"Relevance: {relevance_score:.0%}\n\n"
        f"Classification: {reasoning}"
    )

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        await client.post(
            f"{SUPABASE_URL}/rest/v1/moderation_queue",
            headers=headers,
            json={
                "id": str(uuid4()),
                "type": "breaking_alert",
                "content": content,
                "status": "pending",
                "metadata": {
                    "alert_type": "breaking_news",
                    "title": title,
                    "source_name": source_name,
                    "source_url": source_url,
                    "topics": topics,
                    "relevance_score": relevance_score,
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                },
            },
        )

    logger.info("breaking_news.alert_sent", title=title[:60])
