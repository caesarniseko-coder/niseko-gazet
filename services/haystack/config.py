import os
from dotenv import load_dotenv

load_dotenv()

# Service
HAYSTACK_PORT = int(os.getenv("HAYSTACK_PORT", "8001"))
HAYSTACK_HOST = os.getenv("HAYSTACK_HOST", "0.0.0.0")

# LLM (Ollama)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Next.js API (for field note creation)
NEXTJS_API_URL = os.getenv("NEXTJS_API_URL", "http://localhost:3000")
HAYSTACK_BOT_EMAIL = os.getenv("HAYSTACK_BOT_EMAIL", "haystack-bot@niseko-gazet.local")
HAYSTACK_BOT_PASSWORD = os.getenv("HAYSTACK_BOT_PASSWORD", "")

# External APIs
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")

# Content aggregation (search APIs + social media)
CONTENT_AGGREGATION_ENABLED = os.getenv("CONTENT_AGGREGATION_ENABLED", "false").lower() == "true"
CONTENT_QUALITY_THRESHOLD = float(os.getenv("CONTENT_QUALITY_THRESHOLD", "0.6"))
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
BRAVE_SEARCH_API_KEY = os.getenv("BRAVE_SEARCH_API_KEY", "")
CURRENTS_API_KEY = os.getenv("CURRENTS_API_KEY", "")
GNEWS_API_KEY = os.getenv("GNEWS_API_KEY", "")
SOCIAL_POLL_INTERVAL_MINUTES = int(os.getenv("SOCIAL_POLL_INTERVAL_MINUTES", "30"))

# Cloud LLM Fallback
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Scheduling
MAIN_POLL_INTERVAL_MINUTES = int(os.getenv("MAIN_POLL_INTERVAL_MINUTES", "15"))
WEATHER_POLL_INTERVAL_MINUTES = int(os.getenv("WEATHER_POLL_INTERVAL_MINUTES", "60"))
TIP_POLL_INTERVAL_MINUTES = int(os.getenv("TIP_POLL_INTERVAL_MINUTES", "5"))

# Quality thresholds
MIN_RELEVANCE_SCORE = float(os.getenv("MIN_RELEVANCE_SCORE", "0.3"))
MIN_CONFIDENCE_SCORE = int(os.getenv("MIN_CONFIDENCE_SCORE", "30"))
DUPLICATE_SIMILARITY_THRESHOLD = float(os.getenv("DUPLICATE_SIMILARITY_THRESHOLD", "0.85"))
