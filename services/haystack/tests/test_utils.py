"""Tests for Haystack utility modules."""

import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ── Fingerprint Tests ─────────────────────────────────


def test_simhash_deterministic():
    from utils.fingerprint import simhash
    h1 = simhash("Hello world, this is a test article about Niseko")
    h2 = simhash("Hello world, this is a test article about Niseko")
    assert h1 == h2


def test_simhash_similar_text():
    from utils.fingerprint import simhash, similarity
    h1 = simhash("Heavy snowfall expected in Niseko area tonight with 30cm forecast")
    h2 = simhash("Heavy snowfall expected in Niseko region tonight with 30cm predicted")
    assert similarity(h1, h2) > 0.7


def test_simhash_different_text():
    from utils.fingerprint import simhash, similarity
    h1 = simhash("Heavy snowfall expected in Niseko area tonight")
    h2 = simhash("Local restaurant opens new branch in Hirafu village")
    assert similarity(h1, h2) < 0.7


def test_is_duplicate():
    from utils.fingerprint import simhash, is_duplicate
    h1 = simhash("Breaking: Road closure on Route 5 due to heavy snow")
    h2 = simhash("Breaking: Road closure on Route 5 due to heavy snowfall")
    assert is_duplicate(h1, h2, threshold=0.8)


def test_hamming_distance():
    from utils.fingerprint import hamming_distance
    assert hamming_distance("ff", "ff") == 0
    assert hamming_distance("ff", "00") == 8
    assert hamming_distance("f0", "0f") == 8


# ── Text Utils Tests ──────────────────────────────────


def test_html_to_text():
    from utils.text import html_to_text
    result = html_to_text("<p>Hello <b>world</b></p><p>Second paragraph</p>")
    assert "Hello world" in result
    assert "Second paragraph" in result


def test_html_to_text_strips_scripts():
    from utils.text import html_to_text
    result = html_to_text("<p>Text</p><script>alert('xss')</script><p>More</p>")
    assert "alert" not in result
    assert "Text" in result
    assert "More" in result


def test_detect_language_english():
    from utils.text import detect_language
    assert detect_language("Heavy snowfall expected in Niseko tonight") == "en"


def test_detect_language_japanese():
    from utils.text import detect_language
    assert detect_language("今夜ニセコで大雪が予想されています") == "ja"


def test_truncate():
    from utils.text import truncate
    assert truncate("Hello world", 8) == "Hello..."
    assert truncate("Hello", 10) == "Hello"


def test_clean_whitespace():
    from utils.text import clean_whitespace
    assert clean_whitespace("  hello   world  ") == "hello world"


# ── Rate Limiter Tests ────────────────────────────────


@pytest.mark.asyncio
async def test_rate_limiter_allows_burst():
    from utils.rate_limiter import RateLimiter
    limiter = RateLimiter(default_rate=10.0, default_burst=3)
    # Should allow 3 immediate requests (burst)
    for _ in range(3):
        await limiter.acquire("https://example.com/page1")
    # Should still work (just waited briefly for token refill at high rate)


@pytest.mark.asyncio
async def test_rate_limiter_per_domain():
    from utils.rate_limiter import RateLimiter
    limiter = RateLimiter(default_rate=100.0, default_burst=5)
    # Different domains have independent limits
    await limiter.acquire("https://example.com/page")
    await limiter.acquire("https://other.com/page")
    # Both should succeed without blocking


# ── Robots.txt Tests ──────────────────────────────────


@pytest.mark.asyncio
async def test_robots_fail_open():
    """If robots.txt is unreachable, allow crawling (fail-open)."""
    from utils.robots import is_allowed, clear_cache
    clear_cache()

    with patch("utils.robots.httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_instance.get.side_effect = Exception("Network error")

        result = await is_allowed("https://unreachable.example.com/page")
        assert result is True
