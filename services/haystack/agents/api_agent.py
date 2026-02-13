"""API collection agent for structured data sources.

Fetches data from weather APIs, news APIs, and government open data endpoints.
"""

import httpx
import structlog
from datetime import datetime, timezone

from agents.base import BaseAgent
from config import (
    OPENWEATHER_API_KEY,
    NEWSAPI_KEY,
    CONTENT_AGGREGATION_ENABLED,
    TAVILY_API_KEY,
    BRAVE_SEARCH_API_KEY,
    CURRENTS_API_KEY,
    GNEWS_API_KEY,
)
from graph.state import RawArticle
from utils.text import detect_language

logger = structlog.get_logger()


class APIAgent(BaseAgent):
    """Collects articles from structured API endpoints."""

    agent_type = "api"

    async def collect(self, sources: list[dict]) -> tuple[list[RawArticle], list[dict]]:
        articles: list[RawArticle] = []
        errors: list[dict] = []

        for source in sources:
            try:
                config = source.get("config", {}) or {}
                api_type = config.get("api_type", "generic")

                if api_type == "openweather":
                    fetched = await self._fetch_weather(source)
                elif api_type == "newsapi":
                    fetched = await self._fetch_newsapi(source)
                elif api_type == "tavily":
                    fetched = await self._fetch_tavily(source)
                elif api_type == "brave":
                    fetched = await self._fetch_brave(source)
                elif api_type == "currents":
                    fetched = await self._fetch_currents(source)
                elif api_type == "gnews":
                    fetched = await self._fetch_gnews(source)
                else:
                    fetched = await self._fetch_generic(source)

                articles.extend(fetched)
                logger.info("api.collected", source=source.get("name"), count=len(fetched))
            except Exception as e:
                logger.error("api.failed", source=source.get("name"), error=str(e))
                errors.append(self._make_error(source, str(e)))

        return articles, errors

    async def _fetch_weather(self, source: dict) -> list[RawArticle]:
        """Fetch weather data from OpenWeatherMap."""
        if not OPENWEATHER_API_KEY:
            logger.warning("api.weather_no_key")
            return []

        config = source.get("config", {}) or {}
        lat = config.get("lat", 42.8614)   # Niseko default
        lon = config.get("lon", 140.6882)

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "lat": lat,
                    "lon": lon,
                    "appid": OPENWEATHER_API_KEY,
                    "units": "metric",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        weather = data.get("weather", [{}])[0]
        main = data.get("main", {})
        wind = data.get("wind", {})
        snow = data.get("snow", {})

        temp = main.get("temp", "?")
        desc = weather.get("description", "")
        snow_1h = snow.get("1h", 0)
        snow_3h = snow.get("3h", 0)

        title = f"Niseko Weather: {desc.title()}, {temp}°C"
        body_parts = [
            f"Current conditions in Niseko: {desc}.",
            f"Temperature: {temp}°C (feels like {main.get('feels_like', '?')}°C).",
            f"Humidity: {main.get('humidity', '?')}%.",
            f"Wind: {wind.get('speed', '?')} m/s.",
        ]
        if snow_1h > 0 or snow_3h > 0:
            body_parts.append(f"Snowfall: {snow_1h}mm (1h), {snow_3h}mm (3h).")
        body = " ".join(body_parts)

        return [
            self._make_raw_article(
                source=source,
                title=title,
                body=body,
                source_url=f"https://openweathermap.org/city/{data.get('id', '')}",
                published_at=datetime.now(timezone.utc).isoformat(),
                language="en",
                raw_metadata={
                    "api_type": "openweather",
                    "raw_response": data,
                    "snow_1h": snow_1h,
                    "snow_3h": snow_3h,
                },
            )
        ]

    async def _fetch_newsapi(self, source: dict) -> list[RawArticle]:
        """Fetch articles from NewsAPI.org."""
        if not NEWSAPI_KEY:
            logger.warning("api.newsapi_no_key")
            return []

        config = source.get("config", {}) or {}
        query = config.get("query", "Niseko OR Hokkaido")
        page_size = config.get("max_entries", 10)

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "apiKey": NEWSAPI_KEY,
                    "pageSize": page_size,
                    "sortBy": "publishedAt",
                    "language": "en",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("articles", []):
            title = item.get("title", "").strip()
            if not title or title == "[Removed]":
                continue

            body = item.get("description", "") or item.get("content", "") or title
            language = detect_language(body)

            results.append(
                self._make_raw_article(
                    source=source,
                    title=title,
                    body=body,
                    source_url=item.get("url", ""),
                    published_at=item.get("publishedAt"),
                    author=item.get("author"),
                    language=language,
                    raw_metadata={
                        "api_type": "newsapi",
                        "source_name": item.get("source", {}).get("name"),
                    },
                )
            )

        return results

    async def _fetch_tavily(self, source: dict) -> list[RawArticle]:
        """Fetch search results from Tavily API."""
        if not CONTENT_AGGREGATION_ENABLED:
            return []
        if not TAVILY_API_KEY:
            logger.warning("api.tavily_no_key")
            return []

        config = source.get("config", {}) or {}
        query = config.get("query", "Niseko OR Kutchan OR Hokkaido ski")
        max_results = config.get("max_entries", 10)

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "basic",
                    "include_answer": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("results", []):
            title = item.get("title", "").strip()
            if not title:
                continue
            body = item.get("content", "") or title
            language = detect_language(body)

            results.append(
                self._make_raw_article(
                    source=source,
                    title=title,
                    body=body,
                    source_url=item.get("url", ""),
                    published_at=item.get("published_date"),
                    language=language,
                    raw_metadata={
                        "api_type": "tavily",
                        "score": item.get("score"),
                    },
                )
            )

        return results

    async def _fetch_brave(self, source: dict) -> list[RawArticle]:
        """Fetch search results from Brave Search API."""
        if not CONTENT_AGGREGATION_ENABLED:
            return []
        if not BRAVE_SEARCH_API_KEY:
            logger.warning("api.brave_no_key")
            return []

        config = source.get("config", {}) or {}
        query = config.get("query", "Niseko OR Kutchan OR Hokkaido ski")
        count = config.get("max_entries", 10)

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={
                    "X-Subscription-Token": BRAVE_SEARCH_API_KEY,
                    "Accept": "application/json",
                },
                params={"q": query, "count": count},
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("web", {}).get("results", []):
            title = item.get("title", "").strip()
            if not title:
                continue
            body = item.get("description", "") or title
            language = detect_language(body)

            results.append(
                self._make_raw_article(
                    source=source,
                    title=title,
                    body=body,
                    source_url=item.get("url", ""),
                    published_at=item.get("page_age"),
                    language=language,
                    raw_metadata={"api_type": "brave"},
                )
            )

        return results

    async def _fetch_currents(self, source: dict) -> list[RawArticle]:
        """Fetch articles from Currents API."""
        if not CONTENT_AGGREGATION_ENABLED:
            return []
        if not CURRENTS_API_KEY:
            logger.warning("api.currents_no_key")
            return []

        config = source.get("config", {}) or {}
        query = config.get("query", "Niseko OR Kutchan OR Hokkaido")

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://api.currentsapi.services/v1/search",
                params={
                    "apiKey": CURRENTS_API_KEY,
                    "keywords": query,
                    "language": "en",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("news", []):
            title = item.get("title", "").strip()
            if not title:
                continue
            body = item.get("description", "") or title
            language = detect_language(body)

            results.append(
                self._make_raw_article(
                    source=source,
                    title=title,
                    body=body,
                    source_url=item.get("url", ""),
                    published_at=item.get("published"),
                    author=item.get("author"),
                    language=language,
                    raw_metadata={
                        "api_type": "currents",
                        "category": item.get("category"),
                    },
                )
            )

        return results

    async def _fetch_gnews(self, source: dict) -> list[RawArticle]:
        """Fetch articles from GNews API."""
        if not CONTENT_AGGREGATION_ENABLED:
            return []
        if not GNEWS_API_KEY:
            logger.warning("api.gnews_no_key")
            return []

        config = source.get("config", {}) or {}
        query = config.get("query", "Niseko OR Kutchan OR Hokkaido")
        max_entries = config.get("max_entries", 10)

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://gnews.io/api/v4/search",
                params={
                    "token": GNEWS_API_KEY,
                    "q": query,
                    "max": max_entries,
                    "lang": "en",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("articles", []):
            title = item.get("title", "").strip()
            if not title:
                continue
            body = item.get("description", "") or item.get("content", "") or title
            language = detect_language(body)

            results.append(
                self._make_raw_article(
                    source=source,
                    title=title,
                    body=body,
                    source_url=item.get("url", ""),
                    published_at=item.get("publishedAt"),
                    author=item.get("source", {}).get("name"),
                    language=language,
                    raw_metadata={
                        "api_type": "gnews",
                        "source_name": item.get("source", {}).get("name"),
                    },
                )
            )

        return results

    async def _fetch_generic(self, source: dict) -> list[RawArticle]:
        """Fetch from a generic JSON API endpoint."""
        config = source.get("config", {}) or {}
        url = source["url"]
        headers = config.get("headers", {})
        params = config.get("params", {})

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()

        # Extract using configured JSON paths
        items_path = config.get("items_path", "")  # e.g., "data.articles"
        items = data
        for key in items_path.split("."):
            if key and isinstance(items, dict):
                items = items.get(key, [])

        if not isinstance(items, list):
            items = [items]

        title_key = config.get("title_key", "title")
        body_key = config.get("body_key", "description")
        url_key = config.get("url_key", "url")
        date_key = config.get("date_key", "published_at")
        max_entries = config.get("max_entries", 10)

        results = []
        for item in items[:max_entries]:
            if not isinstance(item, dict):
                continue
            title = str(item.get(title_key, "")).strip()
            if not title:
                continue

            body = str(item.get(body_key, "")) or title
            language = detect_language(body)

            results.append(
                self._make_raw_article(
                    source=source,
                    title=title,
                    body=body,
                    source_url=str(item.get(url_key, source["url"])),
                    published_at=item.get(date_key),
                    language=language,
                    raw_metadata={"api_type": "generic", "raw_item": item},
                )
            )

        return results
