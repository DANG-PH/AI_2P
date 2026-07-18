"""Whisper-backed ASR streaming facade."""

from dataclasses import dataclass, field
import io
import logging
import os
import threading
from typing import List, Optional
import wave

import numpy as np

from model_errors import ModelUnavailableError


LOGGER = logging.getLogger(__name__)
EMPTY_AUDIO_PROBE_ERROR = "invalid response from transcription service"


def _is_inconclusive_empty_audio_probe(error: Exception) -> bool:
    """Recognize FPT's response when its ASR receives the silent probe WAV."""

    status_code = getattr(error, "status_code", None)
    body = getattr(error, "body", None)
    details = f"{error} {body or ''}".casefold()
    return status_code == 500 and EMPTY_AUDIO_PROBE_ERROR in details


@dataclass
class ASRWord:
    """A recognized word with timing."""

    text: str
    start: float
    end: float
    confidence: float = 1.0
    language: str = "unknown"


@dataclass
class ASRSegment:
    """A partial or final ASR segment."""

    text: str = ""
    words: List[ASRWord] = field(default_factory=list)
    speaker_id: Optional[str] = None
    stability_score: float = 0.0
    is_final: bool = False
    segment_id: str = ""
    is_overlap: bool = False
    timestamp_start: float = 0.0
    timestamp_end: float = 0.0


