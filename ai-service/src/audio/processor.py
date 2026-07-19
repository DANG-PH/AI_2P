"""Audio processor: Silero VAD + DeepFilterNet denoising.

Loaded once at startup (heavy models), shared across all sessions.
Silero VAD v6 uses `from silero_vad import load_silero_vad` — not torch.hub.
"""
from __future__ import annotations

import logging

import numpy as np
import torch

logger = logging.getLogger(__name__)

_SAMPLE_RATE = 16_000


class AudioProcessor:
    """Thread-safe after __init__ (inference only, no mutable model state)."""

    def __init__(self, vad_threshold: float = 0.5) -> None:
        self._threshold = vad_threshold
        self._vad_model = self._load_silero_vad()
        self._df_state, self._df_model = self._load_deepfilternet()
        logger.info("AudioProcessor ready (VAD threshold=%.2f)", vad_threshold)

    # ------------------------------------------------------------------
    # Public API  (called from thread pool via run_in_executor)
    # ------------------------------------------------------------------

    def is_speech(self, pcm_float: np.ndarray) -> bool:
        """Return True if Silero VAD detects voice.

        pcm_float: float32 1-D array, 16 kHz mono.
        """
        # Silero VAD expects 1-D tensor [T]
        tensor = torch.from_numpy(pcm_float)
        with torch.no_grad():
            prob: float = self._vad_model(tensor, _SAMPLE_RATE).item()
        return prob >= self._threshold

    def denoise(self, pcm_float: np.ndarray) -> np.ndarray:
        """DeepFilterNet noise suppression. Falls back to passthrough if unavailable."""
        if self._df_model is None:
            return pcm_float
        try:
            from df import enhance  # deepfilternet

            tensor = torch.from_numpy(pcm_float).unsqueeze(0)  # [1, T]
            enhanced = enhance(self._df_model, self._df_state, tensor)
            return enhanced.squeeze(0).numpy()
        except Exception as exc:  # noqa: BLE001
            logger.warning("DeepFilterNet enhance failed (%s); using raw audio", exc)
            return pcm_float

    # ------------------------------------------------------------------
    # Loaders
    # ------------------------------------------------------------------

    @staticmethod
    def _load_silero_vad():
        logger.info("Loading Silero VAD …")
        import sys
        if "torchaudio" not in sys.modules:
            try:
                import torchaudio
            except OSError as exc:
                logger.warning("torchaudio DLL load failed (%s); mocking to allow silero_vad ONNX loading", exc)
                import types
                dummy_ta = types.ModuleType("torchaudio")
                dummy_ta.__version__ = "0.0.0"
                sys.modules["torchaudio"] = dummy_ta

        try:
            # silero-vad >= 5.0 ships its own loader
            from silero_vad import load_silero_vad  # type: ignore[import]

            model = load_silero_vad(onnx=True)
            logger.info("Silero VAD loaded via silero_vad package (ONNX)")
            return model
        except ImportError:
            # Fallback: older API via torch.hub
            logger.info("Falling back to torch.hub for Silero VAD")
            model, _ = torch.hub.load(
                "snakers4/silero-vad",
                "silero_vad",
                force_reload=False,
                onnx=True,
            )
            return model

    @staticmethod
    def _load_deepfilternet():
        logger.info("Loading DeepFilterNet …")
        try:
            from df import init_df  # type: ignore[import]

            model, df_state, _ = init_df()
            logger.info("DeepFilterNet loaded")
            return df_state, model
        except ImportError:
            logger.warning(
                "deepfilternet not installed — noise suppression disabled. "
                "Install: pip install deepfilternet"
            )
            return None, None


# Singleton
_processor: AudioProcessor | None = None


def init_processor(vad_threshold: float = 0.5) -> AudioProcessor:
    global _processor  # noqa: PLW0603
    _processor = AudioProcessor(vad_threshold=vad_threshold)
    return _processor


def get_processor() -> AudioProcessor:
    if _processor is None:
        raise RuntimeError("Call init_processor() first")
    return _processor
