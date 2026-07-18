"""Quality-path translation through an OpenAI-compatible LLM API."""

from dataclasses import dataclass, field
import os
import time
from typing import List

from model_errors import ModelUnavailableError


LANG_NAMES = {
    "vi": "Vietnamese",
    "en": "English",
}


@dataclass
class QualityContext:
    """Context passed to the quality translation path."""

    asr_text: str
    source_lang: str = "vi"
    target_lang: str = "en"
    sliding_window: List[str] = field(default_factory=list)
    glossary: dict = field(default_factory=dict)
    acronym_table: dict = field(default_factory=dict)
    rag_chunks: List[str] = field(default_factory=list)


@dataclass
class QualityResult:
    """Quality-path translation result."""

    source_text: str
    translated_text: str
    is_fast_path: bool = False
    latency_ms: float = 0.0
    timed_out: bool = False


class QualityPathTranslator:
    """Translate with a real LLM endpoint that speaks the OpenAI API."""

    def __init__(self, tier: str = "server", client: object | None = None, model: str | None = None):
        from config.fpt_models import FPT_BASE_URL, FPT_API_KEY, MODELS as FPT

        self.tier = tier
        self._timeout = float(
            os.getenv("FPT_AI_FACTORY_TIMEOUT")
            or os.getenv("QUALITY_LLM_TIMEOUT")
            or ("1.0" if tier == "server" else "1.5"),
        )
        self.model = model or os.getenv("FPT_AI_FACTORY_MODEL") or os.getenv("QUALITY_LLM_MODEL") or FPT["quality_llm"]
        self.fallback_model = os.getenv("FPT_QUALITY_FALLBACK") or FPT["quality_llm_fallback"]
        self.base_url = os.getenv("FPT_AI_FACTORY_BASE_URL") or os.getenv("QUALITY_LLM_BASE_URL") or FPT_BASE_URL
        self.api_key = (
            os.getenv("FPT_AI_FACTORY_API_KEY")
            or os.getenv("QUALITY_LLM_API_KEY")
            or os.getenv("OPENAI_API_KEY")
            or FPT_API_KEY
        )
        self._client = client

    def preflight(self) -> str:
        """Validate the configured quality-translation client."""

        if self._client is None and (
            not self.api_key or self.api_key.startswith("replace-with-")
        ):
            raise ModelUnavailableError(
                "A valid API key is required for quality-path translation.",
            )
        self._ensure_client()
        return f"quality:{self.model}"

    def translate(self, context: QualityContext) -> QualityResult:
        started = time.perf_counter()
        client = self._ensure_client()
        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=self._messages(context),
                temperature=0,
                timeout=self._timeout,
            )
        except Exception:
            # ponytail: fallback to faster FPT model on primary timeout/error
            if self.fallback_model and self.fallback_model != self.model:
                response = client.chat.completions.create(
                    model=self.fallback_model,
                    messages=self._messages(context),
                    temperature=0,
                    timeout=self._timeout,
                )
            else:
                raise
        translated = (response.choices[0].message.content or "").strip()
        latency_ms = (time.perf_counter() - started) * 1000
        return QualityResult(
            source_text=context.asr_text,
            translated_text=translated,
            latency_ms=latency_ms,
            timed_out=latency_ms > self._timeout * 1000,
        )

    def _ensure_client(self):
        if not self.model:
            raise ModelUnavailableError(
                "Set FPT_AI_FACTORY_MODEL or QUALITY_LLM_MODEL for quality-path translation.",
            )

        if self._client is not None:
            return self._client

        if not self.api_key and not self.base_url:
            raise ModelUnavailableError(
                "Set FPT_AI_FACTORY_API_KEY and FPT_AI_FACTORY_BASE_URL, or QUALITY_LLM_* aliases.",
            )

        try:
            from openai import OpenAI
        except ImportError as error:
            raise ModelUnavailableError("openai>=1.30 is required for quality-path translation.") from error

        kwargs = {"api_key": self.api_key or "local"}
        if self.base_url:
            kwargs["base_url"] = self.base_url
        self._client = OpenAI(**kwargs)
        return self._client

    def _messages(self, context: QualityContext) -> list[dict[str, str]]:
        source_name = LANG_NAMES.get(context.source_lang, context.source_lang)
        target_name = LANG_NAMES.get(context.target_lang, context.target_lang)
        return [
            {
                "role": "system",
                "content": (
                    "You are a real-time meeting translator. "
                    "Translate faithfully, preserve numbers, names, acronyms, and intent. "
                    "Return only the translated text."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Translate from {source_name} to {target_name}.\n"
                    f"Source:\n{context.asr_text}\n\n"
                    f"Recent conversation:\n{self._format_list(context.sliding_window)}\n\n"
                    f"Glossary:\n{self._format_dict(context.glossary)}\n\n"
                    f"Acronyms:\n{self._format_dict(context.acronym_table)}\n\n"
                    f"RAG context:\n{self._format_list(context.rag_chunks)}"
                ),
            },
        ]

    def _format_list(self, values: list[str]) -> str:
        return "\n".join(f"- {value}" for value in values if value) or "- none"

    def _format_dict(self, values: dict) -> str:
        return "\n".join(f"- {key}: {self._format_value(value)}" for key, value in values.items()) or "- none"

    def _format_value(self, value) -> str:
        if isinstance(value, dict):
            full = value.get("full") or value.get("full_name") or ""
            vi = value.get("vi") or ""
            en = value.get("en") or ""
        elif isinstance(value, (tuple, list)) and len(value) == 3:
            full, vi, en = value
        else:
            return str(value)

        details = []
        if vi:
            details.append(f"VI: {vi}")
        if en:
            details.append(f"EN: {en}")
        return f"{full} ({', '.join(details)})" if details else str(full)
