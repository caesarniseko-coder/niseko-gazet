"""APScheduler integration for automated pipeline scheduling."""

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timezone

from config import (
    MAIN_POLL_INTERVAL_MINUTES,
    WEATHER_POLL_INTERVAL_MINUTES,
    TIP_POLL_INTERVAL_MINUTES,
    SOCIAL_POLL_INTERVAL_MINUTES,
    CONTENT_AGGREGATION_ENABLED,
)

logger = structlog.get_logger()

_scheduler: AsyncIOScheduler | None = None


async def _run_cycle(cycle_type: str) -> None:
    """Scheduled job callback — runs a pipeline cycle."""
    from graph.pipeline import run_pipeline

    logger.info("scheduler.cycle_start", cycle_type=cycle_type)
    try:
        result = await run_pipeline(run_type="scheduled", cycle_type=cycle_type)
        stats = result.get("stats", {})
        logger.info(
            "scheduler.cycle_complete",
            cycle_type=cycle_type,
            field_notes=stats.get("field_notes_created", 0),
            articles=stats.get("raw_count", 0),
        )
    except Exception as e:
        logger.error("scheduler.cycle_failed", cycle_type=cycle_type, error=str(e))


def start_scheduler() -> AsyncIOScheduler:
    """Create and start the APScheduler with all configured cycles."""
    global _scheduler

    _scheduler = AsyncIOScheduler(timezone="UTC")

    # Main collection: RSS + standard scrapers
    _scheduler.add_job(
        _run_cycle,
        trigger=IntervalTrigger(minutes=MAIN_POLL_INTERVAL_MINUTES),
        args=["main"],
        id="main_cycle",
        name="Main Collection (RSS + Scrape)",
        replace_existing=True,
    )

    # Weather/snow data
    _scheduler.add_job(
        _run_cycle,
        trigger=IntervalTrigger(minutes=WEATHER_POLL_INTERVAL_MINUTES),
        args=["weather"],
        id="weather_cycle",
        name="Weather & Snow Data",
        replace_existing=True,
    )

    # Deep scrape: slow/heavy sources
    _scheduler.add_job(
        _run_cycle,
        trigger=IntervalTrigger(hours=6),
        args=["deep_scrape"],
        id="deep_scrape_cycle",
        name="Deep Scrape (Heavy Sources)",
        replace_existing=True,
    )

    # Tip ingestion: approved moderation queue items
    _scheduler.add_job(
        _run_cycle,
        trigger=IntervalTrigger(minutes=TIP_POLL_INTERVAL_MINUTES),
        args=["tips"],
        id="tips_cycle",
        name="Tip Ingestion (Moderation Queue)",
        replace_existing=True,
    )

    # Social media monitoring (feature-flagged)
    if CONTENT_AGGREGATION_ENABLED:
        _scheduler.add_job(
            _run_cycle,
            trigger=IntervalTrigger(minutes=SOCIAL_POLL_INTERVAL_MINUTES),
            args=["social"],
            id="social_cycle",
            name="Social Media (Reddit + Bluesky)",
            replace_existing=True,
        )

    _scheduler.start()

    logger.info(
        "scheduler.started",
        jobs=len(_scheduler.get_jobs()),
        main_interval=f"{MAIN_POLL_INTERVAL_MINUTES}m",
        weather_interval=f"{WEATHER_POLL_INTERVAL_MINUTES}m",
        tips_interval=f"{TIP_POLL_INTERVAL_MINUTES}m",
    )

    return _scheduler


def stop_scheduler() -> None:
    """Shutdown the scheduler gracefully."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("scheduler.stopped")
    _scheduler = None


def get_scheduler_status() -> dict:
    """Get current scheduler state and job details."""
    if not _scheduler or not _scheduler.running:
        return {"running": False, "jobs": []}

    jobs = []
    for job in _scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": next_run.isoformat() if next_run else None,
            "trigger": str(job.trigger),
        })

    return {"running": True, "jobs": jobs}
