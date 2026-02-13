"""LangGraph state schemas for the Haystack news gathering pipeline."""

from __future__ import annotations
from typing import TypedDict, Optional, Literal, Annotated
from operator import add


class RawArticle(TypedDict):
    """An article as fetched from a source, before any processing."""
    source_id: str           # UUID of the source_feeds record
    source_type: str         # "rss", "scrape", "api", "social", "tip"
    source_url: str          # Original URL
    source_name: str         # Human-readable source name
    title: str
    body: str                # Full extracted text
    published_at: Optional[str]  # ISO timestamp from source
    author: Optional[str]
    language: str            # "en", "ja"
    raw_metadata: dict       # Source-specific metadata
    fetched_at: str          # When we fetched it


class ClassifiedArticle(TypedDict):
    """An article after relevance classification."""
    raw: RawArticle
    relevance_score: float   # 0.0-1.0, how relevant to Niseko
    topics: list[str]        # Matched topic tags
    geo_tags: list[str]      # Matched geo areas
    priority: str            # "breaking", "high", "normal", "low"
    is_duplicate: bool
    duplicate_of: Optional[str]  # field_note_id or crawl_history_id
    content_fingerprint: str  # For dedup tracking
    classification_reasoning: str


class EnrichedArticle(TypedDict):
    """An article after 5W1H enrichment and risk analysis."""
    classified: ClassifiedArticle
    who: Optional[str]
    what: str
    when_occurred: Optional[str]
    where_location: Optional[str]
    why: Optional[str]
    how: Optional[str]
    quotes: list[dict]       # [{"speaker": ..., "text": ..., "context": ...}]
    evidence_refs: list[dict]
    risk_flags: list[dict]   # Same schema as Cizer risk flags
    fact_check_notes: list[dict]
    confidence_score: int    # 0-100
    source_log: list[dict]   # Source attribution chain


class PipelineState(TypedDict):
    """Top-level state that flows through the LangGraph pipeline."""
    # Input
    run_id: str
    run_type: str            # "scheduled", "manual", "breaking"
    cycle_type: str          # "main", "weather", "deep_scrape", "social", "tips"

    # Collection phase (uses reducer to accumulate across parallel agents)
    raw_articles: Annotated[list[RawArticle], add]
    collection_errors: Annotated[list[dict], add]

    # Classification phase
    classified_articles: list[ClassifiedArticle]
    rejected_articles: list[ClassifiedArticle]

    # Enrichment phase
    enriched_articles: list[EnrichedArticle]

    # Quality gate phase
    approved_articles: list[EnrichedArticle]
    flagged_articles: list[EnrichedArticle]

    # Output phase
    created_field_notes: list[dict]  # {"field_note_id": ..., "headline": ...}

    # Metadata
    stats: dict
    sources_polled: list[str]

    # Internal (not persisted, used between nodes)
    _sources: list[dict]  # Source feed records from scheduler
