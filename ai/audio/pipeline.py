"""
Tầng 1 — Audio Front-end

- Denoising: RNNoise (edge) / Demucs, DeepFilterNet (server)
- VAD: Silero VAD
- Diarization: tách mic vật lý (edge) / pyannote (server)
- Overlap detection: phát hiện 2+ người nói chồng
"""

from dataclasses import dataclass, field
from typing import Optional
import numpy as np


@dataclass
class AudioSegment:
    """Một đoạn audio đã qua xử lý."""
    audio: np.ndarray           # PCM samples
    sample_rate: int = 16000
    speaker_id: Optional[str] = None
    is_speech: bool = True
    is_overlap: bool = False    # Có chồng tiếng không
    timestamp_start: float = 0.0
    timestamp_end: float = 0.0


class AudioPipeline:
    """Pipeline: raw mic → denoise → VAD → diarization → AudioSegment."""

    def __init__(self, tier: str = "server"):
        self.tier = tier

    def process(self, raw_audio: np.ndarray, sample_rate: int = 16000) -> list[AudioSegment]:
        """Xử lý audio thô, trả danh sách segment theo speaker."""
        raise NotImplementedError
