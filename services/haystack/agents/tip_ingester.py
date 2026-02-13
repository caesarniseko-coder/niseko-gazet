"""Tip Ingester agent: pulls approved tips from the moderation queue.

Converts approved user-submitted tips into raw articles for the pipeline.
"""

import structlog

from agents.base import BaseAgent
from db.client import _request
from graph.state import RawArticle
from utils.text import detect_language

logger = structlog.get_logger()


class TipIngester(BaseAgent):
    """Ingests approved tips from the moderation queue."""

    agent_type = "tip"

    async def collect(self, sources: list[dict]) -> tuple[list[RawArticle], list[dict]]:
        """Fetch approved tips that haven't been processed yet.

        The 'sources' param is ignored — tips come from the moderation queue.
        """
        articles: list[RawArticle] = []
        errors: list[dict] = []

        try:
            # Get approved tips that haven't been ingested into the pipeline
            tips = await _request(
                "GET",
                "moderation_queue",
                params={
                    "type": "eq.tip",
                    "status": "eq.approved",
                    "order": "created_at.asc",
                    "limit": "20",
                },
            )

            if not tips:
                return [], []

            for tip in tips:
                metadata = tip.get("metadata", {}) or {}

                # Skip if already ingested (has pipeline_run_id in metadata)
                if metadata.get("ingested"):
                    continue

                content = tip.get("content", "")
                if not content:
                    continue

                language = detect_language(content)

                # Create a source-like dict for _make_raw_article
                source = {
                    "id": tip.get("id", "tip-unknown"),
                    "source_type": "tip",
                    "name": "User Tip",
                }

                article = self._make_raw_article(
                    source=source,
                    title=content[:100].strip(),
                    body=content,
                    source_url=f"tip://{tip['id']}",
                    author=tip.get("submitter_email"),
                    language=language,
                    raw_metadata={
                        "tip_id": tip["id"],
                        "submitter_email": tip.get("submitter_email"),
                        "submitter_ip": tip.get("submitter_ip"),
                        "related_story_id": tip.get("related_story_id"),
                        "review_notes": tip.get("review_notes"),
                        "original_metadata": metadata,
                    },
                )
                articles.append(article)

                # Mark as ingested
                await _request(
                    "PATCH",
                    f"moderation_queue?id=eq.{tip['id']}",
                    json={
                        "metadata": {**metadata, "ingested": True},
                    },
                )

            logger.info("tip_ingester.collected", count=len(articles))

        except Exception as e:
            logger.error("tip_ingester.failed", error=str(e))
            errors.append({
                "source_id": "moderation_queue",
                "source_name": "User Tips",
                "agent_type": self.agent_type,
                "error": str(e),
            })

        return articles, errors
