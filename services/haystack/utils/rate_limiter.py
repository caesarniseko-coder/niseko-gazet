"""Per-domain rate limiter using token bucket algorithm.

Ensures polite crawling by limiting request frequency per domain.
"""

import asyncio
import time
from urllib.parse import urlparse

import structlog

logger = structlog.get_logger()

# Default: 1 request per 2 seconds per domain
DEFAULT_RATE = 0.5  # requests per second
DEFAULT_BURST = 3  # max burst tokens


class _TokenBucket:
    """Simple token bucket for rate limiting."""

    def __init__(self, rate: float, burst: int):
        self.rate = rate
        self.burst = burst
        self.tokens = float(burst)
        self.last_refill = time.monotonic()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
        self.last_refill = now

    async def acquire(self) -> None:
        """Wait until a token is available, then consume it."""
        while True:
            self._refill()
            if self.tokens >= 1.0:
                self.tokens -= 1.0
                return
            # Calculate wait time for next token
            wait = (1.0 - self.tokens) / self.rate
            await asyncio.sleep(min(wait, 2.0))


class RateLimiter:
    """Per-domain rate limiter."""

    def __init__(self, default_rate: float = DEFAULT_RATE, default_burst: int = DEFAULT_BURST):
        self._default_rate = default_rate
        self._default_burst = default_burst
        self._buckets: dict[str, _TokenBucket] = {}
        self._overrides: dict[str, tuple[float, int]] = {}
        self._lock = asyncio.Lock()

    def set_domain_rate(self, domain: str, rate: float, burst: int | None = None) -> None:
        """Override rate limit for a specific domain."""
        self._overrides[domain] = (rate, burst or self._default_burst)

    async def acquire(self, url: str) -> None:
        """Wait until the rate limit allows a request to this URL's domain."""
        domain = urlparse(url).netloc

        async with self._lock:
            if domain not in self._buckets:
                rate, burst = self._overrides.get(
                    domain, (self._default_rate, self._default_burst)
                )
                self._buckets[domain] = _TokenBucket(rate, burst)
            bucket = self._buckets[domain]

        await bucket.acquire()

    def clear(self) -> None:
        """Reset all rate limiters."""
        self._buckets.clear()


# Shared instance
rate_limiter = RateLimiter()
