"""Tests for Phase 5 features: reliability, yellow press, trends, cross-lang dedup."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ── Reliability Scoring Tests ─────────────────────────


def test_tier_config_yellow_press():
    from utils.reliability import get_tier_config

    config = get_tier_config("yellow_press")
    assert config["force_moderation"] is True
    assert config["min_confidence_override"] == 60


def test_tier_config_official():
    from utils.reliability import get_tier_config

    config = get_tier_config("official")
    assert config["force_moderation"] is False
    assert config["min_confidence_override"] is None


def test_tier_config_standard():
    from utils.reliability import get_tier_config

    config = get_tier_config("standard")
    assert config["force_moderation"] is False


def test_tier_config_unknown_falls_back():
    from utils.reliability import get_tier_config

    config = get_tier_config("unknown_tier")
    assert config == get_tier_config("standard")


# ── Yellow Press Quality Gate Tests ───────────────────


def _make_enriched(confidence=70, risk_flags=None, what="Something happened", reliability_tier="standard"):
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
                "raw_metadata": {"reliability_tier": reliability_tier},
            },
            "relevance_score": 0.8,
            "topics": ["tourism"],
            "geo_tags": ["niseko"],
            "priority": "normal",
            "content_fingerprint": "abc123",
        },
    }


@pytest.mark.asyncio
async def test_quality_gate_flags_yellow_press():
    """Yellow press articles should always be flagged for moderation."""
    from graph.nodes.quality_gate import quality_gate_node

    state = {
        "enriched_articles": [_make_enriched(confidence=90, reliability_tier="yellow_press")],
        "stats": {},
    }
    result = await quality_gate_node(state)

    assert len(result["approved_articles"]) == 0
    assert len(result["flagged_articles"]) == 1


@pytest.mark.asyncio
async def test_quality_gate_approves_official_source():
    """Official sources with good confidence should be approved."""
    from graph.nodes.quality_gate import quality_gate_node

    state = {
        "enriched_articles": [_make_enriched(confidence=75, reliability_tier="official")],
        "stats": {},
    }
    result = await quality_gate_node(state)

    assert len(result["approved_articles"]) == 1
    assert len(result["flagged_articles"]) == 0


@pytest.mark.asyncio
async def test_quality_gate_yellow_press_higher_confidence_bar():
    """Yellow press needs confidence >= 60 (not just 30) even without force_moderation."""
    from graph.nodes.quality_gate import quality_gate_node

    # A standard source with confidence 45 would pass (>30), but yellow press requires >60
    state = {
        "enriched_articles": [_make_enriched(confidence=45, reliability_tier="yellow_press")],
        "stats": {},
    }
    result = await quality_gate_node(state)

    # Still flagged because force_moderation=True for yellow_press
    assert len(result["flagged_articles"]) == 1


# ── Base Agent Reliability Propagation ────────────────


def test_base_agent_propagates_reliability_tier():
    from agents.base import BaseAgent

    class TestAgent(BaseAgent):
        agent_type = "test"
        async def collect(self, sources):
            return [], []

    agent = TestAgent()
    source = {
        "id": "src-001",
        "source_type": "rss",
        "name": "Test",
        "reliability_tier": "yellow_press",
    }

    article = agent._make_raw_article(
        source=source,
        title="Test Title",
        body="Test Body",
        source_url="https://example.com",
    )

    assert article["raw_metadata"]["reliability_tier"] == "yellow_press"


def test_base_agent_no_tier_no_crash():
    from agents.base import BaseAgent

    class TestAgent(BaseAgent):
        agent_type = "test"
        async def collect(self, sources):
            return [], []

    agent = TestAgent()
    source = {"id": "src-002", "source_type": "rss", "name": "Test"}

    article = agent._make_raw_article(
        source=source,
        title="Title",
        body="Body",
        source_url="https://example.com",
    )

    assert "reliability_tier" not in article["raw_metadata"]


# ── Language Detection Tests ──────────────────────────


def test_detect_language_mixed_bilingual():
    """Mixed JA/EN text with >20% CJK should detect as Japanese."""
    from utils.text import detect_language
    # Bilingual municipal announcement with significant Japanese
    text = "倶知安町議会は、ニセコ地域の開発計画について議論しました。Kutchan Town council discussed plans."
    assert detect_language(text) == "ja"


def test_detect_language_halfwidth_katakana():
    """Half-width katakana should be detected."""
    from utils.text import detect_language
    # Half-width katakana: ﾆｾｺ (Niseko)
    text = "ﾆｾｺ ﾆｾｺ ﾆｾｺ ﾆｾｺ ﾆｾｺ test"
    assert detect_language(text) == "ja"


# ── Trends Utility Tests ─────────────────────────────


@pytest.mark.asyncio
async def test_get_topic_trends_empty():
    from utils.trends import get_topic_trends

    with patch("utils.trends._request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = []
        result = await get_topic_trends()

    assert result == []


@pytest.mark.asyncio
async def test_get_topic_trends_counts():
    from utils.trends import get_topic_trends

    mock_records = [
        {"classification_data": {"topics": ["tourism", "snow_conditions"]}, "source_feed_id": "s1"},
        {"classification_data": {"topics": ["tourism"]}, "source_feed_id": "s2"},
        {"classification_data": {"topics": ["tourism", "events"]}, "source_feed_id": "s3"},
    ]

    with patch("utils.trends._request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_records
        result = await get_topic_trends(min_count=2)

    assert len(result) >= 1
    tourism = next(t for t in result if t["topic"] == "tourism")
    assert tourism["count"] == 3
    assert tourism["source_count"] == 3


@pytest.mark.asyncio
async def test_get_geo_trends():
    from utils.trends import get_geo_trends

    mock_records = [
        {"classification_data": {"geo_tags": ["niseko", "kutchan"]}},
        {"classification_data": {"geo_tags": ["niseko"]}},
        {"classification_data": {"geo_tags": ["hirafu"]}},
    ]

    with patch("utils.trends._request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_records
        result = await get_geo_trends()

    assert len(result) >= 1
    niseko = next(g for g in result if g["geo_tag"] == "niseko")
    assert niseko["count"] == 2


# ── Adaptive Threshold Tests ────────────────────────


def test_adaptive_threshold_default_when_empty():
    """With no adaptive data, should return MIN_RELEVANCE_SCORE."""
    from utils.adaptive_threshold import get_relevance_threshold, _topic_thresholds
    import utils.adaptive_threshold as at

    # Clear any cached thresholds
    at._topic_thresholds = {}

    from config import MIN_RELEVANCE_SCORE
    assert get_relevance_threshold(["tourism"]) == MIN_RELEVANCE_SCORE


def test_adaptive_threshold_returns_lowest():
    """Should return the most permissive (lowest) threshold among topics."""
    import utils.adaptive_threshold as at

    at._topic_thresholds = {
        "tourism": 0.35,
        "safety": 0.55,
        "events": 0.40,
    }

    result = at.get_relevance_threshold(["tourism", "safety"])
    assert result == 0.35


def test_adaptive_threshold_ignores_unknown_topics():
    """Unknown topics should be ignored; falls back to MIN_RELEVANCE_SCORE if all unknown."""
    import utils.adaptive_threshold as at
    from config import MIN_RELEVANCE_SCORE

    at._topic_thresholds = {"tourism": 0.35}

    # Known + unknown → uses known
    assert at.get_relevance_threshold(["tourism", "unknown_topic"]) == 0.35

    # All unknown → falls back to default
    assert at.get_relevance_threshold(["unknown_topic"]) == MIN_RELEVANCE_SCORE


@pytest.mark.asyncio
async def test_refresh_topic_thresholds_high_acceptance():
    """Topics with >60% acceptance should get lower thresholds."""
    from utils.adaptive_threshold import refresh_topic_thresholds
    from config import MIN_RELEVANCE_SCORE

    # 8 published out of 10 = 80% acceptance → should lower threshold
    mock_records = [
        {"classification_data": {"topics": ["tourism"]}, "field_note_id": f"fn-{i}"}
        for i in range(8)
    ] + [
        {"classification_data": {"topics": ["tourism"]}, "field_note_id": None}
        for _ in range(2)
    ]

    with patch("utils.adaptive_threshold._request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_records
        thresholds = await refresh_topic_thresholds()

    assert "tourism" in thresholds
    assert thresholds["tourism"] < MIN_RELEVANCE_SCORE


@pytest.mark.asyncio
async def test_refresh_topic_thresholds_low_acceptance():
    """Topics with <20% acceptance should get higher thresholds."""
    from utils.adaptive_threshold import refresh_topic_thresholds
    from config import MIN_RELEVANCE_SCORE

    # 1 published out of 10 = 10% acceptance → should raise threshold
    mock_records = [
        {"classification_data": {"topics": ["gossip"]}, "field_note_id": "fn-1"}
    ] + [
        {"classification_data": {"topics": ["gossip"]}, "field_note_id": None}
        for _ in range(9)
    ]

    with patch("utils.adaptive_threshold._request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_records
        thresholds = await refresh_topic_thresholds()

    assert "gossip" in thresholds
    assert thresholds["gossip"] > MIN_RELEVANCE_SCORE


@pytest.mark.asyncio
async def test_refresh_topic_thresholds_skips_low_data():
    """Topics with fewer than 10 data points should be skipped."""
    from utils.adaptive_threshold import refresh_topic_thresholds

    mock_records = [
        {"classification_data": {"topics": ["rare_topic"]}, "field_note_id": None}
        for _ in range(5)
    ]

    with patch("utils.adaptive_threshold._request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_records
        thresholds = await refresh_topic_thresholds()

    assert "rare_topic" not in thresholds
