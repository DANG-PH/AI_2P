"""
Tầng 5 — Session Memory

- Sliding window context (5-10 câu gần nhất)
- Biên bản họp + action items tự động cuối buổi
- Lưu session glossary kèm biên bản để tái sử dụng
- Dùng chung Vector DB với RAG (Tầng 0.5)
"""

from collections import deque
from dataclasses import dataclass, field
from typing import List


@dataclass
class SessionEntry:
    """Một dòng trong biên bản."""
    speaker_id: str
    source_text: str
    translated_text: str
    timestamp: float = 0.0


class SlidingWindow:
    """Sliding window context cho LLM prompt."""

    def __init__(self, max_size: int = 10):
        self._window: deque = deque(maxlen=max_size)

    def add(self, entry: SessionEntry) -> None:
        self._window.append(entry)

    def get_context(self) -> List[SessionEntry]:
        return list(self._window)

    def resize(self, new_size: int) -> None:
        """Fallback mức 1: rút ngắn window."""
        old = list(self._window)
        self._window = deque(old[-new_size:], maxlen=new_size)


class SessionManager:
    """Quản lý toàn bộ session: window, transcript, minutes."""

    def __init__(self):
        self.window = SlidingWindow()
        self.transcript: List[SessionEntry] = []

    def add_entry(self, entry: SessionEntry) -> None:
        self.window.add(entry)
        self.transcript.append(entry)

    def generate_minutes(self) -> str:
        """Tạo biên bản họp + action items cuối buổi."""
        raise NotImplementedError

    def export(self, path: str) -> None:
        """Xuất biên bản + session glossary ra file."""
        raise NotImplementedError
