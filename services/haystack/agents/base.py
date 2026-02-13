"""Abstract base class for all Haystack collection agents."""

from abc import ABC, abstractmethod
from datetime import datetime, timezone

import structlog

from graph.state import RawArticle

logger = structlog.get_logger()


class BaseAgent(ABC):
    """Base class for source collection agents (RSS, Scraper, API, etc.)."""

    agent_type: str = "unknown"

    @abstractmethod
    async def collect(self, sources: list[dict]) -> tuple[list[RawArticle], list[dict]]:
        """Collect articles from the given sources.

        Args:
            sources: List of source_feeds records from the database.

        Returns:
            Tuple of (articles, errors) where articles is a list of RawArticle
            dicts and errors is a list of error dicts.
        """
        ...

    def _make_raw_article(
        self,
        source: dict,
        title: str,
        body: str,
        source_url: str,
        published_at: str | None = None,
        author: str | None = None,
        language: str = "en",
        raw_metadata: dict | None = None,
    ) -> RawArticle:
        """Helper to create a RawArticle dict with consistent fields."""
        metadata = raw_metadata or {}
        # Propagate source reliability tier for quality gate decisions
        if source.get("reliability_tier"):
            metadata["reliability_tier"] = source["reliability_tier"]

        return RawArticle(
            source_id=source["id"],
            source_type=source["source_type"],
            source_url=source_url,
            source_name=source.get("name", "Unknown"),
            title=title,
            body=body,
            published_at=published_at,
            author=author,
            language=language,
            raw_metadata=metadata,
            fetched_at=datetime.now(timezone.utc).isoformat(),
        )

    def _make_error(self, source: dict, error: str) -> dict:
        """Helper to create an error dict."""
        return {
            "source_id": source.get("id", "unknown"),
            "source_name": source.get("name", "Unknown"),
            "agent_type": self.agent_type,
            "error": error,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
