"""Dedup & Classify node: fingerprint articles and classify relevance."""

import structlog

from config import MIN_RELEVANCE_SCORE
from db.client import check_duplicate, update_source_fetched
from llm.client import generate_json
from llm.prompts import CLASSIFY_SYSTEM, CLASSIFY_PROMPT
from graph.state import PipelineState, ClassifiedArticle
from utils.fingerprint import simhash
from utils.text import truncate
from utils.cross_lang_dedup import check_cross_language_duplicate
from utils.adaptive_threshold import get_relevance_threshold

logger = structlog.get_logger()


async def dedup_classify_node(state: PipelineState) -> dict:
    """Fingerprint articles for dedup, then classify relevance with LLM.

    1. Compute SimHash fingerprint for each article
    2. Check against crawl_history for duplicates
    3. Send non-duplicate articles to LLM for relevance classification
    4. Split into classified (relevant) and rejected (irrelevant/duplicate)
    """
    raw_articles = state.get("raw_articles", [])

    if not raw_articles:
        return {"classified_articles": [], "rejected_articles": []}

    classified = []
    rejected = []

    for article in raw_articles:
        try:
            # Step 1: Fingerprint
            fingerprint = simhash(article["title"] + " " + article["body"])

            # Step 2: Check for duplicates (SimHash — same language)
            existing = await check_duplicate(fingerprint)
            if existing:
                logger.info(
                    "classify.duplicate",
                    title=article["title"][:60],
                    existing_id=existing.get("id"),
                )
                rejected.append(ClassifiedArticle(
                    raw=article,
                    relevance_score=0.0,
                    topics=[],
                    geo_tags=[],
                    priority="low",
                    is_duplicate=True,
                    duplicate_of=existing.get("field_note_id") or existing.get("id"),
                    content_fingerprint=fingerprint,
                    classification_reasoning="Duplicate content detected via SimHash",
                ))
                continue

            # Step 2b: Cross-language dedup (JA↔EN)
            cross_lang = await check_cross_language_duplicate(
                title=article["title"],
                body=article["body"],
                language=article.get("language", "en"),
                source_url=article["source_url"],
            )
            if cross_lang and cross_lang.get("is_duplicate"):
                logger.info(
                    "classify.cross_lang_duplicate",
                    title=article["title"][:60],
                    duplicate_of=cross_lang.get("duplicate_of"),
                )
                rejected.append(ClassifiedArticle(
                    raw=article,
                    relevance_score=0.0,
                    topics=[],
                    geo_tags=[],
                    priority="low",
                    is_duplicate=True,
                    duplicate_of=cross_lang.get("duplicate_of"),
                    content_fingerprint=fingerprint,
                    classification_reasoning=f"Cross-language duplicate: {cross_lang.get('reasoning', '')}",
                ))
                continue

            # Step 3: LLM classification
            prompt = CLASSIFY_PROMPT.format(
                title=article["title"],
                source_name=article["source_name"],
                source_type=article["source_type"],
                language=article.get("language", "en"),
                body=truncate(article["body"], 2000),
            )

            result = await generate_json(prompt, system=CLASSIFY_SYSTEM)

            score = float(result.get("relevance_score", 0))
            topics = result.get("topics", [])
            classified_article = ClassifiedArticle(
                raw=article,
                relevance_score=score,
                topics=topics,
                geo_tags=result.get("geo_tags", []),
                priority=result.get("priority", "normal"),
                is_duplicate=False,
                duplicate_of=None,
                content_fingerprint=fingerprint,
                classification_reasoning=result.get("reasoning", ""),
            )

            # Step 4: Route based on adaptive relevance threshold
            threshold = get_relevance_threshold(topics)
            if score >= threshold:
                classified.append(classified_article)
            else:
                rejected.append(classified_article)

            logger.info(
                "classify.result",
                title=article["title"][:60],
                score=score,
                threshold=threshold,
                relevant=score >= threshold,
            )

            # Update source fetch timestamp
            await update_source_fetched(article["source_id"])

        except Exception as e:
            logger.error(
                "classify.error",
                title=article.get("title", "?")[:60],
                error=str(e),
            )
            # On error, still record the article as rejected
            rejected.append(ClassifiedArticle(
                raw=article,
                relevance_score=0.0,
                topics=[],
                geo_tags=[],
                priority="low",
                is_duplicate=False,
                duplicate_of=None,
                content_fingerprint=simhash(article.get("title", "") + article.get("body", "")),
                classification_reasoning=f"Classification error: {str(e)}",
            ))

    logger.info(
        "classify.done",
        classified=len(classified),
        rejected=len(rejected),
    )

    return {
        "classified_articles": classified,
        "rejected_articles": rejected,
        "stats": {
            **state.get("stats", {}),
            "raw_count": len(raw_articles),
            "classified_count": len(classified),
            "rejected_count": len(rejected),
        },
    }
