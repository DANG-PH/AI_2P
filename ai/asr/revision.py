"""
Tầng 2 — Revision Handler

Xử lý khi ASR tự sửa segment đã nhận diện:
- Chữ xám (stability thấp): luôn cho phép dịch lại.
- Chữ trắng (đã chốt): chỉ patch nếu thay đổi Ý NGHĨA cốt lõi
  (tên riêng, số liệu, phủ định).
"""

from dataclasses import dataclass


@dataclass
class RevisionResult:
    """Kết quả đánh giá revision."""
    segment_id: str
    is_dirty: bool = False
    is_semantic_change: bool = False  # True = thay đổi ý nghĩa cốt lõi
    old_text: str = ""
    new_text: str = ""


class RevisionHandler:
    """So sánh segment cũ vs mới, quyết định có cần dịch lại không."""

    def check_revision(self, old_segment, new_segment) -> RevisionResult:
        """
        So sánh 2 ASRSegment.
        - Nếu chữ xám → is_dirty=True, dịch lại.
        - Nếu chữ trắng → chỉ is_dirty=True khi is_semantic_change=True.
        """
        raise NotImplementedError
