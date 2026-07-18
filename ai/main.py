"""
Real-Time VI-EN Meeting Translator — Pipeline Entrypoint

Khởi tạo và chạy pipeline theo thứ tự:
  Tầng 0: Config (glossary, acronym, deployment)
  Tầng 0.5: RAG engine
  Tầng 1: Audio front-end
  Tầng 2: ASR streaming + revision
  Tầng 2.5: Fast path + Quality path
  Tầng 2.7: Health monitor & fallback
  Tầng 5: Session memory
"""

from config.deployment import DeploymentConfig
from config.glossary import GlossaryManager
from config.acronym import AcronymResolver
from rag.engine import RAGEngine
from audio.pipeline import AudioPipeline
from asr.engine import ASREngine
from asr.revision import RevisionHandler
from translation.fast_path import FastPathTranslator
from translation.quality_path import QualityPathTranslator
from fallback.monitor import HealthMonitor
from session.memory import SessionManager


def main():
    # --- Tầng 0: Config ---
    config = DeploymentConfig(tier="server", lang_pair="vi-en")
    glossary = GlossaryManager()
    acronym = AcronymResolver()

    # --- Tầng 0.5: RAG ---
    rag = RAGEngine()

    # --- Tầng 1: Audio ---
    audio = AudioPipeline(tier=config.tier)

    # --- Tầng 2: ASR ---
    asr = ASREngine(tier=config.tier)
    revision = RevisionHandler()

    # --- Tầng 2.5: Translation ---
    fast = FastPathTranslator(tier=config.tier)
    quality = QualityPathTranslator(tier=config.tier)

    # --- Tầng 2.7: Fallback ---
    monitor = HealthMonitor()

    # --- Tầng 5: Session ---
    session = SessionManager()

    print(f"Pipeline initialized: tier={config.tier}, lang={config.lang_pair}")
    print("All modules loaded. Ready to process audio streams.")
    # ponytail: main loop sẽ là WebSocket listener khi tích hợp với realtime-service


if __name__ == "__main__":
    main()
