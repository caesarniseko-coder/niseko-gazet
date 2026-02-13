"""Web scraping agent for sites without RSS feeds.

Uses httpx + BeautifulSoup4 for HTML extraction.
Respects robots.txt and per-domain rate limits.
"""

import hashlib
from datetime import datetime, timezone

import httpx
import structlog
from bs4 import BeautifulSoup

from agents.base import BaseAgent
from graph.state import RawArticle
from utils.rate_limiter import rate_limiter
from utils.robots import USER_AGENT, is_allowed, get_crawl_delay
from utils.text import html_to_text, detect_language

logger = structlog.get_logger()


class ScraperAgent(BaseAgent):
    """Scrapes articles from websites without RSS feeds."""

    agent_type = "scrape"

    async def collect(self, sources: list[dict]) -> tuple[list[RawArticle], list[dict]]:
        articles: list[RawArticle] = []
        errors: list[dict] = []

        for source in sources:
            try:
                # Apply crawl-delay from robots.txt if available
                delay = await get_crawl_delay(source["url"])
                if delay and delay > 0:
                    rate_limiter.set_domain_rate(
                        source["url"].split("/")[2],
                        rate=1.0 / delay,
                        burst=1,
                    )

                fetched = await self._scrape_source(source)
                articles.extend(fetched)
                logger.info(
                    "scraper.collected",
                    source=source.get("name"),
                    count=len(fetched),
                )
            except Exception as e:
                logger.error("scraper.failed", source=source.get("name"), error=str(e))
                errors.append(self._make_error(source, str(e)))

        return articles, errors

    async def _scrape_source(self, source: dict) -> list[RawArticle]:
        """Scrape a single source website."""
        url = source["url"]
        config = source.get("config", {}) or {}
        timeout = config.get("timeout", 30)

        # Check robots.txt
        if not await is_allowed(url):
            logger.warning("scraper.robots_blocked", url=url)
            return []

        # Rate limit
        await rate_limiter.acquire(url)

        # Fetch the page
        async with httpx.AsyncClient(
            timeout=float(timeout),
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "lxml")

        # Extract articles based on config selectors
        article_selector = config.get("article_selector", "article")
        title_selector = config.get("title_selector", "h1, h2, h3")
        body_selector = config.get("body_selector", "p")
        link_selector = config.get("link_selector", "a")
        max_articles = config.get("max_entries", 15)

        # Find article containers
        containers = soup.select(article_selector)[:max_articles]

        if not containers:
            # Fall back: treat the whole page as one article
            return await self._extract_single_page(source, soup, url)

        results = []
        for container in containers:
            article = await self._extract_article(source, container, url, config)
            if article:
                results.append(article)

        return results

    async def _extract_article(
        self, source: dict, container, base_url: str, config: dict
    ) -> RawArticle | None:
        """Extract a single article from an HTML container element."""
        title_selector = config.get("title_selector", "h1, h2, h3")
        body_selector = config.get("body_selector", "p")
        link_selector = config.get("link_selector", "a[href]")

        # Title
        title_el = container.select_one(title_selector)
        if not title_el:
            return None
        title = title_el.get_text(strip=True)
        if not title:
            return None

        # Body — collect all paragraph text
        body_els = container.select(body_selector)
        body = "\n".join(el.get_text(strip=True) for el in body_els if el.get_text(strip=True))
        if not body:
            body = html_to_text(str(container))
        if not body:
            body = title

        # Link
        link_el = container.select_one(link_selector)
        article_url = base_url
        if link_el and link_el.get("href"):
            href = link_el["href"]
            if href.startswith("http"):
                article_url = href
            elif href.startswith("/"):
                from urllib.parse import urljoin
                article_url = urljoin(base_url, href)

        # Check robots.txt for the article URL
        if article_url != base_url and not await is_allowed(article_url):
            logger.debug("scraper.article_robots_blocked", url=article_url)
            return None

        # Date — look for time element or common date patterns
        date_el = container.select_one("time[datetime]")
        published_at = None
        if date_el and date_el.get("datetime"):
            published_at = date_el["datetime"]

        # Author
        author_el = container.select_one(
            config.get("author_selector", ".author, [rel='author'], .byline")
        )
        author = author_el.get_text(strip=True) if author_el else None

        language = detect_language(body)

        return self._make_raw_article(
            source=source,
            title=title,
            body=body,
            source_url=article_url,
            published_at=published_at,
            author=author,
            language=language,
            raw_metadata={
                "scrape_method": "bs4",
                "page_url": base_url,
            },
        )

    async def _extract_single_page(
        self, source: dict, soup: BeautifulSoup, url: str
    ) -> list[RawArticle]:
        """Extract content from a page treated as a single article."""
        # Remove nav, footer, sidebar, script, style
        for tag in soup.select("nav, footer, aside, script, style, header, .sidebar, .menu"):
            tag.decompose()

        title_el = soup.select_one("h1") or soup.select_one("title")
        title = title_el.get_text(strip=True) if title_el else "Untitled"

        # Get main content area
        main = soup.select_one("main, article, .content, #content, .post")
        if main:
            body = html_to_text(str(main))
        else:
            body = html_to_text(str(soup.body)) if soup.body else ""

        if not body or len(body) < 50:
            return []

        language = detect_language(body)

        return [
            self._make_raw_article(
                source=source,
                title=title,
                body=body,
                source_url=url,
                language=language,
                raw_metadata={"scrape_method": "bs4_single_page"},
            )
        ]
