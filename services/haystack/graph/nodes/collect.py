"""Collection node: dispatches to agents and gathers raw articles."""

import structlog

from agents.rss_agent import RSSAgent
from agents.scraper_agent import ScraperAgent
from agents.api_agent import APIAgent
from agents.social_agent import SocialAgent
from agents.tip_ingester import TipIngester
from graph.state import PipelineState

logger = structlog.get_logger()

# Agent registry
_agents = {
    "rss": RSSAgent(),
    "scrape": ScraperAgent(),
    "api": APIAgent(),
    "social": SocialAgent(),
    "tip": TipIngester(),
}


async def collect_node(state: PipelineState) -> dict:
    """Run collection agents for the loaded sources.

    Groups sources by type and dispatches to the appropriate agent.
    Returns accumulated raw_articles and collection_errors.
    """
    sources = state.get("_sources", [])
    cycle_type = state.get("cycle_type", "main")

    # For tip cycles, the TipIngester doesn't need source_feeds records —
    # it pulls directly from the moderation queue. Ensure it runs even
    # when no source_feeds of type "tip" exist.
    if not sources and cycle_type == "tips":
        sources = [{"source_type": "tip", "id": "moderation_queue", "name": "User Tips"}]

    if not sources:
        logger.warning("collect.no_sources")
        return {"raw_articles": [], "collection_errors": []}

    # Group sources by type
    by_type: dict[str, list[dict]] = {}
    for source in sources:
        st = source.get("source_type", "rss")
        by_type.setdefault(st, []).append(source)

    all_articles = []
    all_errors = []

    for source_type, type_sources in by_type.items():
        agent = _agents.get(source_type)
        if not agent:
            logger.warning("collect.no_agent", source_type=source_type)
            for s in type_sources:
                all_errors.append({
                    "source_id": s.get("id"),
                    "source_name": s.get("name"),
                    "error": f"No agent for source_type={source_type}",
                })
            continue

        articles, errors = await agent.collect(type_sources)
        all_articles.extend(articles)
        all_errors.extend(errors)

    logger.info(
        "collect.done",
        articles=len(all_articles),
        errors=len(all_errors),
    )

    return {
        "raw_articles": all_articles,
        "collection_errors": all_errors,
    }
