"""Scheduler node: reads source_feeds and determines what to poll."""

import structlog

from db.client import get_active_sources
from graph.state import PipelineState
from utils.adaptive_threshold import refresh_topic_thresholds

logger = structlog.get_logger()


async def scheduler_node(state: PipelineState) -> dict:
    """Load active sources from the database based on cycle type.

    Maps cycle_type to source_type filters:
    - main: rss + scrape
    - weather: api (weather sources)
    - deep_scrape: scrape (slow/heavy sources)
    - social: social
    - tips: tip
    """
    cycle_type = state["cycle_type"]

    # Refresh adaptive relevance thresholds from editorial history
    await refresh_topic_thresholds()

    source_type_map = {
        "main": ["rss", "scrape"],
        "weather": ["api"],
        "deep_scrape": ["scrape"],
        "social": ["social"],
        "tips": ["tip"],
    }

    source_types = source_type_map.get(cycle_type, ["rss"])
    all_sources = []

    for st in source_types:
        sources = await get_active_sources(source_type=st)
        all_sources.extend(sources)

    source_names = [s.get("name", "?") for s in all_sources]
    logger.info(
        "scheduler.sources_loaded",
        cycle_type=cycle_type,
        count=len(all_sources),
        sources=source_names,
    )

    return {
        "sources_polled": source_names,
        "stats": {**state.get("stats", {}), "sources_polled": len(all_sources)},
        "_sources": all_sources,  # Internal: passed to collector
    }
