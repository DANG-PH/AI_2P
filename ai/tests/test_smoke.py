"""Smoke test: kiểm tra tất cả module import được và pipeline khởi tạo OK."""

from fallback.monitor import HealthMonitor, FallbackLevel


def test_health_monitor_basic():
    """HealthMonitor là module có logic thật duy nhất → test nó."""
    m = HealthMonitor()
    assert m.get_level() == FallbackLevel.NORMAL

    # 1 timeout → mức 1
    assert m.report_timeout() == FallbackLevel.REDUCE_CONTEXT

    # 2 timeout nữa → mức 2
    m.report_timeout()
    assert m.report_timeout() == FallbackLevel.FAST_PATH_ONLY

    # Thành công → reset
    m.report_success()
    assert m.get_level() == FallbackLevel.NORMAL

    # Mất mạng → mức 3
    assert m.report_network_loss() == FallbackLevel.OFFLINE_MODE

    # Critical → mức 4
    assert m.report_critical_failure() == FallbackLevel.RAW_TRANSCRIPT


def test_imports():
    """Đảm bảo mọi module import được."""
    from config.deployment import DeploymentConfig
    from config.glossary import GlossaryManager
    from config.acronym import AcronymResolver
    from rag.engine import RAGEngine
    from audio.pipeline import AudioPipeline
    from asr.engine import ASREngine
    from asr.revision import RevisionHandler
    from translation.fast_path import FastPathTranslator
    from translation.quality_path import QualityPathTranslator
    from session.memory import SessionManager, SlidingWindow


if __name__ == "__main__":
    test_health_monitor_basic()
    test_imports()
    print("All smoke tests passed.")
