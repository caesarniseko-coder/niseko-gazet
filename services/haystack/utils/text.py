"""Text processing utilities: HTML extraction, language detection, cleaning."""

import re
from html.parser import HTMLParser


class _HTMLTextExtractor(HTMLParser):
    """Strip HTML tags and extract plain text."""

    def __init__(self):
        super().__init__()
        self._text = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self._skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self._skip = False
        if tag in ("p", "br", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li"):
            self._text.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self._text.append(data)

    def get_text(self) -> str:
        return "".join(self._text)


def html_to_text(html: str) -> str:
    """Convert HTML to plain text."""
    extractor = _HTMLTextExtractor()
    extractor.feed(html)
    text = extractor.get_text()
    # Collapse whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def detect_language(text: str) -> str:
    """Detect if text is primarily Japanese or English.

    Simple heuristic: if >20% of chars are CJK, classify as Japanese.
    Lowered from 30% to catch mixed-language articles from bilingual sources.
    """
    if not text:
        return "en"

    cjk_count = 0
    total = 0
    for char in text:
        code = ord(char)
        if not char.isspace():
            total += 1
            # CJK Unified Ideographs + Hiragana + Katakana + Half-width Katakana
            if (0x4E00 <= code <= 0x9FFF or
                    0x3040 <= code <= 0x309F or
                    0x30A0 <= code <= 0x30FF or
                    0xFF65 <= code <= 0xFF9F):
                cjk_count += 1

    if total == 0:
        return "en"
    return "ja" if (cjk_count / total) > 0.2 else "en"


def truncate(text: str, max_length: int = 500) -> str:
    """Truncate text to max_length, adding ellipsis if needed."""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."


def clean_whitespace(text: str) -> str:
    """Normalize whitespace in text."""
    text = re.sub(r"\s+", " ", text)
    return text.strip()
