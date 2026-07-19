"""FPT ASR — Speech-to-Text via FPT AI Marketplace.

Endpoint: POST https://mkp-api.fptcloud.com/v1/audio/transcriptions
OpenAI-compatible, uses openai.AsyncOpenAI client.
"""
from __future__ import annotations

import io
import logging

import numpy as np
import scipy.io.wavfile as wav
from openai import AsyncOpenAI

from src import config

logger = logging.getLogger(__name__)

_SAMPLE_RATE = 16_000

# Module-level client — one shared instance (connection pool)
_client = AsyncOpenAI(
    api_key=config.FPT_API_KEY,
    base_url=config.FPT_BASE_URL,
    max_retries=0,
)


def _pcm_to_wav_bytes(pcm_float: np.ndarray) -> bytes:
    """Convert float32 [-1, 1] numpy array to 16-bit PCM WAV bytes."""
    pcm_int16 = (pcm_float * 32767).clip(-32768, 32767).astype(np.int16)
    buf = io.BytesIO()
    wav.write(buf, _SAMPLE_RATE, pcm_int16)
    return buf.getvalue()


async def transcribe(pcm_float: np.ndarray, language: str) -> str:
    """Transcribe audio via FPT Whisper API.

    Args:
        pcm_float: float32 mono array, 16 kHz.
        language: 'vi' or 'en'.

    Returns:
        Transcribed text, or '' on failure.
    """
    if len(pcm_float) < _SAMPLE_RATE * 0.4:  # skip < 400ms — noise / short breath
        return ""

    wav_bytes = _pcm_to_wav_bytes(pcm_float)

    # openai expects a file-like with a .name attribute
    audio_file = io.BytesIO(wav_bytes)
    audio_file.name = "audio.wav"

    model_name = config.get_asr_model(language)
    try:
        response = await _client.audio.transcriptions.create(
            model=model_name,
            file=audio_file,
            language=language,
            response_format="json",
            timeout=30,
        )
        text = response.text.strip()
        logger.debug("ASR [%s|%s]: %r", language, model_name, text[:80])
        return text
    except Exception as exc:  # noqa: BLE001
        logger.error("ASR error: %s", exc)
        return ""
