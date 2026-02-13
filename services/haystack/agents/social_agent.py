"""Social media collection agent for Reddit and Bluesky.

All social sources are treated as yellow_press reliability tier,
meaning they always route to the moderation queue.
"""

import httpx
import structlog
from datetime import datetime, timezone

from agents.base import BaseAgent
from config import CONTENT_AGGREGATION_ENABLED
from graph.state import RawArticle
from utils.text import detect_language

logger = structlog.get_logger()

_REDDIT_USER_AGENT = "haystack-bot:niseko-gazet:v0.6.0 (news aggregation)"


class SocialAgent(BaseAgent):
    """Collects posts from social media platforms (Reddit, Bluesky)."""

    agent_type = "social"

    async def collect(self, sources: list[dict]) -> tuple[list[RawArticle], list[dict]]:
        if not CONTENT_AGGREGATION_ENABLED:
            logger.info("social.disabled", reason="CONTENT_AGGREGATION_ENABLED=false")
            return [], []

        articles: list[RawArticle] = []
        errors: list[dict] = []

        for source in sources:
            try:
                config = source.get("config", {}) or {}
                platform = config.get("platform", "reddit")

                if platform == "reddit":
                    fetched = await self._collect_reddit(source)
                elif platform == "bluesky":
                    fetched = await self._collect_bluesky(source)
                else:
                    logger.warning("social.unknown_platform", platform=platform)
                    fetched = []

                articles.extend(fetched)
                logger.info("social.collected", source=source.get("name"), count=len(fetched))
            except Exception as e:
                logger.error("social.failed", source=source.get("name"), error=str(e))
                errors.append(self._make_error(source, str(e)))

        return articles, errors

    async def _collect_reddit(self, source: dict) -> list[RawArticle]:
        """Fetch recent posts from a subreddit using the public JSON API."""
        config = source.get("config", {}) or {}
        subreddit = config.get("subreddit", "niseko")
        max_entries = config.get("max_entries", 15)

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"https://www.reddit.com/r/{subreddit}/new.json",
                params={"limit": max_entries},
                headers={"User-Agent": _REDDIT_USER_AGENT},
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for child in data.get("data", {}).get("children", []):
            post = child.get("data", {})
            title = post.get("title", "").strip()
            if not title:
                continue

            body = post.get("selftext", "") or title
            language = detect_language(body)

            created_utc = post.get("created_utc")
            published_at = (
                datetime.fromtimestamp(created_utc, tz=timezone.utc).isoformat()
                if created_utc
                else None
            )

            results.append(
                self._make_raw_article(
                    source=source,
                    title=title,
                    body=body,
                    source_url=f"https://www.reddit.com{post.get('permalink', '')}",
                    published_at=published_at,
                    author=post.get("author"),
                    language=language,
                    raw_metadata={
                        "platform": "reddit",
                        "subreddit": subreddit,
                        "score": post.get("score", 0),
                        "num_comments": post.get("num_comments", 0),
                        "reliability_tier": "yellow_press",
                    },
                )
            )

        return results

    async def _collect_bluesky(self, source: dict) -> list[RawArticle]:
        """Fetch posts from Bluesky using the public AT Protocol API.

        Strategy: searchPosts requires auth since late 2025, so we use
        searchActors to discover accounts matching the query, then pull
        their recent posts via getAuthorFeed (both public endpoints).
        If explicit ``actors`` are listed in config, we skip the search.
        """
        config = source.get("config", {}) or {}
        query = config.get("query", "niseko")
        max_entries = config.get("max_entries", 15)
        actors = config.get("actors", [])  # pre-configured handles
        max_actors = config.get("max_actors", 5)

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1: Resolve actor handles
            if not actors:
                resp = await client.get(
                    "https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors",
                    params={"q": query, "limit": max_actors},
                )
                resp.raise_for_status()
                actors = [
                    a["handle"]
                    for a in resp.json().get("actors", [])
                    if a.get("handle")
                ]

            if not actors:
                logger.info("bluesky.no_actors_found", query=query)
                return []

            # Step 2: Fetch recent posts from each actor
            results = []
            per_actor = max(1, max_entries // len(actors))

            for handle in actors:
                try:
                    resp = await client.get(
                        "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed",
                        params={
                            "actor": handle,
                            "limit": per_actor,
                            "filter": "posts_no_replies",
                        },
                    )
                    resp.raise_for_status()
                    feed = resp.json().get("feed", [])
                except httpx.HTTPStatusError:
                    logger.warning("bluesky.actor_feed_failed", handle=handle)
                    continue

                for item in feed:
                    post_view = item.get("post", {})
                    record = post_view.get("record", {})
                    text = record.get("text", "").strip()
                    if not text:
                        continue

                    title = text.split("\n")[0][:100]
                    language = detect_language(text)

                    author_info = post_view.get("author", {})
                    author = author_info.get("displayName") or author_info.get("handle", "")

                    results.append(
                        self._make_raw_article(
                            source=source,
                            title=title,
                            body=text,
                            source_url=_bsky_post_url(
                                author_info.get("handle", ""), post_view.get("uri", "")
                            ),
                            published_at=record.get("createdAt"),
                            author=author,
                            language=language,
                            raw_metadata={
                                "platform": "bluesky",
                                "actor_handle": handle,
                                "like_count": post_view.get("likeCount", 0),
                                "repost_count": post_view.get("repostCount", 0),
                                "reliability_tier": "yellow_press",
                            },
                        )
                    )

        return results


def _bsky_post_url(handle: str, uri: str) -> str:
    """Convert an AT Protocol URI to a Bluesky web URL."""
    # URI format: at://did:plc:xxx/app.bsky.feed.post/rkey
    parts = uri.split("/")
    rkey = parts[-1] if parts else ""
    return f"https://bsky.app/profile/{handle}/post/{rkey}" if handle and rkey else uri