class ASREngine:
    """Transcribe normalized audio with openai-whisper or FPT ASR API."""

    def __init__(
        self,
        tier: str = "server",
        model: object | None = None,
        model_name: str | None = None,
    ):
        self.tier = tier
        self.model_name = model_name or os.getenv(
            "WHISPER_MODEL",
            "large-v3" if tier == "server" else "small",
        )
        self.model_dir = os.getenv("WHISPER_MODEL_DIR") or None
        self.device = os.getenv("WHISPER_DEVICE", self._default_device())
        self.language = os.getenv("WHISPER_LANGUAGE") or None
        self.initial_prompt = os.getenv("WHISPER_INITIAL_PROMPT") or None
        self._model = model
        self._counter = 0
        self._use_fpt_asr = os.getenv("FPT_ASR", "").lower() == "true"
        self._fpt_client = None
        self._preflight_lock = threading.Lock()
        self._preflight_result: str | None = None

    def preflight(self) -> str:
        """Validate the configured ASR path once, including remote access."""

        if self._preflight_result is not None:
            return self._preflight_result

        with self._preflight_lock:
            if self._preflight_result is not None:
                return self._preflight_result

            if self._use_fpt_asr:
                api_key = (
                    os.getenv("FPT_API_KEY")
                    or os.getenv("FPT_AI_FACTORY_API_KEY")
                    or os.getenv("FPT_AI")
                )
                if (
                    not api_key
                    or api_key.startswith("replace-with-")
                    or api_key == "missing"
                ):
                    raise ModelUnavailableError(
                        "A valid FPT API key is required when FPT_ASR=true.",
                    )

                if self._fpt_client is None:
                    from config.fpt_models import get_fpt_client

                    self._fpt_client = get_fpt_client()

                from config.fpt_models import MODELS as FPT

                model_name = os.getenv("FPT_ASR_MODEL", FPT["asr"])
                try:
                    self._transcribe_fpt(
                        np.zeros(8000, dtype=np.float32),
                        {},
                        {},
                        language=None,
                        timeout=float(
                            os.getenv("FPT_ASR_PREFLIGHT_TIMEOUT", "10"),
                        ),
                    )
                except Exception as error:
                    if _is_inconclusive_empty_audio_probe(error):
                        LOGGER.warning(
                            "FPT ASR readiness endpoint was reached for model "
                            "%s, but the silent probe contained no transcribable "
                            "speech; accepting connectivity readiness.",
                            model_name,
                        )
                    else:
                        raise ModelUnavailableError(
                            f"FPT ASR model '{model_name}' failed its readiness "
                            f"probe: {error}",
                        ) from error
                self._preflight_result = f"fpt:{model_name}"
            else:
                self._ensure_model()
                self._preflight_result = f"whisper:{self.model_name}"

            return self._preflight_result

    def transcribe_stream(
        self,
        audio_segment,
        glossary: dict | None = None,
        acronym_table: dict | None = None,
        language: str | None = None,
    ) -> ASRSegment:
        self._counter += 1
        segment_id = getattr(audio_segment, "segment_id", "") or f"asr-{self._counter}"
        effective_language = (
            language if language in ("vi", "en") else self.language
        )

        if not getattr(audio_segment, "is_speech", True):
            return ASRSegment(segment_id=segment_id, stability_score=0.0)

        audio = np.asarray(getattr(audio_segment, "audio", []), dtype=np.float32).flatten()
        if audio.size == 0:
            return ASRSegment(segment_id=segment_id, stability_score=0.0)

        if self._use_fpt_asr:
            try:
                result = self._transcribe_fpt(
                    audio,
                    glossary,
                    acronym_table,
                    language=effective_language,
                )
            except Exception as error:
                raise ModelUnavailableError(f"FPT ASR failed: {error}") from error
        else:
            result = self._transcribe_local(
                audio,
                glossary,
                acronym_table,
                language=effective_language,
            )

        text = str(result.get("text", "")).strip()
        detected_language = str(
            result.get("language") or effective_language or "unknown",
        )
        words = self._extract_words(result, detected_language)

        return ASRSegment(
            text=text,
            words=words,
            speaker_id=getattr(audio_segment, "speaker_id", None),
            stability_score=self._stability(result, words),
            is_final=bool(text),
            segment_id=segment_id,
            is_overlap=bool(getattr(audio_segment, "is_overlap", False)),
            timestamp_start=float(getattr(audio_segment, "timestamp_start", 0.0) or 0.0),
            timestamp_end=float(getattr(audio_segment, "timestamp_end", 0.0) or 0.0),
        )

    def _transcribe_local(
        self,
        audio,
        glossary,
        acronym_table,
        language: str | None = None,
    ):
        model = self._ensure_model()
        options = {
            "fp16": self.device == "cuda",
            "verbose": False,
            "word_timestamps": True,
        }
        if language:
            options["language"] = language
        prompt = self._prompt(
            glossary or {},
            acronym_table or {},
            language=language,
        )
        if prompt:
            options["initial_prompt"] = prompt

        try:
            return model.transcribe(audio, **options)
        except TypeError:
            options.pop("word_timestamps", None)
            return model.transcribe(audio, **options)

    def _transcribe_fpt(
        self,
        audio,
        glossary,
        acronym_table,
        language: str | None = None,
        timeout: float = 30,
    ):
        if audio.dtype == np.float32:
            audio_int16 = (audio * 32767).astype(np.int16)
        else:
            audio_int16 = audio.astype(np.int16)

        wav_io = io.BytesIO()
        with wave.open(wav_io, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(16000)
            wav_file.writeframes(audio_int16.tobytes())

        wav_bytes = wav_io.getvalue()

        if self._fpt_client is None:
            from config.fpt_models import get_fpt_client
            self._fpt_client = get_fpt_client()

        from config.fpt_models import MODELS as FPT
        model_name = os.getenv("FPT_ASR_MODEL", FPT["asr"])
        prompt = self._prompt(
            glossary or {},
            acronym_table or {},
            language=language,
        )

        kwargs = {
            "model": model_name,
            "file": ("speech.wav", wav_bytes, "audio/wav"),
            "response_format": "verbose_json",
            "temperature": 0.0,
            "timeout": timeout,
        }
        if language:
            kwargs["language"] = language
        if prompt:
            kwargs["prompt"] = prompt

        try:
            response = self._fpt_client.audio.transcriptions.create(**kwargs)
        except Exception:
            # Fallback to json response format if verbose_json fails
            kwargs["response_format"] = "json"
            response = self._fpt_client.audio.transcriptions.create(**kwargs)

        if hasattr(response, "model_dump"):
            return response.model_dump()
        if hasattr(response, "dict"):
            return response.dict()
        if isinstance(response, dict):
            return response

        return {
            "text": getattr(response, "text", ""),
            "segments": getattr(response, "segments", []),
            "language": getattr(response, "language", language or "unknown"),
        }

    def _prompt(
        self,
        glossary: dict,
        acronym_table: dict,
        language: str | None = None,
    ) -> str:
        language_prompts = {
            "en": (
                "English meeting transcript. The speaker is speaking English. "
                "Transcribe the audio in English."
            ),
            "vi": (
                "Bản ghi cuộc họp tiếng Việt. Người nói đang nói tiếng Việt. "
                "Hãy chép lại âm thanh bằng tiếng Việt."
            ),
        }
        parts = [language_prompts[language]] if language in language_prompts else []
        if self.initial_prompt:
            parts.append(self.initial_prompt)
        if glossary:
            terms = ", ".join(f"{key}={value}" for key, value in list(glossary.items())[:40])
            parts.append(f"Meeting glossary: {terms}")
        if acronym_table:
            acronyms = ", ".join(
                f"{key}={value[0] if isinstance(value, (tuple, list)) and value else value}"
                for key, value in list(acronym_table.items())[:40]
            )
            parts.append(f"Acronyms: {acronyms}")
        return "\n".join(parts)

    def _ensure_model(self):
        if self._model is not None:
            return self._model

        try:
            import whisper
        except ImportError as error:
            raise ModelUnavailableError(
                "openai-whisper is required for local ASR. Install "
                "ai-service/requirements.txt.",
            ) from error

        try:
            kwargs = {"device": self.device}
            if self.model_dir:
                kwargs["download_root"] = self.model_dir
            self._model = whisper.load_model(self.model_name, **kwargs)
        except Exception as error:
            raise ModelUnavailableError(
                f"Whisper model '{self.model_name}' is unavailable. "
                "Set WHISPER_MODEL/WHISPER_MODEL_DIR to a local model or allow download.",
            ) from error

        return self._model

    def _default_device(self) -> str:
        try:
            import torch

            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    def _extract_words(self, result: dict, language: str) -> List[ASRWord]:
        words: List[ASRWord] = []
        for segment in result.get("segments", []) or []:
            for word in segment.get("words", []) or []:
                token = str(word.get("word", "")).strip()
                if token:
                    words.append(
                        ASRWord(
                            text=token,
                            start=float(word.get("start", 0.0)),
                            end=float(word.get("end", 0.0)),
                            confidence=float(word.get("probability", 1.0)),
                            language=language,
                        ),
                    )
        return words

    def _stability(self, result: dict, words: List[ASRWord]) -> float:
        if words:
            return max(0.0, min(1.0, sum(word.confidence for word in words) / len(words)))

        segments = result.get("segments", []) or []
        if not segments:
            # ponytail: API call with no segments but has text -> return high stability
            return 0.9 if result.get("text") else 0.0

        avg_logprob = sum(float(item.get("avg_logprob", -1.0)) for item in segments) / len(segments)
        return max(0.0, min(1.0, 1.0 + avg_logprob))
