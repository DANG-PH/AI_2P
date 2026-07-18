"""
Tầng 2 — ASR Streaming

Edge: Whisper-small / PhoWhisper-small (quantized)
Server: Whisper-large fine-tuned

Contextual biasing: glossary tĩnh + session glossary.
Output: word-level timestamp + confidence + language tag (code-switching).
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class ASRWord:
    """Một từ được nhận dạng."""
    text: str
    start: float
    end: float
    confidence: float = 1.0
    language: str = "vi"  # language tag cho code-switching


@dataclass
class ASRSegment:
    """Một segment ASR (partial hoặc final)."""
    text: str
    words: List[ASRWord] = field(default_factory=list)
    speaker_id: Optional[str] = None
    stability_score: float = 0.0  # 0.0 = rất không ổn định, 1.0 = chốt
    is_final: bool = False
    segment_id: str = ""


class ASREngine:
    """Whisper-based streaming ASR."""

    def __init__(self, tier: str = "server"):
        self.tier = tier

    def transcribe_stream(self, audio_segment) -> ASRSegment:
        """Nhận AudioSegment, trả partial/final ASRSegment."""
        raise NotImplementedError
