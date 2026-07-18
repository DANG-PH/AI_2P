"""Centralized FPT AI Marketplace model registry.

All FPT model names, base URL, and env-var lookups live here so that
ASR, RAG, and Quality-Path modules import from one place instead of
hardcoding model strings everywhere.
"""

import os

FPT_BASE_URL = os.getenv("FPT_BASE_URL", "https://mkp-api.fptcloud.com")
FPT_API_KEY = os.getenv("FPT_API_KEY") or os.getenv("FPT_AI_FACTORY_API_KEY") or os.getenv("FPT_AI")

# ponytail: single dict, modules pick what they need.
MODELS = {
    # Quality-path LLM (chat/completions)
    "quality_llm": os.getenv("FPT_QUALITY_MODEL", "SaoLa3.1-medium"),
    "quality_llm_fallback": os.getenv("FPT_QUALITY_FALLBACK", "DeepSeek-V4-Flash"),
    "fast_translation": (
        os.getenv("FPT_FAST_MT_MODEL")
        or os.getenv("FPT_QUALITY_FALLBACK", "DeepSeek-V4-Flash")
    ),

    # ASR (audio/transcriptions)
    "asr": os.getenv("FPT_ASR_MODEL", "FPT.AI-whisper-large-v3-turbo"),
    "asr_fallback": os.getenv("FPT_ASR_FALLBACK", "FPT.AI-whisper-medium"),
    "asr_vi": "FPT.AI-ViTs",

    # Embedding (embeddings)
    "embedding": os.getenv("FPT_EMBEDDING_MODEL", "Vietnamese_Embedding"),
    "embedding_fallback": "multilingual-e5-large",

    # Reranker (v1/rerank)
    "reranker": os.getenv("FPT_RERANKER_MODEL", "bge-reranker-v2-m3"),
}


def get_fpt_client():
    """Return an OpenAI client pointed at FPT AI Marketplace."""
    try:
        from openai import OpenAI
    except ImportError as error:
        from model_errors import ModelUnavailableError
        raise ModelUnavailableError("openai>=1.30 is required for FPT AI Marketplace.") from error

    api_key = os.getenv("FPT_API_KEY") or os.getenv("FPT_AI_FACTORY_API_KEY") or os.getenv("FPT_AI")
    base_url = os.getenv("FPT_BASE_URL", FPT_BASE_URL)
    return OpenAI(api_key=api_key or "missing", base_url=base_url)
