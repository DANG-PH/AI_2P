"""
Tầng 2.5 — Quality Path (LLM Translation)

Edge: 3B-7B quantized (int4)
Server: 32B-70B qua vLLM

Input: câu ASR + sliding window 5-10 câu + glossary + acronym table + RAG context.
Timeout: 1.5s (edge) / 1.0s (server).
Output: CHỮ TRẮNG (chốt).
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class QualityContext:
    """Context đầy đủ cho quality-path LLM."""
    asr_text: str
    sliding_window: List[str] = field(default_factory=list)
    glossary: dict = field(default_factory=dict)
    acronym_table: dict = field(default_factory=dict)
    rag_chunks: List[str] = field(default_factory=list)


@dataclass
class QualityResult:
    """Kết quả dịch quality-path."""
    source_text: str
    translated_text: str
    is_fast_path: bool = False  # Chữ trắng
    latency_ms: float = 0.0
    timed_out: bool = False


class QualityPathTranslator:
    """LLM-based translation với full context."""

    def __init__(self, tier: str = "server"):
        self.tier = tier
        self._timeout = 1.0 if tier == "server" else 1.5

    def translate(self, context: QualityContext) -> QualityResult:
        """Dịch với LLM + full context. Timeout nếu quá hạn."""
        raise NotImplementedError
