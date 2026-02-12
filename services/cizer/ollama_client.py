import httpx
import json
from config import OLLAMA_BASE_URL, OLLAMA_MODEL


async def generate(prompt: str, system: str = "", temperature: float = 0.3) -> str:
    """Send a prompt to the Ollama API and return the response text."""
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


async def generate_json(prompt: str, system: str = "", temperature: float = 0.1) -> dict:
    """Generate a response and parse it as JSON."""
    raw = await generate(prompt, system, temperature)

    # Try to extract JSON from the response
    # The model may wrap it in markdown code blocks
    text = raw.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    return json.loads(text.strip())


async def check_health() -> dict:
    """Check if Ollama is running and the model is available."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Check Ollama is running
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            models = resp.json().get("models", [])
            model_names = [m["name"] for m in models]

            has_model = any(OLLAMA_MODEL in name for name in model_names)

            return {
                "ollama": "connected",
                "model": OLLAMA_MODEL,
                "model_available": has_model,
                "available_models": model_names,
            }
    except httpx.ConnectError:
        return {
            "ollama": "disconnected",
            "model": OLLAMA_MODEL,
            "model_available": False,
            "error": "Cannot connect to Ollama. Is it running?",
        }
    except Exception as e:
        return {
            "ollama": "error",
            "model": OLLAMA_MODEL,
            "model_available": False,
            "error": str(e),
        }
