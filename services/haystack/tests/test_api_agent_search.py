"""Tests for search API handlers (Tavily, Brave, Currents, GNews)."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock


MOCK_SEARCH_SOURCE = {
    "id": "search-source-001",
    "name": "Test Search Source",
    "source_type": "api",
    "url": "https://example.com",
    "config": {"api_type": "tavily", "query": "Niseko snow"},
    "reliability_tier": "standard",
    "default_topics": ["tourism"],
    "default_geo_tags": ["niseko"],
}


def _make_mock_client(resp_data):
    """Helper to create a mocked httpx.AsyncClient."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = resp_data
    mock_resp.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get.return_value = mock_resp
    mock_client.post.return_value = mock_resp
    return mock_client


# ── Feature Flag Tests ─────────────────────────────────


@pytest.mark.asyncio
async def test_tavily_disabled_when_flag_off():
    from agents.api_agent import APIAgent

    source = {**MOCK_SEARCH_SOURCE, "config": {"api_type": "tavily"}}
    agent = APIAgent()

    with patch("agents.api_agent.CONTENT_AGGREGATION_ENABLED", False), \
         patch("agents.api_agent.TAVILY_API_KEY", "test-key"):
        articles, errors = await agent.collect([source])

    assert len(articles) == 0
    assert len(errors) == 0


@pytest.mark.asyncio
async def test_brave_disabled_when_flag_off():
    from agents.api_agent import APIAgent

    source = {**MOCK_SEARCH_SOURCE, "config": {"api_type": "brave"}}
    agent = APIAgent()

    with patch("agents.api_agent.CONTENT_AGGREGATION_ENABLED", False), \
         patch("agents.api_agent.BRAVE_SEARCH_API_KEY", "test-key"):
        articles, errors = await agent.collect([source])

    assert len(articles) == 0
    assert len(errors) == 0


# ── Missing API Key Tests ──────────────────────────────


@pytest.mark.asyncio
async def test_tavily_no_key():
    from agents.api_agent import APIAgent

    source = {**MOCK_SEARCH_SOURCE, "config": {"api_type": "tavily"}}
    agent = APIAgent()

    with patch("agents.api_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.api_agent.TAVILY_API_KEY", ""):
        articles, errors = await agent.collect([source])

    assert len(articles) == 0


@pytest.mark.asyncio
async def test_currents_no_key():
    from agents.api_agent import APIAgent

    source = {**MOCK_SEARCH_SOURCE, "config": {"api_type": "currents"}}
    agent = APIAgent()

    with patch("agents.api_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.api_agent.CURRENTS_API_KEY", ""):
        articles, errors = await agent.collect([source])

    assert len(articles) == 0


# ── Tavily Handler ─────────────────────────────────────


TAVILY_RESPONSE = {
    "results": [
        {
            "title": "Niseko Snow Conditions Update",
            "url": "https://example.com/niseko-snow",
            "content": "Fresh powder dumped overnight in Niseko bringing 30cm.",
            "score": 0.95,
            "published_date": "2025-02-10T08:00:00Z",
        },
        {
            "title": "Hokkaido Tourism Boom",
            "url": "https://example.com/tourism",
            "content": "Record visitor numbers at Niseko resorts.",
            "score": 0.82,
        },
    ]
}


@pytest.mark.asyncio
async def test_tavily_collects():
    from agents.api_agent import APIAgent

    source = {**MOCK_SEARCH_SOURCE, "config": {"api_type": "tavily", "query": "Niseko snow"}}
    agent = APIAgent()
    mock_client = _make_mock_client(TAVILY_RESPONSE)

    with patch("agents.api_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.api_agent.TAVILY_API_KEY", "tvly-test-key"), \
         patch("agents.api_agent.httpx.AsyncClient", return_value=mock_client):
        articles, errors = await agent.collect([source])

    assert len(articles) == 2
    assert len(errors) == 0
    assert articles[0]["title"] == "Niseko Snow Conditions Update"
    assert articles[0]["raw_metadata"]["api_type"] == "tavily"
    assert articles[0]["raw_metadata"]["score"] == 0.95
    assert articles[0]["source_id"] == "search-source-001"


