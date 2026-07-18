"""
Tầng 0 — Acronym & Term Resolution Engine

Lớp 1: tra cứu tĩnh (bảng acronym → nghĩa gốc, bản dịch VI, EN).
Lớp 2: suy luận theo ngữ cảnh qua LLM (quality-path).
Theo dõi lần xuất hiện đầu tiên để hiện chú thích mở rộng.
"""

from typing import Dict, Optional, Tuple


class AcronymResolver:
    """Giải nghĩa từ viết tắt / thuật ngữ."""

    def __init__(self):
        # acronym -> (full_name, vi_translation, en_translation)
        self._table: Dict[str, Tuple[str, str, str]] = {}
        self._seen_in_session: set = set()  # acronym đã xuất hiện trong phiên

    def load_table(self, path: str) -> None:
        """Load bảng acronym từ file."""
        raise NotImplementedError

    def add(self, acronym: str, full_name: str, vi: str, en: str) -> None:
        self._table[acronym] = (full_name, vi, en)

    def resolve(self, acronym: str) -> Optional[Tuple[str, str, str]]:
        """Tra cứu tĩnh. Trả None nếu không có → cần LLM suy luận."""
        return self._table.get(acronym.upper())

    def is_first_occurrence(self, acronym: str) -> bool:
        """Lần đầu xuất hiện trong phiên → cần chú thích mở rộng."""
        key = acronym.upper()
        if key not in self._seen_in_session:
            self._seen_in_session.add(key)
            return True
        return False

    def learn_from_session(self, acronym: str, full_name: str, vi: str, en: str) -> None:
        """Học acronym mới trong phiên, lưu để tái sử dụng."""
        self.add(acronym, full_name, vi, en)
