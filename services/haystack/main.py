from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import structlog

from config import HAYSTACK_PORT, HAYSTACK_HOST

logger = structlog.get_logger()


# ── Lifespan ───────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    from scheduler import start_scheduler, stop_scheduler

    logger.info("haystack.starting", port=HAYSTACK_PORT)
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("haystack.stopped")


# ── App ────────────────────────────────────────────────


app = FastAPI(
    title="Haystack - Agentic News Gathering",
    description="LangGraph-powered news gathering pipeline for Niseko Gazet",
    version="0.6.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://niseko-gazet.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ─────────────────────────────────────────────


@app.get("/health")
async def health():
    """Health check: service alive, Ollama connected, DB connected."""
    from llm.client import check_health as check_ollama
    from db.client import check_health as check_db
    from scheduler import get_scheduler_status

    ollama_status = await check_ollama()
    db_status = await check_db()
    sched = get_scheduler_status()

    return {
        "service": "haystack",
        "status": "running",
        "version": "0.5.0",
        "ollama": ollama_status,
        "database": db_status,
        "scheduler": sched,
    }


@app.post("/trigger/{cycle_type}")
async def trigger_cycle(cycle_type: str):
    """Manually trigger a collection cycle."""
    from graph.pipeline import run_pipeline

    valid_cycles = ["main", "weather", "deep_scrape", "tips", "social"]
    if cycle_type not in valid_cycles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid cycle type. Must be one of: {valid_cycles}",
        )

    logger.info("haystack.manual_trigger", cycle_type=cycle_type)

    try:
        result = await run_pipeline(run_type="manual", cycle_type=cycle_type)
        return {"status": "completed", "cycle": cycle_type, "stats": result.get("stats", {})}
    except Exception as e:
        logger.error("haystack.trigger_failed", cycle_type=cycle_type, error=str(e))
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")


@app.get("/status")
async def status():
    """Current scheduler status and next run times."""
    from scheduler import get_scheduler_status
    from db.client import get_recent_runs

    sched = get_scheduler_status()
    last_runs = await get_recent_runs(limit=3)

    return {
        "scheduler": sched,
        "recent_runs": [
            {
                "id": r.get("id"),
                "run_type": r.get("run_type"),
                "status": r.get("status"),
                "started_at": r.get("started_at"),
                "stats": r.get("stats"),
            }
            for r in last_runs
        ],
    }


@app.get("/runs")
async def list_runs(limit: int = 20):
    """Recent pipeline run history."""
    from db.client import get_recent_runs
    return await get_recent_runs(limit=limit)


@app.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Detailed pipeline run report."""
    from db.client import get_run_by_id

    run = await get_run_by_id(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


# ── Source Feeds Admin ────────────────────────────────


@app.get("/sources")
async def list_sources():
    """List all configured source feeds."""
    from db.client import get_active_sources
    return await get_active_sources()


@app.post("/sources")
async def create_source(source: dict):
    """Create a new source feed."""
    from db.client import _request
    from uuid import uuid4

    required = ["name", "source_type", "url"]
    for field in required:
        if field not in source:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    source["id"] = str(uuid4())
    result = await _request("POST", "source_feeds", json=source)
    return result[0] if isinstance(result, list) else result


@app.patch("/sources/{source_id}")
async def update_source(source_id: str, updates: dict):
    """Update a source feed's configuration."""
    from db.client import _request

    result = await _request(
        "PATCH",
        f"source_feeds?id=eq.{source_id}",
        json=updates,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Source not found")
    return result[0] if isinstance(result, list) else result


# ── Analytics ─────────────────────────────────────────


@app.get("/analytics/trends")
async def topic_trends(hours: int = 24, min_count: int = 2):
    """Get trending topics from recent pipeline activity."""
    from utils.trends import get_topic_trends
    return await get_topic_trends(hours=hours, min_count=min_count)


@app.get("/analytics/geo")
async def geo_trends(hours: int = 24):
    """Get geographic hotspots from recent pipeline activity."""
    from utils.trends import get_geo_trends
    return await get_geo_trends(hours=hours)


@app.get("/analytics/sources")
async def source_analytics():
    """Get per-source performance statistics."""
    from utils.trends import get_source_stats
    return await get_source_stats()


if __name__ == "__main__":
    uvicorn.run("main:app", host=HAYSTACK_HOST, port=HAYSTACK_PORT, reload=True)
