"""Tests for Haystack collection agents."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock


MOCK_SOURCE = {
    "id": "test-source-001",
    "name": "Test Source",
    "source_type": "rss",
    "url": "https://example.com/feed.xml",
    "config": {"max_entries": 5},
    "reliability_tier": "standard",
    "default_topics": ["tourism"],
    "default_geo_tags": ["niseko"],
}


# ── RSS Agent Tests ───────────────────────────────────


RSS_FEED_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Test Feed</title>
<item>
  <title>Snow Report: 20cm Fresh Powder</title>
  <description>Niseko received 20cm of fresh powder overnight.</description>
  <link>https://example.com/snow-report</link>
  <pubDate>Mon, 10 Feb 2025 08:00:00 GMT</pubDate>
  <author>Reporter One</author>
</item>
<item>
  <title>New Restaurant Opens</title>
  <description>A new ramen shop opened in Hirafu.</description>
  <link>https://example.com/restaurant</link>
  <pubDate>Mon, 10 Feb 2025 09:00:00 GMT</pubDate>
</item>
</channel>
</rss>"""


@pytest.mark.asyncio
async def test_rss_agent_collects():
    from agents.rss_agent import RSSAgent

    agent = RSSAgent()
    mock_resp = MagicMock()
    mock_resp.text = RSS_FEED_XML
    mock_resp.raise_for_status = MagicMock()

    with patch("agents.rss_agent.httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_instance.get.return_value = mock_resp

        articles, errors = await agent.collect([MOCK_SOURCE])

    assert len(articles) == 2
    assert len(errors) == 0
    assert articles[0]["title"] == "Snow Report: 20cm Fresh Powder"
    assert "fresh powder" in articles[0]["body"].lower()
    assert articles[0]["source_id"] == "test-source-001"


@pytest.mark.asyncio
async def test_rss_agent_handles_error():
    from agents.rss_agent import RSSAgent

    agent = RSSAgent()

    with patch("agents.rss_agent.httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_instance.get.side_effect = Exception("Connection timeout")

        articles, errors = await agent.collect([MOCK_SOURCE])

    assert len(articles) == 0
    assert len(errors) == 1
    assert "timeout" in errors[0]["error"].lower()


# ── Scraper Agent Tests ───────────────────────────────


MOCK_HTML = """<html>
<body>
<article>
  <h2><a href="/story/1">Ski Season Update</a></h2>
  <p>The ski season is in full swing at Niseko United.</p>
  <time datetime="2025-02-10T10:00:00Z">Feb 10</time>
</article>
<article>
  <h2><a href="/story/2">Community Event</a></h2>
  <p>Annual snow festival coming next week.</p>
</article>
</body>
</html>"""


@pytest.mark.asyncio
async def test_scraper_agent_collects():
    from agents.scraper_agent import ScraperAgent

    source = {**MOCK_SOURCE, "source_type": "scrape"}
    agent = ScraperAgent()

    mock_resp = MagicMock()
    mock_resp.text = MOCK_HTML
    mock_resp.raise_for_status = MagicMock()

    with patch("agents.scraper_agent.httpx.AsyncClient") as mock_client, \
         patch("agents.scraper_agent.is_allowed", return_value=True), \
         patch("agents.scraper_agent.get_crawl_delay", return_value=None), \
         patch("agents.scraper_agent.rate_limiter") as mock_limiter:
        mock_instance = AsyncMock()
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_instance.get.return_value = mock_resp
        mock_limiter.acquire = AsyncMock()

        articles, errors = await agent.collect([source])

    assert len(errors) == 0
    assert len(articles) >= 1
    assert any("Ski Season" in a["title"] for a in articles)


@pytest.mark.asyncio
async def test_scraper_respects_robots():
    from agents.scraper_agent import ScraperAgent

    source = {**MOCK_SOURCE, "source_type": "scrape"}
    agent = ScraperAgent()

    with patch("agents.scraper_agent.is_allowed", return_value=False), \
         patch("agents.scraper_agent.get_crawl_delay", return_value=None), \
         patch("agents.scraper_agent.rate_limiter") as mock_limiter:
        mock_limiter.acquire = AsyncMock()
        articles, errors = await agent.collect([source])

    assert len(articles) == 0
    assert len(errors) == 0  # Not an error, just skipped


# ── API Agent Tests ───────────────────────────────────


@pytest.mark.asyncio
async def test_api_agent_weather():
    from agents.api_agent import APIAgent

    source = {
        **MOCK_SOURCE,
        "source_type": "api",
        "config": {"api_type": "openweather", "lat": 42.86, "lon": 140.69},
    }
    agent = APIAgent()

    weather_data = {
        "weather": [{"description": "heavy snow"}],
        "main": {"temp": -5, "feels_like": -10, "humidity": 90},
        "wind": {"speed": 5},
        "snow": {"1h": 10, "3h": 25},
        "id": 2128983,
    }

    mock_resp = MagicMock()
    mock_resp.json.return_value = weather_data
    mock_resp.raise_for_status = MagicMock()

    with patch("agents.api_agent.OPENWEATHER_API_KEY", "test-key"), \
         patch("agents.api_agent.httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_instance.get.return_value = mock_resp

        articles, errors = await agent.collect([source])

    assert len(articles) == 1
    assert len(errors) == 0
    assert "Heavy Snow" in articles[0]["title"]
    assert "Snowfall" in articles[0]["body"]


@pytest.mark.asyncio
async def test_api_agent_no_key():
    from agents.api_agent import APIAgent

    source = {**MOCK_SOURCE, "source_type": "api", "config": {"api_type": "openweather"}}
    agent = APIAgent()

    with patch("agents.api_agent.OPENWEATHER_API_KEY", ""):
        articles, errors = await agent.collect([source])

    assert len(articles) == 0
    assert len(errors) == 0  # No error, just skipped
