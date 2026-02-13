"""Tests for Haystack pipeline nodes."""

import pytest
from unittest.mock import AsyncMock, patch


# ── Quality Gate Tests ────────────────────────────────


def _make_enriched(confidence=70, risk_flags=None, what="Something happened"):
    return {
        "what": what,
        "who": "Test Person",
        "when_occurred": "2025-02-10",
        "where_location": "Niseko",
        "why": "Testing",
        "how": "Via test",
        "confidence_score": confidence,
        "risk_flags": risk_flags or [],
        "quotes": [],
        "evidence_refs": [],
        "fact_check_notes": [],
        "source_log": [],
        "classified": {
            "raw": {
                "title": "Test Article",
                "source_id": "src-001",
                "source_url": "https://example.com/test",
                "source_name": "Test",
                "body": "Test body",
                "raw_metadata": {},
            },
            "relevance_score": 0.8,
            "topics": ["tourism"],
            "geo_tags": ["niseko"],
            "priority": "normal",
            "content_fingerprint": "abc123",
        },
    }


@pytest.mark.asyncio
async def test_quality_gate_approves():
    from graph.nodes.quality_gate import quality_gate_node

    state = {
        "enriched_articles": [_make_enriched(confidence=75)],
        "stats": {},
    }
    result = await quality_gate_node(state)

    assert len(result["approved_articles"]) == 1
    assert len(result["flagged_articles"]) == 0


@pytest.mark.asyncio
async def test_quality_gate_flags_high_risk():
    from graph.nodes.quality_gate import quality_gate_node

    state = {
        "enriched_articles": [
            _make_enriched(
                confidence=80,
                risk_flags=[{"type": "minor_involved", "detail": "test"}],
            )
        ],
        "stats": {},
    }
    result = await quality_gate_node(state)

    assert len(result["approved_articles"]) == 0
    assert len(result["flagged_articles"]) == 1


@pytest.mark.asyncio
async def test_quality_gate_flags_low_confidence():
    from graph.nodes.quality_gate import quality_gate_node

    state = {
        "enriched_articles": [_make_enriched(confidence=20)],
        "stats": {},
    }
    result = await quality_gate_node(state)

    assert len(result["approved_articles"]) == 0
    assert len(result["flagged_articles"]) == 1


@pytest.mark.asyncio
async def test_quality_gate_rejects_missing_data():
    from graph.nodes.quality_gate import quality_gate_node

    state = {
        "enriched_articles": [_make_enriched(confidence=5, what="")],
        "stats": {},
    }
    result = await quality_gate_node(state)

    assert len(result["approved_articles"]) == 0
    assert len(result["flagged_articles"]) == 0


# ── Pipeline Routing Tests ────────────────────────────


def test_has_classified_routes_to_breaking_check():
    from graph.pipeline import _has_classified
    assert _has_classified({"classified_articles": [{"foo": 1}]}) == "breaking_check"


def test_has_classified_routes_to_archive():
    from graph.pipeline import _has_classified
    assert _has_classified({"classified_articles": []}) == "archive"


def test_quality_gate_routing_approved():
    from graph.pipeline import _route_after_quality_gate
    state = {"approved_articles": [{}], "flagged_articles": []}
    assert _route_after_quality_gate(state) == "create_field_notes"


def test_quality_gate_routing_flagged_only():
    from graph.pipeline import _route_after_quality_gate
    state = {"approved_articles": [], "flagged_articles": [{}]}
    assert _route_after_quality_gate(state) == "send_to_moderation"


def test_quality_gate_routing_neither():
    from graph.pipeline import _route_after_quality_gate
    state = {"approved_articles": [], "flagged_articles": []}
    assert _route_after_quality_gate(state) == "archive"


def test_after_field_notes_routes_to_moderation():
    from graph.pipeline import _route_after_field_notes
    state = {"flagged_articles": [{}]}
    assert _route_after_field_notes(state) == "send_to_moderation"


def test_after_field_notes_routes_to_archive():
    from graph.pipeline import _route_after_field_notes
    state = {"flagged_articles": []}
    assert _route_after_field_notes(state) == "archive"
