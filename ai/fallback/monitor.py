"""
Tầng 2.7 — Health Monitor & Fallback

Giám sát liên tục và fallback 4 mức:
  Mức 1: Quality-path chậm → rút ngắn sliding window
  Mức 2: Quality-path fail liên tục → tạm tắt, chỉ dùng fast-path
  Mức 3: Server mất kết nối → chuyển model edge cục bộ
  Mức 4: Toàn bộ lỗi → hiện transcript ASR gốc + nút thử lại

Nguyên tắc: LUÔN có output, không bao giờ UI đứng im.
"""

from enum import IntEnum
from dataclasses import dataclass


class FallbackLevel(IntEnum):
    NORMAL = 0
    REDUCE_CONTEXT = 1   # Rút ngắn sliding window
    FAST_PATH_ONLY = 2   # Tắt quality-path
    OFFLINE_MODE = 3     # Chuyển edge model
    RAW_TRANSCRIPT = 4   # Chỉ hiện ASR gốc


@dataclass
class HealthStatus:
    """Trạng thái sức khoẻ pipeline."""
    level: FallbackLevel = FallbackLevel.NORMAL
    consecutive_timeouts: int = 0
    gpu_available: bool = True
    network_ok: bool = True
    mic_ok: bool = True


class HealthMonitor:
    """Giám sát và quyết định mức fallback."""

    TIMEOUT_THRESHOLD = 3  # Số lần timeout liên tiếp trước khi hạ mức

    def __init__(self):
        self.status = HealthStatus()

    def report_timeout(self) -> FallbackLevel:
        """Ghi nhận quality-path timeout."""
        self.status.consecutive_timeouts += 1
        if self.status.consecutive_timeouts >= self.TIMEOUT_THRESHOLD:
            self.status.level = FallbackLevel.FAST_PATH_ONLY
        elif self.status.consecutive_timeouts >= 1:
            self.status.level = FallbackLevel.REDUCE_CONTEXT
        return self.status.level

    def report_success(self) -> None:
        """Quality-path thành công → reset timeout counter."""
        self.status.consecutive_timeouts = 0
        if self.status.level in (FallbackLevel.REDUCE_CONTEXT, FallbackLevel.FAST_PATH_ONLY):
            self.status.level = FallbackLevel.NORMAL

    def report_network_loss(self) -> FallbackLevel:
        self.status.network_ok = False
        self.status.level = FallbackLevel.OFFLINE_MODE
        return self.status.level

    def report_critical_failure(self) -> FallbackLevel:
        self.status.level = FallbackLevel.RAW_TRANSCRIPT
        return self.status.level

    def get_level(self) -> FallbackLevel:
        return self.status.level
