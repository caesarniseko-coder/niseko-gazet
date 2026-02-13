"""Tests for Social media agent (Reddit, Bluesky)."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock


MOCK_REDDIT_SOURCE = {
    "id": "social-reddit-001",
    "name": "Reddit r/niseko",
    "source_type": "social",
    "url": "https://www.reddit.com/r/niseko",
    "config": {"platform": "reddit", "subreddit": "niseko", "max_entries": 10},
    "reliability_tier": "yellow_press",
    "default_topics": ["community"],
    "default_geo_tags": ["niseko"],
}

MOCK_BLUESKY_SOURCE = {
    "id": "social-bsky-001",
    "name": "Bluesky Niseko",
    "source_type": "social",
    "url": "https://bsky.app",
    "config": {
        "platform": "bluesky",
        "query": "niseko",
        "actors": ["niseko.fan.bsky.social", "hokkaido.news.bsky.social"],
        "max_entries": 10,
    },
    "reliability_tier": "yellow_press",
    "default_topics": ["community"],
    "default_geo_tags": ["niseko"],
}


def _make_mock_client(resp_data):
    """Create mock httpx client returning a single response for all GETs."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = resp_data
    mock_resp.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get.return_value = mock_resp
    return mock_client


def _make_mock_client_multi(responses: list):
    """Create mock httpx client returning different responses per call."""
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mock_resps = []
    for data in responses:
        r = MagicMock()
        r.json.return_value = data
        r.raise_for_status = MagicMock()
        mock_resps.append(r)

    mock_client.get.side_effect = mock_resps
    return mock_client


# ── Feature Flag ──────────────────────────────────────


@pytest.mark.asyncio
async def test_social_disabled_when_flag_off():
    from agents.social_agent import SocialAgent

    agent = SocialAgent()

    with patch("agents.social_agent.CONTENT_AGGREGATION_ENABLED", False):
        articles, errors = await agent.collect([MOCK_REDDIT_SOURCE])

    assert len(articles) == 0
    assert len(errors) == 0


# ── Reddit ────────────────────────────────────────────


REDDIT_RESPONSE = {
    "data": {
        "children": [
            {
                "kind": "t3",
                "data": {
                    "title": "Amazing powder day at Niseko today!",
                    "selftext": "Just had the best run of the season. 30cm fresh overnight.",
                    "permalink": "/r/niseko/comments/abc123/amazing_powder_day/",
                    "author": "ski_lover_42",
                    "score": 47,
                    "num_comments": 12,
                    "created_utc": 1707552000,
                },
            },
            {
                "kind": "t3",
                "data": {
                    "title": "Restaurant recommendations near Hirafu?",
                    "selftext": "Looking for good ramen shops.",
                    "permalink": "/r/niseko/comments/def456/restaurant_recs/",
                    "author": "foodie_jp",
                    "score": 15,
                    "num_comments": 8,
                    "created_utc": 1707548400,
                },
            },
            {
                "kind": "t3",
                "data": {
                    "title": "",
                    "selftext": "empty title should be skipped",
                    "permalink": "/r/niseko/comments/ghi789/empty/",
                },
            },
        ]
    }
}


@pytest.mark.asyncio
async def test_reddit_collects():
    from agents.social_agent import SocialAgent

    agent = SocialAgent()
    mock_client = _make_mock_client(REDDIT_RESPONSE)

    with patch("agents.social_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.social_agent.httpx.AsyncClient", return_value=mock_client):
        articles, errors = await agent.collect([MOCK_REDDIT_SOURCE])

    assert len(articles) == 2  # Empty title skipped
    assert len(errors) == 0
    assert articles[0]["title"] == "Amazing powder day at Niseko today!"
    assert articles[0]["author"] == "ski_lover_42"
    assert articles[0]["raw_metadata"]["platform"] == "reddit"
    assert articles[0]["raw_metadata"]["reliability_tier"] == "yellow_press"
    assert articles[0]["raw_metadata"]["score"] == 47
    assert articles[0]["source_id"] == "social-reddit-001"
    assert "/r/niseko/" in articles[0]["source_url"]


@pytest.mark.asyncio
async def test_reddit_reliability_tier_always_yellow_press():
    from agents.social_agent import SocialAgent

    agent = SocialAgent()
    mock_client = _make_mock_client(REDDIT_RESPONSE)

    with patch("agents.social_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.social_agent.httpx.AsyncClient", return_value=mock_client):
        articles, errors = await agent.collect([MOCK_REDDIT_SOURCE])

    for article in articles:
        assert article["raw_metadata"]["reliability_tier"] == "yellow_press"


# ── Bluesky ───────────────────────────────────────────

