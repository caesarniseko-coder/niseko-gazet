"""Topic trend detection: analyze crawl history for emerging patterns."""

import structlog
from collections import Counter
from datetime import datetime, timezone, timedelta

from db.client import _request

logger = structlog.get_logger()


async def get_topic_trends(hours: int = 24, min_count: int = 2) -> list[dict]:
    """Analyze recent crawl history for trending topics.

    Looks at classified articles from the last N hours and ranks topics
    by frequency. Returns topics with at least min_count occurrences.

    Args:
        hours: Time window to analyze (default: 24h)
        min_count: Minimum occurrences to be considered trending

    Returns:
        List of {"topic": str, "count": int, "sources": list[str], "trend": str}
        sorted by count descending.
    """
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    records = await _request(
        "GET",
        "crawl_history",
        params={
            "was_relevant": "eq.true",
            "fetched_at": f"gte.{since}",
            "select": "classification_data,source_feed_id",
            "order": "fetched_at.desc",
            "limit": "500",
        },
    ) or []

    if not records:
        return []

    # Count topics and track which sources mention them
    topic_counter: Counter[str] = Counter()
    topic_sources: dict[str, set[str]] = {}

    for record in records:
        classification = record.get("classification_data") or {}
        topics = classification.get("topics", [])
        source_id = record.get("source_feed_id", "unknown")

        for topic in topics:
            topic_counter[topic] += 1
            topic_sources.setdefault(topic, set()).add(source_id)

    # Build trending list
    trends = []
    for topic, count in topic_counter.most_common():
        if count < min_count:
            break

        source_count = len(topic_sources.get(topic, set()))

        # Trend classification based on source diversity and volume
        if source_count >= 3 and count >= 5:
            trend = "hot"
        elif source_count >= 2 or count >= 4:
            trend = "rising"
        else:
            trend = "steady"

        trends.append({
            "topic": topic,
            "count": count,
            "source_count": source_count,
            "trend": trend,
        })

    return trends


async def get_geo_trends(hours: int = 24) -> list[dict]:
    """Analyze recent crawl history for geographic hotspots.

    Returns geo_tags ranked by mention frequency.
    """
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    records = await _request(
        "GET",
        "crawl_history",
        params={
            "was_relevant": "eq.true",
            "fetched_at": f"gte.{since}",
            "select": "classification_data",
            "order": "fetched_at.desc",
            "limit": "500",
        },
    ) or []

    geo_counter: Counter[str] = Counter()

    for record in records:
        classification = record.get("classification_data") or {}
        geo_tags = classification.get("geo_tags", [])
        for tag in geo_tags:
            geo_counter[tag] += 1

    return [
        {"geo_tag": tag, "count": count}
        for tag, count in geo_counter.most_common(20)
    ]


async def get_source_stats() -> list[dict]:
    """Get per-source statistics for the admin dashboard."""
    sources = await _request(
        "GET",
        "source_feeds",
        params={
            "is_active": "eq.true",
            "select": "id,name,source_type,reliability_tier,reliability_score,last_fetched_at,consecutive_errors",
            "order": "name.asc",
        },
    ) or []

    result = []
    for source in sources:
        # Get recent crawl counts for this source
        recent = await _request(
            "GET",
            "crawl_history",
            params={
                "source_feed_id": f"eq.{source['id']}",
                "select": "id,was_relevant,field_note_id",
                "order": "fetched_at.desc",
                "limit": "50",
            },
        ) or []

        total = len(recent)
        relevant = sum(1 for r in recent if r.get("was_relevant"))
        published = sum(1 for r in recent if r.get("field_note_id"))

        result.append({
            "id": source["id"],
            "name": source["name"],
            "source_type": source["source_type"],
            "reliability_tier": source.get("reliability_tier", "standard"),
            "reliability_score": source.get("reliability_score", 50.0),
            "last_fetched_at": source.get("last_fetched_at"),
            "consecutive_errors": source.get("consecutive_errors", 0),
            "recent_crawled": total,
            "recent_relevant": relevant,
            "recent_published": published,
        })

    return result
