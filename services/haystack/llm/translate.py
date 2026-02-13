"""JA→EN translation for Japanese articles via LLM."""

import structlog

from llm.client import generate_json

logger = structlog.get_logger()

TRANSLATE_SYSTEM = """You are a professional Japanese-to-English translator for a local news platform covering the Niseko area of Hokkaido, Japan.

Rules:
- Translate accurately and naturally to English
- Preserve all factual content — NEVER add or remove information
- Keep proper nouns in both scripts: "倶知安町 (Kutchan Town)"
- Keep Japanese organization names with translation: "北海道開発局 (Hokkaido Development Bureau)"
- For quotes: include both Japanese original and English translation
- Maintain the journalistic tone of the original

Respond with ONLY valid JSON."""

TRANSLATE_PROMPT = """Translate this Japanese news article to English.

TITLE (JA): {title}
BODY (JA):
{body}

Respond with:
{{
  "title_en": "English title",
  "body_en": "Full English translation of the body",
  "summary_en": "1-2 sentence English summary"
}}"""


async def translate_article(title: str, body: str) -> dict:
    """Translate a Japanese article title and body to English.

    Args:
        title: Japanese article title
        body: Japanese article body

    Returns:
        Dict with title_en, body_en, summary_en. Returns originals on failure.
    """
    try:
        result = await generate_json(
            TRANSLATE_PROMPT.format(title=title, body=body),
            system=TRANSLATE_SYSTEM,
            temperature=0.2,
        )

        return {
            "title_en": result.get("title_en", title),
            "body_en": result.get("body_en", body),
            "summary_en": result.get("summary_en", ""),
        }

    except Exception as e:
        logger.error("translate.failed", error=str(e), title=title[:60])
        return {
            "title_en": title,
            "body_en": body,
            "summary_en": "",
        }
