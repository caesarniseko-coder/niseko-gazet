import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
CIZER_PORT = int(os.getenv("CIZER_PORT", "8000"))
CIZER_HOST = os.getenv("CIZER_HOST", "0.0.0.0")
