"""LangGraph StateGraph pipeline definition for Haystack."""

import structlog
from uuid import uuid4

from langgraph.graph import StateGraph, START, END

from db.client import create_run, complete_run
from graph.state import PipelineState
from graph.nodes.scheduler import scheduler_node
from graph.nodes.collect import collect_node
from graph.nodes.dedup_classify import dedup_classify_node
from graph.nodes.enrich import enrich_node
from graph.nodes.quality_gate import quality_gate_node
from graph.nodes.field_note_creator import field_note_creator_node
from graph.nodes.moderation_sender import moderation_sender_node
from graph.nodes.breaking_news import breaking_news_node
from graph.nodes.archive import archive_node

logger = structlog.get_logger()


def _has_classified(state: PipelineState) -> str:
    """Route after classification: if articles remain, check for breaking news; otherwise archive."""
    if state.get("classified_articles"):
        return "breaking_check"
    return "archive"


def _route_after_quality_gate(state: PipelineState) -> str:
    """Route after quality gate to field note creation (first step)."""
    if state.get("approved_articles"):
        return "create_field_notes"
    if state.get("flagged_articles"):
        return "send_to_moderation"
    return "archive"


def _route_after_field_notes(state: PipelineState) -> str:
    """After creating field notes, check if flagged articles need moderation."""
    if state.get("flagged_articles"):
        return "send_to_moderation"
    return "archive"


# ── Build the graph ───────────────────────────────────

workflow = StateGraph(PipelineState)

# Add nodes
workflow.add_node("schedule", scheduler_node)
workflow.add_node("collect", collect_node)
workflow.add_node("classify", dedup_classify_node)
workflow.add_node("breaking_check", breaking_news_node)
workflow.add_node("enrich", enrich_node)
workflow.add_node("quality_gate", quality_gate_node)
workflow.add_node("create_field_notes", field_note_creator_node)
workflow.add_node("send_to_moderation", moderation_sender_node)
workflow.add_node("archive", archive_node)

# Wire edges
workflow.add_edge(START, "schedule")
workflow.add_edge("schedule", "collect")
workflow.add_edge("collect", "classify")

# After classify: breaking check if articles, else archive
workflow.add_conditional_edges(
    "classify",
    _has_classified,
    {
        "breaking_check": "breaking_check",
        "archive": "archive",
    },
)

workflow.add_edge("breaking_check", "enrich")
workflow.add_edge("enrich", "quality_gate")

# After quality gate: route to field notes, moderation, or archive
workflow.add_conditional_edges(
    "quality_gate",
    _route_after_quality_gate,
    {
        "create_field_notes": "create_field_notes",
        "send_to_moderation": "send_to_moderation",
        "archive": "archive",
    },
)

# After field notes: check if flagged articles also need moderation
workflow.add_conditional_edges(
    "create_field_notes",
    _route_after_field_notes,
    {
        "send_to_moderation": "send_to_moderation",
        "archive": "archive",
    },
)

# Moderation always leads to archive
workflow.add_edge("send_to_moderation", "archive")
workflow.add_edge("archive", END)

# Compile
pipeline = workflow.compile()


# ── Runner ────────────────────────────────────────────


async def run_pipeline(run_type: str = "manual", cycle_type: str = "main") -> dict:
    """Execute the full Haystack pipeline.

    Args:
        run_type: "scheduled", "manual", or "breaking"
        cycle_type: "main", "weather", "deep_scrape", "social", "tips"

    Returns:
        Final pipeline state dict with stats and created field notes.
    """
    # Create a pipeline run record
    run_record = await create_run(run_type)
    run_id = run_record["id"]

    logger.info(
        "pipeline.start",
        run_id=run_id,
        run_type=run_type,
        cycle_type=cycle_type,
    )

    initial_state = {
        "run_id": run_id,
        "run_type": run_type,
        "cycle_type": cycle_type,
        "raw_articles": [],
        "collection_errors": [],
        "classified_articles": [],
        "rejected_articles": [],
        "enriched_articles": [],
        "approved_articles": [],
        "flagged_articles": [],
        "created_field_notes": [],
        "stats": {},
        "sources_polled": [],
        "_sources": [],
    }

    try:
        # Run the graph
        result = await pipeline.ainvoke(initial_state)

        stats = result.get("stats", {})
        errors = result.get("collection_errors", [])
        sources = result.get("sources_polled", [])

        # Complete the run record
        await complete_run(
            run_id=run_id,
            stats=stats,
            errors=errors,
            sources_polled=sources,
            status="completed",
        )

        logger.info(
            "pipeline.complete",
            run_id=run_id,
            stats=stats,
            field_notes_created=len(result.get("created_field_notes", [])),
        )

        return result

    except Exception as e:
        logger.error("pipeline.failed", run_id=run_id, error=str(e))

        await complete_run(
            run_id=run_id,
            stats={"error": str(e)},
            errors=[{"error": str(e)}],
            sources_polled=[],
            status="failed",
        )
        raise
