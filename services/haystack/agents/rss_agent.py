"""RSS/Atom feed collection agent."""

import httpx
import feedparser
import structlog

from agents.base import BaseAgent
from graph.state import RawArticle
from utils.text import html_to_text, detect_language

logger = structlog.get_logger()


class RSSAgent(BaseAgent):
    """Collects articles from RSS and Atom feeds."""

    agent_type = "rss"

    async def collect(self, sources: list[dict]) -> tuple[list[RawArticle], list[dict]]:
        articles: list[RawArticle] = []
        errors: list[dict] = []

        for source in sources:
            try:
                fetched = await self._fetch_feed(source)
                articles.extend(fetched)
                logger.info(
                    "rss.collected",
                    source=source.get("name"),
                    count=len(fetched),
                )
            except Exception as e:
                logger.error("rss.fetch_failed", source=source.get("name"), error=str(e))
                errors.append(self._make_error(source, str(e)))

        return articles, errors

    async def _fetch_feed(self, source: dict) -> list[RawArticle]:
        """Fetch and parse a single RSS/Atom feed."""
        url = source["url"]
        config = source.get("config", {}) or {}
        timeout = config.get("timeout", 30)

        async with httpx.AsyncClient(timeout=float(timeout)) as client:
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()

        feed = feedparser.parse(resp.text)

        if feed.bozo and not feed.entries:
            raise ValueError(f"Feed parse error: {feed.bozo_exception}")

        results = []
        max_entries = config.get("max_entries", 20)

        for entry in feed.entries[:max_entries]:
            title = entry.get("title", "").strip()
            if not title:
                continue

            # Extract body: prefer content, fall back to summary/description
            body = ""
            if hasattr(entry, "content") and entry.content:
                body = entry.content[0].get("value", "")
            elif hasattr(entry, "summary"):
                body = entry.summary or ""
            elif hasattr(entry, "description"):
                body = entry.description or ""

            # Strip HTML from body
            body = html_to_text(body)

            if not body:
                body = title  # Use title as body if nothing else

            # Extract publication date
            published_at = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                from datetime import datetime, timezone
                try:
                    from time import mktime
                    published_at = datetime.fromtimestamp(
                        mktime(entry.published_parsed), tz=timezone.utc
                    ).isoformat()
                except (ValueError, OverflowError):
                    pass

            # Get link
            link = entry.get("link", source["url"])

            # Detect language
            language = detect_language(body)

            # Raw metadata
            raw_metadata = {
                "feed_title": feed.feed.get("title", ""),
                "entry_id": entry.get("id", link),
                "tags": [t.get("term", "") for t in entry.get("tags", [])],
            }

            article = self._make_raw_article(
                source=source,
                title=title,
                body=body,
                source_url=link,
                published_at=published_at,
                author=entry.get("author"),
                language=language,
                raw_metadata=raw_metadata,
            )
            results.append(article)

        return results
