"""Tests for Phase 4 features: breaking news, tip ingester, cloud LLM fallback."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ── Breaking News Node Tests ─────────────────────────


@pytest.mark.asyncio
async def test_breaking_news_detects_breaking():
    from graph.nodes.breaking_news import breaking_news_node

    state = {
        "classified_articles": [
            {
                "priority": "breaking",
                "raw": {
                    "title": "Major Earthquake in Hokkaido",
                    "source_name": "NHK",
                    "source_url": "https://nhk.or.jp/quake",
                },
                "topics": ["safety"],
                "relevance_score": 0.95,
                "classification_reasoning": "Earthquake affecting Niseko area",
            },
            {
                "priority": "normal",
                "raw": {
                    "title": "Restaurant Review",
                    "source_name": "Blog",
                    "source_url": "https://blog.example.com/food",
                },
                "topics": ["food_dining"],
                "relevance_score": 0.6,
                "classification_reasoning": "Food review",
            },
        ],
        "stats": {"classified_count": 2},
    }

    with patch("graph.nodes.breaking_news._send_breaking_alert", new_callable=AsyncMock):
        result = await breaking_news_node(state)

    assert result["stats"]["breaking_count"] == 1


@pytest.mark.asyncio
async def test_breaking_news_noop_when_none():
    from graph.nodes.breaking_news import breaking_news_node

    state = {
        "classified_articles": [
            {
                "priority": "normal",
                "raw": {"title": "Normal Story"},
            },
        ],
        "stats": {},
    }

    result = await breaking_news_node(state)
    assert result == {}


@pytest.mark.asyncio
async def test_breaking_news_empty_classified():
    from graph.nodes.breaking_news import breaking_news_node

    result = await breaking_news_node({"classified_articles": [], "stats": {}})
    assert result == {}


# ── Tip Ingester Tests ────────────────────────────────


@pytest.mark.asyncio
async def test_tip_ingester_collects_approved_tips():
    from agents.tip_ingester import TipIngester

    mock_tips = [
        {
            "id": "tip-001",
            "content": "There's a new road closure on Route 5 near Kutchan",
            "submitter_email": "resident@example.com",
            "submitter_ip": "1.2.3.4",
            "related_story_id": None,
            "review_notes": "Verified by moderator",
            "metadata": {"source": "web_form"},
        },
    ]

    ingester = TipIngester()

    with patch("agents.tip_ingester._request", new_callable=AsyncMock) as mock_req:
        # First call: GET approved tips
        # Second call: PATCH to mark as ingested
        mock_req.side_effect = [mock_tips, None]

        articles, errors = await ingester.collect([])

    assert len(articles) == 1
    assert len(errors) == 0
    assert "road closure" in articles[0]["body"].lower()
    assert articles[0]["source_type"] == "tip"


@pytest.mark.asyncio
async def test_tip_ingester_skips_already_ingested():
    from agents.tip_ingester import TipIngester

    mock_tips = [
        {
            "id": "tip-002",
            "content": "Already processed tip",
            "metadata": {"ingested": True},
        },
    ]

    ingester = TipIngester()

    with patch("agents.tip_ingester._request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_tips
        articles, errors = await ingester.collect([])

    assert len(articles) == 0


@pytest.mark.asyncio
async def test_tip_ingester_handles_empty_queue():
    from agents.tip_ingester import TipIngester

    ingester = TipIngester()

    with patch("agents.tip_ingester._request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = []
        articles, errors = await ingester.collect([])

    assert len(articles) == 0
    assert len(errors) == 0


# ── Cloud LLM Fallback Tests ─────────────────────────


@pytest.mark.asyncio
async def test_generate_uses_ollama_primary():
    from llm.client import generate

    with patch("llm.client._generate_ollama", new_callable=AsyncMock) as mock_ollama:
        mock_ollama.return_value = "test response"
        result = await generate("test prompt")

    assert result == "test response"
    mock_ollama.assert_called_once()


@pytest.mark.asyncio
async def test_generate_falls_back_to_anthropic():
    import httpx
    from llm.client import generate

    with patch("llm.client._generate_ollama", new_callable=AsyncMock) as mock_ollama, \
         patch("llm.client._generate_anthropic", new_callable=AsyncMock) as mock_anthropic, \
         patch("llm.client.ANTHROPIC_API_KEY", "test-key"):
        mock_ollama.side_effect = httpx.ConnectError("Connection refused")
        mock_anthropic.return_value = "anthropic response"

        result = await generate("test prompt")

    assert result == "anthropic response"
    mock_anthropic.assert_called_once()


@pytest.mark.asyncio
async def test_generate_falls_back_to_openai():
    import httpx
    from llm.client import generate

    with patch("llm.client._generate_ollama", new_callable=AsyncMock) as mock_ollama, \
         patch("llm.client._generate_anthropic", new_callable=AsyncMock) as mock_anthropic, \
         patch("llm.client.ANTHROPIC_API_KEY", "test-key"), \
         patch("llm.client._generate_openai", new_callable=AsyncMock) as mock_openai, \
         patch("llm.client.OPENAI_API_KEY", "test-key"):
        mock_ollama.side_effect = httpx.ConnectError("Connection refused")
        mock_anthropic.side_effect = Exception("Anthropic error")
        mock_openai.return_value = "openai response"

        result = await generate("test prompt")

    assert result == "openai response"


@pytest.mark.asyncio
async def test_generate_raises_when_all_fail():
    import httpx
    from llm.client import generate

    with patch("llm.client._generate_ollama", new_callable=AsyncMock) as mock_ollama, \
         patch("llm.client.ANTHROPIC_API_KEY", ""), \
         patch("llm.client.OPENAI_API_KEY", ""):
        mock_ollama.side_effect = httpx.ConnectError("Connection refused")

        with pytest.raises(RuntimeError, match="All LLM providers unavailable"):
            await generate("test prompt")


# ── Collect Node Tip Cycle Test ───────────────────────


@pytest.mark.asyncio
async def test_collect_node_handles_tip_cycle_without_sources():
    """Tips cycle should work even without source_feeds records."""
    from graph.nodes.collect import collect_node

    state = {
        "_sources": [],
        "cycle_type": "tips",
    }

    with patch("graph.nodes.collect._agents") as mock_agents:
        mock_tip_agent = AsyncMock()
        mock_tip_agent.collect.return_value = ([], [])
        mock_agents.get.return_value = mock_tip_agent
        mock_agents.__contains__ = lambda self, key: key == "tip"
        mock_agents.__getitem__ = lambda self, key: mock_tip_agent

        result = await collect_node(state)

    assert "raw_articles" in result