# ── Brave Handler ──────────────────────────────────────


BRAVE_RESPONSE = {
    "web": {
        "results": [
            {
                "title": "Best Niseko Ski Runs",
                "url": "https://example.com/ski-runs",
                "description": "Guide to the best ski runs in Niseko this season.",
                "page_age": "2025-02-09",
            },
        ]
    }
}


@pytest.mark.asyncio
async def test_brave_collects():
    from agents.api_agent import APIAgent

    source = {**MOCK_SEARCH_SOURCE, "config": {"api_type": "brave"}}
    agent = APIAgent()
    mock_client = _make_mock_client(BRAVE_RESPONSE)

    with patch("agents.api_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.api_agent.BRAVE_SEARCH_API_KEY", "brave-test-key"), \
         patch("agents.api_agent.httpx.AsyncClient", return_value=mock_client):
        articles, errors = await agent.collect([source])

    assert len(articles) == 1
    assert articles[0]["title"] == "Best Niseko Ski Runs"
    assert articles[0]["raw_metadata"]["api_type"] == "brave"


# ── Currents Handler ───────────────────────────────────


CURRENTS_RESPONSE = {
    "news": [
        {
            "title": "Niseko Winter Festival Announced",
            "url": "https://example.com/festival",
            "description": "Annual winter festival returns to Niseko with new events.",
            "published": "2025-02-10T12:00:00+09:00",
            "author": "Hokkaido Times",
            "category": ["tourism"],
        },
    ]
}


@pytest.mark.asyncio
async def test_currents_collects():
    from agents.api_agent import APIAgent

    source = {**MOCK_SEARCH_SOURCE, "config": {"api_type": "currents"}}
    agent = APIAgent()
    mock_client = _make_mock_client(CURRENTS_RESPONSE)

    with patch("agents.api_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.api_agent.CURRENTS_API_KEY", "currents-test-key"), \
         patch("agents.api_agent.httpx.AsyncClient", return_value=mock_client):
        articles, errors = await agent.collect([source])

    assert len(articles) == 1
    assert articles[0]["title"] == "Niseko Winter Festival Announced"
    assert articles[0]["raw_metadata"]["api_type"] == "currents"
    assert articles[0]["author"] == "Hokkaido Times"


# ── GNews Handler ──────────────────────────────────────


GNEWS_RESPONSE = {
    "articles": [
        {
            "title": "Kutchan Town Approves New Development",
            "url": "https://example.com/kutchan",
            "description": "Town council approves hotel development near Hirafu.",
            "publishedAt": "2025-02-10T06:00:00Z",
            "source": {"name": "Japan Times"},
        },
        {
            "title": "",
            "url": "https://example.com/empty",
            "description": "Should be skipped.",
        },
    ]
}


@pytest.mark.asyncio
async def test_gnews_collects():
    from agents.api_agent import APIAgent

    source = {**MOCK_SEARCH_SOURCE, "config": {"api_type": "gnews"}}
    agent = APIAgent()
    mock_client = _make_mock_client(GNEWS_RESPONSE)

    with patch("agents.api_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.api_agent.GNEWS_API_KEY", "gnews-test-key"), \
         patch("agents.api_agent.httpx.AsyncClient", return_value=mock_client):
        articles, errors = await agent.collect([source])

    assert len(articles) == 1  # Empty title skipped
    assert articles[0]["title"] == "Kutchan Town Approves New Development"
    assert articles[0]["raw_metadata"]["api_type"] == "gnews"
    assert articles[0]["raw_metadata"]["source_name"] == "Japan Times"


@pytest.mark.asyncio
async def test_gnews_no_key():
    from agents.api_agent import APIAgent

    source = {**MOCK_SEARCH_SOURCE, "config": {"api_type": "gnews"}}
    agent = APIAgent()

    with patch("agents.api_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.api_agent.GNEWS_API_KEY", ""):
        articles, errors = await agent.collect([source])

    assert len(articles) == 0
