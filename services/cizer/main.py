from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from config import CIZER_PORT, CIZER_HOST
from ollama_client import check_health
from pipeline import process_field_note, classify_risks, suggest_fact_checks

app = FastAPI(
    title="Cizer - AI Editor-in-Chief",
    description="Editorial AI pipeline for Niseko Gazet",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ──────────────────────────────────────────────


class FieldNoteInput(BaseModel):
    who: Optional[str] = None
    what: str
    when_occurred: Optional[str] = None
    where_location: Optional[str] = None
    why: Optional[str] = None
    how: Optional[str] = None
    quotes: list[dict] = []
    raw_text: Optional[str] = None


class ContentInput(BaseModel):
    content: str


# ── Routes ──────────────────────────────────────────────


@app.get("/health")
async def health():
    status = await check_health()
    return {"service": "cizer", "status": "running", "ollama": status}


@app.post("/process")
async def process(field_note: FieldNoteInput):
    """Transform a field note into structured article content."""
    try:
        result = await process_field_note(field_note.model_dump())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.post("/risks")
async def risks(input: ContentInput):
    """Analyze content for risk flags."""
    try:
        result = await classify_risks(input.content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk analysis failed: {str(e)}")


@app.post("/fact-check")
async def fact_check(input: ContentInput):
    """Identify verifiable claims in content."""
    try:
        result = await suggest_fact_checks(input.content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fact-check failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("main:app", host=CIZER_HOST, port=CIZER_PORT, reload=True)
