"""Dedup & Classify node: fingerprint articles and classify relevance."""

import structlog

from config import MIN_RELEVANCE_SCORE
from db.client import check_duplicate, update_source_fetched
from llm.client import generate_json
from llm.prompts import CLASSIFY_SYSTEM, CLASSIFY_PROMPT, CLASSIFY_BATCH_PROMPT
from graph.state import PipelineState, ClassifiedArticle
from utils.fingerprint import simhash
from utils.text import truncate
from utils.cross_lang_dedup import check_cross_language_duplicate
from utils.adaptive_threshold import get_relevance_threshold

logger = structlog.get_logger()

BATCH_SIZE = 5  # Articles per LLM call


async def dedup_classify_node(state: PipelineState) -> dict:
    """Fingerprint articles for dedup, then classify relevance with LLM.

    1. Compute SimHash fingerprint for each article
    2. Check against crawl_history for duplicates
    3. Send non-duplicate articles to LLM in batches for relevance classification
    4. Split into classified (relevant) and rejected (irrelevant/duplicate)
    """
    raw_articles = state.get("raw_articles", [])

    if not raw_articles:
        return {"classified_articles": [], "rejected_articles": []}

    classified = []
    rejected = []

    # Phase 1: Dedup — filter out duplicates before any LLM calls
    to_classify: list[tuple[dict, str]] = []  # (article, fingerprint)

    for article in raw_articles:
        try:
            fingerprint = simhash(article["title"] + " " + article["body"])

            existing = await check_duplicate(fingerprint)
            if existing:
                logger.info("classify.duplicate", title=article["title"][:60])
                rejected.append(ClassifiedArticle(
                    raw=article, relevance_score=0.0, topics=[], geo_tags=[],
                    priority="low", is_duplicate=True,
                    duplicate_of=existing.get("field_note_id") or existing.get("id"),
                    content_fingerprint=fingerprint,
                    classification_reasoning="Duplicate content detected via SimHash",
                ))
                continue

            cross_lang = await check_cross_language_duplicate(
                title=article["title"], body=article["body"],
                language=article.get("language", "en"),
                source_url=article["source_url"],
                source_type=article.get("source_type", ""),
            )
            if cross_lang and cross_lang.get("is_duplicate"):
                logger.info("classify.cross_lang_duplicate", title=article["title"][:60])
                rejected.append(ClassifiedArticle(
                    raw=article, relevance_score=0.0, topics=[], geo_tags=[],
                    priority="low", is_duplicate=True,
                    duplicate_of=cross_lang.get("duplicate_of"),
                    content_fingerprint=fingerprint,
                    classification_reasoning=f"Cross-language duplicate: {cross_lang.get('reasoning', '')}",
                ))
                continue

            to_classify.append((article, fingerprint))

        except Exception as e:
            logger.error("classify.dedup_error", title=article.get("title", "?")[:60], error=str(e))
            rejected.append(ClassifiedArticle(
                raw=article, relevance_score=0.0, topics=[], geo_tags=[],
                priority="low", is_duplicate=False, duplicate_of=None,
                content_fingerprint=simhash(article.get("title", "") + article.get("body", "")),
                classification_reasoning=f"Dedup error: {str(e)}",
            ))

    # Phase 2: Batch LLM classification
    for batch_start in range(0, len(to_classify), BATCH_SIZE):
        batch = to_classify[batch_start:batch_start + BATCH_SIZE]

        try:
            results = await _classify_batch(batch)

            for (article, fingerprint), result in zip(batch, results):
                score = float(result.get("relevance_score", 0))
                topics = result.get("topics", [])
                ca = ClassifiedArticle(
                    raw=article, relevance_score=score, topics=topics,
                    geo_tags=result.get("geo_tags", []),
                    priority=result.get("priority", "normal"),
                    is_duplicate=False, duplicate_of=None,
                    content_fingerprint=fingerprint,
                    classification_reasoning=result.get("reasoning", ""),
                )

                threshold = get_relevance_threshold(topics)
                if score >= threshold:
                    classified.append(ca)
                else:
                    rejected.append(ca)

                logger.info(
                    "classify.result", title=article["title"][:60],
                    score=score, threshold=threshold, relevant=score >= threshold,
                )
                await update_source_fetched(article["source_id"])

        except Exception as e:
            logger.error("classify.batch_error", batch_size=len(batch), error=str(e))
            # Fallback: reject the entire batch
            for article, fingerprint in batch:
                rejected.append(ClassifiedArticle(
                    raw=article, relevance_score=0.0, topics=[], geo_tags=[],
                    priority="low", is_duplicate=False, duplicate_of=None,
                    content_fingerprint=fingerprint,
                    classification_reasoning=f"Batch classification error: {str(e)}",
                ))

    logger.info("classify.done", classified=len(classified), rejected=len(rejected))

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


async def _classify_batch(batch: list[tuple[dict, str]]) -> list[dict]:
    """Classify a batch of articles in a single LLM call.

    Falls back to individual classification if batch parsing fails.
    """
    if len(batch) == 1:
        article, _ = batch[0]
        prompt = CLASSIFY_PROMPT.format(
            title=article["title"],
            source_name=article["source_name"],
            source_type=article["source_type"],
            language=article.get("language", "en"),
            body=truncate(article["body"], 2000),
        )
        result = await generate_json(prompt, system=CLASSIFY_SYSTEM)
        return [result]

    # Build batch prompt
    articles_block = ""
    for i, (article, _) in enumerate(batch, 1):
        articles_block += (
            f"\n--- Article {i} ---\n"
            f"TITLE: {article['title']}\n"
            f"SOURCE: {article['source_name']} ({article['source_type']})\n"
            f"LANGUAGE: {article.get('language', 'en')}\n"
            f"BODY: {truncate(article['body'], 800)}\n"
        )

    prompt = CLASSIFY_BATCH_PROMPT.format(
        count=len(batch),
        articles_block=articles_block,
    )

    result = await generate_json(prompt, system=CLASSIFY_SYSTEM)

    # generate_json returns a dict or list; batch should return a list
    if isinstance(result, list) and len(result) == len(batch):
        return result

    # If the LLM returned a dict with a wrapping key, try to unwrap
    if isinstance(result, dict):
        for key in ("articles", "results", "classifications"):
            if key in result and isinstance(result[key], list):
                if len(result[key]) == len(batch):
                    return result[key]

    # Batch parse failed — fall back to individual calls
    logger.warning("classify.batch_parse_fallback", expected=len(batch), got=type(result).__name__)
    results = []
    for article, _ in batch:
        prompt = CLASSIFY_PROMPT.format(
            title=article["title"],
            source_name=article["source_name"],
            source_type=article["source_type"],
            language=article.get("language", "en"),
            body=truncate(article["body"], 2000),
        )
        r = await generate_json(prompt, system=CLASSIFY_SYSTEM)
        results.append(r)
    return results
