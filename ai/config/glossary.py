"""
Tầng 0 — Glossary Manager

Glossary tĩnh (theo lang_pair) + Session glossary động (cập nhật giữa buổi họp).
Merge vào contextual biasing của ASR + prompt LLM.
"""

from typing import Dict, Optional


class GlossaryManager:
    """Quản lý glossary tĩnh + session glossary."""

    def __init__(self):
        self._static: Dict[str, str] = {}   # term -> translation
        self._session: Dict[str, str] = {}   # term -> translation (phiên hiện tại)

    def load_static(self, path: str) -> None:
        """Load glossary tĩnh từ file JSON/CSV."""
        raise NotImplementedError

    def add_session_term(self, term: str, translation: str) -> None:
        """Thêm thuật ngữ mới giữa buổi họp."""
        self._session[term] = translation

    def lookup(self, term: str) -> Optional[str]:
        """Tra cứu: ưu tiên session > static."""
        return self._session.get(term) or self._static.get(term)

    def get_all(self) -> Dict[str, str]:
        """Merge tất cả glossary cho prompt/biasing."""
        merged = dict(self._static)
        merged.update(self._session)
        return merged
