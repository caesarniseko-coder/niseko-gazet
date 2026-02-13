"""Ollama LLM client for Haystack with cloud fallback. Ported from Cizer's ollama_client.py."""

import json
import httpx
import structlog

from config import (
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
)

logger = structlog.get_logger()

# Errors that indicate Ollama is unreachable (triggers fallback)
_OLLAMA_UNAVAILABLE = (httpx.ConnectError, httpx.TimeoutException)


async def _generate_ollama(prompt: str, system: str, temperature: float) -> str:
    """Generate text using the local Ollama instance."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "system": system,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": 4096,
                },
            },
        )
        response.raise_for_status()
        return response.json()["response"]


async def _generate_anthropic(prompt: str, system: str, temperature: float) -> str:
    """Generate text using the Anthropic Messages API via httpx."""
    messages = [{"role": "user", "content": prompt}]
    body: dict = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": 4096,
        "messages": messages,
        "temperature": temperature,
    }
    if system:
        body["system"] = system

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=body,
        )
        response.raise_for_status()
        data = response.json()
        # Extract text from the first content block
        return data["content"][0]["text"]


async def _generate_openai(prompt: str, system: str, temperature: float) -> str:
    """Generate text using the OpenAI Chat Completions API via httpx."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENAI_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": 4096,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


async def generate(prompt: str, system: str = "", temperature: float = 0.3) -> str:
    """Send a prompt to the LLM and return the response text.

    Tries Ollama first. If Ollama is unreachable (connection error or timeout),
    falls back to Anthropic Claude, then OpenAI. Fallback is NOT triggered by
    Ollama returning an HTTP error or the model producing bad output.
    """
    # --- Try Ollama (primary) ---
    try:
        result = await _generate_ollama(prompt, system, temperature)
        logger.info("llm.generate", provider="ollama", model=OLLAMA_MODEL)
        return result
    except _OLLAMA_UNAVAILABLE as exc:
        logger.warning("llm.ollama_unavailable", error=str(exc))

    # --- Try Anthropic (first fallback) ---
    if ANTHROPIC_API_KEY:
        try:
            result = await _generate_anthropic(prompt, system, temperature)
            logger.info("llm.generate", provider="anthropic", model=ANTHROPIC_MODEL)
            return result
        except Exception as exc:
            logger.warning("llm.anthropic_failed", error=str(exc))
    else:
        logger.debug("llm.anthropic_skipped", reason="no API key configured")

    # --- Try OpenAI (second fallback) ---
    if OPENAI_API_KEY:
        try:
            result = await _generate_openai(prompt, system, temperature)
            logger.info("llm.generate", provider="openai", model=OPENAI_MODEL)
            return result
        except Exception as exc:
            logger.warning("llm.openai_failed", error=str(exc))
    else:
        logger.debug("llm.openai_skipped", reason="no API key configured")

    # --- All providers failed ---
    raise RuntimeError(
        "All LLM providers unavailable. Tried: Ollama"
        + (", Anthropic" if ANTHROPIC_API_KEY else "")
        + (", OpenAI" if OPENAI_API_KEY else "")
    )


async def generate_json(prompt: str, system: str = "", temperature: float = 0.1) -> dict:
    """Generate a response and parse it as JSON."""
    raw = await generate(prompt, system, temperature)

    text = raw.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    try:
        return json.loads(text.strip())
    except json.JSONDecodeError as e:
        logger.error("llm.json_parse_failed", error=str(e), raw_text=text[:200])
        raise ValueError(f"LLM returned invalid JSON: {e}")


async def check_health() -> dict:
    """Check which LLM providers are available."""
    health: dict = {"providers": {}}

    # --- Ollama ---
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            models = resp.json().get("models", [])
            model_names = [m["name"] for m in models]
            has_model = any(OLLAMA_MODEL in name for name in model_names)

            health["providers"]["ollama"] = {
                "status": "connected",
                "model": OLLAMA_MODEL,
                "model_available": has_model,
            }
    except httpx.ConnectError:
        health["providers"]["ollama"] = {
            "status": "disconnected",
            "model": OLLAMA_MODEL,
            "model_available": False,
            "error": "Cannot connect to Ollama",
        }
    except Exception as e:
        health["providers"]["ollama"] = {
            "status": "error",
            "model": OLLAMA_MODEL,
            "model_available": False,
            "error": str(e),
        }

    # --- Anthropic ---
    if ANTHROPIC_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                    },
                )
                # A 405 Method Not Allowed means the endpoint is reachable and the key
                # was not immediately rejected -- good enough for a health check.
                health["providers"]["anthropic"] = {
                    "status": "available",
                    "model": ANTHROPIC_MODEL,
                }
        except Exception as e:
            health["providers"]["anthropic"] = {
                "status": "error",
                "model": ANTHROPIC_MODEL,
                "error": str(e),
            }
    else:
        health["providers"]["anthropic"] = {
            "status": "not_configured",
            "model": ANTHROPIC_MODEL,
        }

    # --- OpenAI ---
    if OPENAI_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                )
                if resp.status_code == 200:
                    health["providers"]["openai"] = {
                        "status": "available",
                        "model": OPENAI_MODEL,
                    }
                else:
                    health["providers"]["openai"] = {
                        "status": "auth_error",
                        "model": OPENAI_MODEL,
                        "error": f"HTTP {resp.status_code}",
                    }
        except Exception as e:
            health["providers"]["openai"] = {
                "status": "error",
                "model": OPENAI_MODEL,
                "error": str(e),
            }
    else:
        health["providers"]["openai"] = {
            "status": "not_configured",
            "model": OPENAI_MODEL,
        }

    # Determine overall status: healthy if at least one provider works
    ollama_ok = health["providers"]["ollama"].get("status") == "connected"
    anthropic_ok = health["providers"].get("anthropic", {}).get("status") == "available"
    openai_ok = health["providers"].get("openai", {}).get("status") == "available"

    if ollama_ok:
        health["status"] = "healthy"
        health["active_provider"] = "ollama"
    elif anthropic_ok:
        health["status"] = "degraded"
        health["active_provider"] = "anthropic"
    elif openai_ok:
        health["status"] = "degraded"
        health["active_provider"] = "openai"
    else:
        health["status"] = "unhealthy"
        health["active_provider"] = None

    return health
