"""
Tầng 2.5 — Fast Path (Machine Translation)

Edge: NLLB-600M distilled
Server: NLLB-3.3B
Buffer: 2s cố định → hiện CHỮ XÁM.
Target: < 0.8s.
"""

from dataclasses import dataclass


@dataclass
class TranslationResult:
    """Kết quả dịch fast-path."""
    source_text: str
    translated_text: str
    is_fast_path: bool = True  # Chữ xám
    latency_ms: float = 0.0


class FastPathTranslator:
    """NLLB-based machine translation."""

    def __init__(self, tier: str = "server"):
        self.tier = tier

    def translate(self, text: str, source_lang: str = "vi", target_lang: str = "en") -> TranslationResult:
        """Dịch nhanh, trả chữ xám."""
        raise NotImplementedError