# getAuthorFeed returns {feed: [{post: {...}}, ...]}
BLUESKY_FEED_RESPONSE_1 = {
    "feed": [
        {
            "post": {
                "uri": "at://did:plc:abc123/app.bsky.feed.post/rkey1",
                "author": {
                    "handle": "niseko.fan.bsky.social",
                    "displayName": "Niseko Fan",
                },
                "record": {
                    "text": "Beautiful morning in Niseko! Fresh snow everywhere. #niseko #powder",
                    "createdAt": "2025-02-10T08:00:00Z",
                },
                "likeCount": 23,
                "repostCount": 5,
            },
        },
        {
            "post": {
                "uri": "at://did:plc:abc123/app.bsky.feed.post/rkey3",
                "author": {
                    "handle": "niseko.fan.bsky.social",
                    "displayName": "Niseko Fan",
                },
                "record": {"text": ""},
            },
        },
    ]
}

BLUESKY_FEED_RESPONSE_2 = {
    "feed": [
        {
            "post": {
                "uri": "at://did:plc:def456/app.bsky.feed.post/rkey2",
                "author": {
                    "handle": "hokkaido.news.bsky.social",
                    "displayName": "",
                },
                "record": {
                    "text": "New bus route announced between Kutchan and Niseko Village starting March.",
                    "createdAt": "2025-02-10T10:00:00Z",
                },
                "likeCount": 8,
                "repostCount": 2,
            },
        },
    ]
}


@pytest.mark.asyncio
async def test_bluesky_collects():
    from agents.social_agent import SocialAgent

    agent = SocialAgent()
    # Two actors configured → two getAuthorFeed calls
    mock_client = _make_mock_client_multi([
        BLUESKY_FEED_RESPONSE_1,
        BLUESKY_FEED_RESPONSE_2,
    ])

    with patch("agents.social_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.social_agent.httpx.AsyncClient", return_value=mock_client):
        articles, errors = await agent.collect([MOCK_BLUESKY_SOURCE])

    assert len(articles) == 2  # Empty text skipped
    assert len(errors) == 0
    assert "Beautiful morning in Niseko" in articles[0]["title"]
    assert articles[0]["author"] == "Niseko Fan"
    assert articles[0]["raw_metadata"]["platform"] == "bluesky"
    assert articles[0]["raw_metadata"]["reliability_tier"] == "yellow_press"
    assert articles[0]["raw_metadata"]["like_count"] == 23
    assert articles[0]["raw_metadata"]["actor_handle"] == "niseko.fan.bsky.social"
    assert "bsky.app/profile/" in articles[0]["source_url"]


@pytest.mark.asyncio
async def test_bluesky_url_construction():
    from agents.social_agent import _bsky_post_url

    url = _bsky_post_url("user.bsky.social", "at://did:plc:abc/app.bsky.feed.post/xyz123")
    assert url == "https://bsky.app/profile/user.bsky.social/post/xyz123"


@pytest.mark.asyncio
async def test_bluesky_reliability_tier_always_yellow_press():
    from agents.social_agent import SocialAgent

    agent = SocialAgent()
    mock_client = _make_mock_client_multi([
        BLUESKY_FEED_RESPONSE_1,
        BLUESKY_FEED_RESPONSE_2,
    ])

    with patch("agents.social_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.social_agent.httpx.AsyncClient", return_value=mock_client):
        articles, errors = await agent.collect([MOCK_BLUESKY_SOURCE])

    for article in articles:
        assert article["raw_metadata"]["reliability_tier"] == "yellow_press"


@pytest.mark.asyncio
async def test_bluesky_actor_search_fallback():
    """When no actors configured, searchActors is called first."""
    from agents.social_agent import SocialAgent

    source_no_actors = {
        **MOCK_BLUESKY_SOURCE,
        "config": {"platform": "bluesky", "query": "niseko", "max_entries": 5},
    }
    agent = SocialAgent()

    # Call 1: searchActors returns one actor, Call 2: getAuthorFeed
    mock_client = _make_mock_client_multi([
        {"actors": [{"handle": "niseko.fan.bsky.social"}]},
        BLUESKY_FEED_RESPONSE_1,
    ])

    with patch("agents.social_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.social_agent.httpx.AsyncClient", return_value=mock_client):
        articles, errors = await agent.collect([source_no_actors])

    assert len(articles) == 1  # 1 post with text (empty skipped)
    assert len(errors) == 0


# ── Error Handling ────────────────────────────────────


@pytest.mark.asyncio
async def test_social_handles_network_error():
    from agents.social_agent import SocialAgent

    agent = SocialAgent()
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get.side_effect = Exception("Connection refused")

    with patch("agents.social_agent.CONTENT_AGGREGATION_ENABLED", True), \
         patch("agents.social_agent.httpx.AsyncClient", return_value=mock_client):
        articles, errors = await agent.collect([MOCK_REDDIT_SOURCE])

    assert len(articles) == 0
    assert len(errors) == 1
    assert "Connection refused" in errors[0]["error"]
