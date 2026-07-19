from __future__ import annotations

import os
from dotenv import load_dotenv

load_dotenv()


def _require(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"Missing required env var: {key}")
    return val


def _optional(key: str, default: str) -> str:
    return os.getenv(key, default)


FPT_BASE_URL: str = _optional("FPT_BASE_URL", "https://mkp-api.fptcloud.com")
FPT_API_KEY: str = _require("FPT_API_KEY")
FPT_ASR_MODEL_VI: str = _optional(
    "FPT_ASR_MODEL_VI", _optional("FPT_ASR_MODEL", "FPT.AI-whisper-large-v3-turbo")
)
FPT_ASR_MODEL_EN: str = _optional("FPT_ASR_MODEL_EN", "whisper-large-v3-turbo")
FPT_ASR_MODEL: str = FPT_ASR_MODEL_VI  # Backward-compatible alias
FPT_LLM_MODEL: str = _optional("FPT_LLM_MODEL", "SaoLa3.1-medium")


def get_asr_model(language: str) -> str:
    return FPT_ASR_MODEL_EN if language == "en" else FPT_ASR_MODEL_VI

WS_HOST: str = _optional("WS_HOST", "0.0.0.0")
WS_PORT: int = int(_optional("WS_PORT", "8765"))

# Audio pipeline
VAD_THRESHOLD: float = float(_optional("VAD_THRESHOLD", "0.5"))
SILENCE_MS: int = int(_optional("SILENCE_MS", "400"))
INTERIM_INTERVAL_S: float = float(_optional("INTERIM_INTERVAL_S", "0.5"))
