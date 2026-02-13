"""Enrichment node: 5W1H extraction, risk analysis, fact-check."""

import structlog

from llm.client import generate_json
from llm.prompts import ENRICH_SYSTEM, ENRICH_PROMPT
from llm.translate import translate_article
from graph.state import PipelineState, EnrichedArticle

logger = structlog.get_logger()


async def enrich_node(state: PipelineState) -> dict:
    """Enrich classified articles with 5W1H structure, risk flags, and fact-check.

    Takes each classified article and runs it through the LLM to extract:
    - 5W1H structured information
    - Direct quotes
    - Evidence references
    - Risk flags
    - Fact-check notes
    - Confidence score
    """
    classified = state.get("classified_articles", [])

    if not classified:
        return {"enriched_articles": []}

    enriched = []

    translated_count = 0

    for article in classified:
        raw = article["raw"]

        try:
            # Translate Japanese articles to English before enrichment
            title_for_enrich = raw["title"]
            body_for_enrich = raw["body"]

            if raw.get("language") == "ja":
                translation = await translate_article(raw["title"], raw["body"])
                title_for_enrich = translation["title_en"]
                body_for_enrich = translation["body_en"]
                translated_count += 1
                logger.info(
                    "enrich.translated",
                    original_title=raw["title"][:40],
                    english_title=title_for_enrich[:60],
                )

            prompt = ENRICH_PROMPT.format(
                title=title_for_enrich,
                source_name=raw["source_name"],
                language=raw.get("language", "en"),
                published_at=raw.get("published_at") or "Unknown",
                body=body_for_enrich,
            )

            result = await generate_json(prompt, system=ENRICH_SYSTEM)

            enriched_article = EnrichedArticle(
                classified=article,
                who=result.get("who"),
                what=result.get("what", raw["title"]),
                when_occurred=result.get("when_occurred"),
                where_location=result.get("where_location"),
                why=result.get("why"),
                how=result.get("how"),
                quotes=result.get("quotes", []),
                evidence_refs=result.get("evidence_refs", []),
                risk_flags=result.get("risk_flags", []),
                fact_check_notes=result.get("fact_check_notes", []),
                confidence_score=int(result.get("confidence_score", 50)),
                source_log=[{
                    "source_name": raw["source_name"],
                    "source_url": raw["source_url"],
                    "source_type": raw["source_type"],
                    "fetched_at": raw["fetched_at"],
                }],
            )
            enriched.append(enriched_article)

            logger.info(
                "enrich.done",
                title=raw["title"][:60],
                confidence=enriched_article["confidence_score"],
                risk_flags=len(enriched_article["risk_flags"]),
            )

        except Exception as e:
            logger.error(
                "enrich.error",
                title=raw["title"][:60],
                error=str(e),
            )
            # Create a minimal enriched article on error
            enriched.append(EnrichedArticle(
                classified=article,
                who=None,
                what=raw["title"],
                when_occurred=raw.get("published_at"),
                where_location=None,
                why=None,
                how=None,
                quotes=[],
                evidence_refs=[],
                risk_flags=[],
                fact_check_notes=[],
                confidence_score=10,
                source_log=[{
                    "source_name": raw["source_name"],
                    "source_url": raw["source_url"],
                    "source_type": raw["source_type"],
                    "fetched_at": raw["fetched_at"],
                    "enrichment_error": str(e),
                }],
            ))

    return {
        "enriched_articles": enriched,
        "stats": {
            **state.get("stats", {}),
            "enriched_count": len(enriched),
            "translated_count": translated_count,
        },
    }
