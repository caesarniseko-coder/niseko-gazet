"""robots.txt compliance checker.

Caches parsed robots.txt per domain to avoid repeated fetches.
"""

import asyncio
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx
import structlog

logger = structlog.get_logger()

USER_AGENT = "NisekoGazetBot/1.0 (+https://niseko-gazet.vercel.app)"

# Cache: domain -> (RobotFileParser, expiry_timestamp)
_cache: dict[str, tuple[RobotFileParser, float]] = {}
_cache_ttl = 3600  # 1 hour
_lock = asyncio.Lock()


async def is_allowed(url: str, user_agent: str = USER_AGENT) -> bool:
    """Check if the given URL is allowed by its robots.txt.

    Returns True if crawling is allowed (including when robots.txt
    is unreachable — fail-open to avoid blocking on network errors).
    """
    parsed = urlparse(url)
    domain = f"{parsed.scheme}://{parsed.netloc}"

    parser = await _get_parser(domain)
    if parser is None:
        return True  # fail-open

    return parser.can_fetch(user_agent, url)


async def get_crawl_delay(url: str, user_agent: str = USER_AGENT) -> float | None:
    """Get the Crawl-delay directive for the given domain, if any."""
    parsed = urlparse(url)
    domain = f"{parsed.scheme}://{parsed.netloc}"

    parser = await _get_parser(domain)
    if parser is None:
        return None

    delay = parser.crawl_delay(user_agent)
    return float(delay) if delay is not None else None


async def _get_parser(domain: str) -> RobotFileParser | None:
    """Get or fetch a cached RobotFileParser for the domain."""
    import time

    now = time.time()

    async with _lock:
        if domain in _cache:
            parser, expiry = _cache[domain]
            if now < expiry:
                return parser

    # Fetch fresh robots.txt
    robots_url = f"{domain}/robots.txt"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(robots_url, follow_redirects=True)

        parser = RobotFileParser()
        parser.set_url(robots_url)

        if resp.status_code == 200:
            parser.parse(resp.text.splitlines())
        else:
            # No robots.txt or error — allow everything
            parser.parse([])

        async with _lock:
            _cache[domain] = (parser, now + _cache_ttl)

        return parser

    except Exception as e:
        logger.warning("robots.fetch_failed", domain=domain, error=str(e))
        return None  # fail-open


def clear_cache() -> None:
    """Clear the robots.txt cache."""
    _cache.clear()
