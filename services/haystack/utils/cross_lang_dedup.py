"""Cross-language deduplication: detect when JA and EN articles cover the same story."""

import structlog

from db.client import _request
from llm.client import generate_json
from utils.text import truncate

logger = structlog.get_logger()

CROSS_LANG_SYSTEM = """You are a bilingual news deduplication engine. Given two articles in different languages, determine if they cover the SAME story/event.

Rules:
- Two articles about the same event are duplicates even if one is in Japanese and one in English
- Articles about different aspects of the same topic are NOT duplicates
- Focus on: same event, same date, same people/organizations, same location
- Respond with ONLY valid JSON."""

CROSS_LANG_PROMPT = """Are these two articles about the same story?

ARTICLE A ({lang_a}):
Title: {title_a}
Body: {body_a}

ARTICLE B ({lang_b}):
Title: {title_b}
Body: {body_b}

Respond with:
{{
  "is_same_story": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}}"""


async def check_cross_language_duplicate(
    title: str,
    body: str,
    language: str,
    source_url: str,
    source_type: str = "",
) -> dict | None:
    """Check if a new article duplicates a recent article in a different language.

    Only checks the last 24h of relevant crawl history. Uses LLM comparison
    for articles that might overlap. Skips social media posts since they
    rarely have cross-language duplicates.

    Args:
        title: Article title
        body: Article body text
        language: Language code ("en" or "ja")
        source_url: Source URL (to avoid self-matching)
        source_type: Source type (e.g. "social", "rss", "scrape")

    Returns:
        Dict with {"is_duplicate": True, "duplicate_of": id, "reasoning": str}
        or None if no cross-language duplicate found.
    """
    # Skip cross-language dedup for social media — Reddit/Bluesky posts
    # are almost never cross-language duplicates of news articles
    if source_type in ("social", "tip"):
        return None

    # Only check opposite-language articles
    other_lang = "ja" if language == "en" else "en"

    # Get recent relevant articles in the other language from crawl_history
    recent = await _request(
        "GET",
        "crawl_history",
        params={
            "was_relevant": "eq.true",
            "was_duplicate": "eq.false",
            "select": "id,raw_data,source_url,field_note_id",
            "order": "fetched_at.desc",
            "limit": "20",
        },
    ) or []

    if not recent:
        return None

    # Filter to other-language articles (check raw_data for language hint)
    candidates = []
    for record in recent:
        raw_data = record.get("raw_data", {}) or {}
        if record.get("source_url") == source_url:
            continue
        # We can't easily filter by language in the DB query since it's in raw_data
        # Just check the title for CJK characters as a proxy
        record_title = raw_data.get("title", "")
        has_cjk = any(0x3040 <= ord(c) <= 0x9FFF for c in record_title)

        if (other_lang == "ja" and has_cjk) or (other_lang == "en" and not has_cjk):
            candidates.append(record)

    if not candidates:
        return None

    # Only check the top 3 candidates to limit LLM calls
    for candidate in candidates[:3]:
        raw_data = candidate.get("raw_data", {}) or {}
        candidate_title = raw_data.get("title", "")
        candidate_body = raw_data.get("body", "")

        if not candidate_title:
            continue

        try:
            prompt = CROSS_LANG_PROMPT.format(
                lang_a=language,
                title_a=title,
                body_a=truncate(body, 800),
                lang_b=other_lang,
                title_b=candidate_title,
                body_b=truncate(candidate_body, 800),
            )

            result = await generate_json(prompt, system=CROSS_LANG_SYSTEM)

            if result.get("is_same_story") and result.get("confidence", 0) >= 0.7:
                logger.info(
                    "cross_lang_dedup.match",
                    title=title[:60],
                    match_title=candidate_title[:60],
                    confidence=result.get("confidence"),
                )
                return {
                    "is_duplicate": True,
                    "duplicate_of": candidate.get("field_note_id") or candidate.get("id"),
                    "reasoning": result.get("reasoning", "Cross-language duplicate"),
                }

        except Exception as e:
            logger.error("cross_lang_dedup.error", error=str(e))
            continue

    return None
