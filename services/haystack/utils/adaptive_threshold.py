"""Adaptive relevance thresholds: learn from editorial acceptance rates per topic.

Topics with high acceptance get lower thresholds (more articles pass).
Topics with low acceptance get higher thresholds (fewer articles pass).

Threshold adjustments are bounded: MIN_RELEVANCE_SCORE ± 0.15
"""

import structlog
from collections import defaultdict

from config import MIN_RELEVANCE_SCORE
from db.client import _request

logger = structlog.get_logger()

# Adjustment bounds
MAX_ADJUSTMENT = 0.15
MIN_THRESHOLD = 0.15
MAX_THRESHOLD = 0.80

# Cached thresholds (refreshed periodically)
_topic_thresholds: dict[str, float] = {}


async def refresh_topic_thresholds() -> dict[str, float]:
    """Recalculate per-topic relevance thresholds from crawl history.

    Logic:
    - For each topic, calculate: acceptance_rate = published / total_relevant
    - High acceptance (>60%): lower threshold by up to 0.15
    - Low acceptance (<20%): raise threshold by up to 0.15
    - Medium acceptance (20-60%): keep default

    Only considers topics with at least 10 data points.
    """
    global _topic_thresholds

    try:
        records = await _request(
            "GET",
            "crawl_history",
            params={
                "was_relevant": "eq.true",
                "select": "classification_data,field_note_id",
                "order": "fetched_at.desc",
                "limit": "1000",
            },
        ) or []

        if not records:
            _topic_thresholds = {}
            return {}

        # Count per-topic: total relevant and total published
        topic_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "published": 0})

        for record in records:
            classification = record.get("classification_data") or {}
            topics = classification.get("topics", [])
            is_published = record.get("field_note_id") is not None

            for topic in topics:
                topic_stats[topic]["total"] += 1
                if is_published:
                    topic_stats[topic]["published"] += 1

        # Calculate thresholds
        thresholds = {}
        for topic, stats in topic_stats.items():
            if stats["total"] < 10:
                continue  # Not enough data

            acceptance_rate = stats["published"] / stats["total"]

            if acceptance_rate > 0.6:
                # High acceptance → lower threshold (be more permissive)
                adjustment = -MAX_ADJUSTMENT * min(1.0, (acceptance_rate - 0.6) / 0.4)
            elif acceptance_rate < 0.2:
                # Low acceptance → raise threshold (be more selective)
                adjustment = MAX_ADJUSTMENT * min(1.0, (0.2 - acceptance_rate) / 0.2)
            else:
                adjustment = 0.0

            threshold = MIN_RELEVANCE_SCORE + adjustment
            threshold = max(MIN_THRESHOLD, min(MAX_THRESHOLD, threshold))
            thresholds[topic] = round(threshold, 3)

        _topic_thresholds = thresholds

        logger.info(
            "adaptive_threshold.refreshed",
            topics=len(thresholds),
            adjustments={t: f"{v:.3f}" for t, v in thresholds.items() if v != MIN_RELEVANCE_SCORE},
        )

        return thresholds

    except Exception as e:
        logger.error("adaptive_threshold.refresh_failed", error=str(e))
        return _topic_thresholds


def get_relevance_threshold(topics: list[str]) -> float:
    """Get the effective relevance threshold for a set of topics.

    Uses the LOWEST threshold among the article's topics (most permissive).
    Falls back to MIN_RELEVANCE_SCORE if no adaptive data.
    """
    if not _topic_thresholds or not topics:
        return MIN_RELEVANCE_SCORE

    applicable = [
        _topic_thresholds[t]
        for t in topics
        if t in _topic_thresholds
    ]

    if not applicable:
        return MIN_RELEVANCE_SCORE

    # Use the most permissive (lowest) threshold
    return min(applicable)
