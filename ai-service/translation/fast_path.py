"""Fast-path translation backed by NLLB through Transformers."""

from dataclasses import dataclass
import os
import time

from model_errors import ModelUnavailableError


LANG_CODES = {
    "vi": "vie_Latn",
    "en": "eng_Latn",
}


@dataclass
class TranslationResult:
    """Fast-path translation result."""

    source_text: str
    translated_text: str
    is_fast_path: bool = True
    latency_ms: float = 0.0


class FastPathTranslator:
    """Translate with a real seq2seq model, defaulting to NLLB."""

    def __init__(
        self,
        tier: str = "server",
        tokenizer: object | None = None,
        model: object | None = None,
        model_name: str | None = None,
    ):
        self.tier = tier
        self.model_name = model_name or os.getenv(
            "FAST_MT_MODEL",
            "facebook/nllb-200-3.3B" if tier == "server" else "facebook/nllb-200-distilled-600M",
        )
        self.device = os.getenv("FAST_MT_DEVICE", self._default_device())
        self.max_new_tokens = int(os.getenv("FAST_MT_MAX_NEW_TOKENS", "256"))
        self._tokenizer = tokenizer
        self._model = model
        self._torch = None

    def preflight(self) -> str:
        """Load the configured local fast-translation model."""

        self._ensure_model()
        return f"nllb:{self.model_name}"

    def translate(self, text: str, source_lang: str = "vi", target_lang: str = "en") -> TranslationResult:
        started = time.perf_counter()
        text = text.strip()
        if not text:
            return TranslationResult(source_text=text, translated_text="", latency_ms=0.0)

        tokenizer, model = self._ensure_model()
        source_code = self._language_code(source_lang)
        target_code = self._language_code(target_lang)

        if hasattr(tokenizer, "src_lang"):
            tokenizer.src_lang = source_code

        inputs = tokenizer(text, return_tensors="pt", truncation=True)
        if hasattr(inputs, "to"):
            inputs = inputs.to(self.device)
        elif self._torch is not None:
            inputs = {
                key: value.to(self.device) if hasattr(value, "to") else value
                for key, value in inputs.items()
            }

        forced_bos_token_id = tokenizer.convert_tokens_to_ids(target_code)
        with self._no_grad():
            output = model.generate(
                **inputs,
                forced_bos_token_id=forced_bos_token_id,
                max_new_tokens=self.max_new_tokens,
            )

        translated = tokenizer.batch_decode(output, skip_special_tokens=True)[0].strip()
        return TranslationResult(
            source_text=text,
            translated_text=translated,
            latency_ms=(time.perf_counter() - started) * 1000,
        )

    def _ensure_model(self):
        if self._tokenizer is not None and self._model is not None:
            return self._tokenizer, self._model

        try:
            import torch
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        except ImportError as error:
            raise ModelUnavailableError(
                "transformers, sentencepiece, and torch are required for fast translation.",
            ) from error

        try:
            self._torch = torch
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModelForSeq2SeqLM.from_pretrained(self.model_name)
            if self.device == "cuda" and torch.cuda.is_available():
                self._model = self._model.to("cuda")
            else:
                self.device = "cpu"
        except Exception as error:
            raise ModelUnavailableError(
                f"Fast translation model '{self.model_name}' is unavailable. "
                "Set FAST_MT_MODEL to a local HuggingFace model path or allow download.",
            ) from error

        return self._tokenizer, self._model

    def _default_device(self) -> str:
        try:
            import torch

            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    def _language_code(self, lang: str) -> str:
        try:
            return LANG_CODES[lang]
        except KeyError as error:
            raise ValueError(f"Unsupported language: {lang}") from error

    def _no_grad(self):
        if self._torch is None:
            from contextlib import nullcontext

            return nullcontext()
        return self._torch.no_grad()
