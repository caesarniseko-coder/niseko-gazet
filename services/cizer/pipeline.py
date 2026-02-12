import time
from ollama_client import generate_json
from prompts import (
    EDITORIAL_SYSTEM,
    EDITORIAL_PROMPT,
    RISK_SYSTEM,
    RISK_PROMPT,
    FACTCHECK_SYSTEM,
    FACTCHECK_PROMPT,
)
from config import OLLAMA_MODEL


async def process_field_note(field_note: dict) -> dict:
    """Transform a field note into structured content blocks with metadata."""
    start = time.time()

    prompt = EDITORIAL_PROMPT.format(
        who=field_note.get("who", "Not specified"),
        what=field_note.get("what", ""),
        when=field_note.get("when_occurred", "Not specified"),
        where=field_note.get("where_location", "Not specified"),
        why=field_note.get("why", "Not specified"),
        how=field_note.get("how", "Not specified"),
        quotes=_format_quotes(field_note.get("quotes", [])),
        raw_text=field_note.get("raw_text", ""),
    )

    result = await generate_json(prompt, EDITORIAL_SYSTEM)

    processing_time = time.time() - start

    return {
        "content_blocks": result.get("content_blocks", []),
        "suggested_headline": result.get("suggested_headline", ""),
        "suggested_summary": result.get("suggested_summary", ""),
        "edit_suggestions": result.get("edit_suggestions", []),
        "cizer_metadata": {
            "model_version": OLLAMA_MODEL,
            "processing_time": round(processing_time, 2),
        },
    }


async def classify_risks(content: str) -> dict:
    """Analyze content for risk flags."""
    prompt = RISK_PROMPT.format(content=content)
    result = await generate_json(prompt, RISK_SYSTEM)

    return {
        "risk_flags": result.get("risk_flags", []),
    }


async def suggest_fact_checks(content: str) -> dict:
    """Identify verifiable claims in the content."""
    prompt = FACTCHECK_PROMPT.format(content=content)
    result = await generate_json(prompt, FACTCHECK_SYSTEM)

    return {
        "claims": result.get("claims", []),
    }


def _format_quotes(quotes: list) -> str:
    if not quotes:
        return "None"
    parts = []
    for q in quotes:
        speaker = q.get("speaker", "Unknown")
        text = q.get("text", "")
        parts.append(f'"{text}" — {speaker}')
    return "\n".join(parts)
