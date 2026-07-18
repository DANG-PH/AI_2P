"""AI worker entrypoint for the real-time VI-EN meeting translator."""

import argparse
import asyncio
import sys

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency in local dev
    load_dotenv = None

if load_dotenv:
    load_dotenv()

from asr.engine import ASREngine
from asr.revision import RevisionHandler
from audio.pipeline import AudioPipeline
from config.acronym import AcronymResolver
from config.deployment import DeploymentConfig
from config.glossary import GlossaryManager
from fallback.monitor import HealthMonitor
from model_errors import ModelUnavailableError
from rag.engine import RAGEngine
from readiness import preflight_runtime
from session.memory import SessionManager
from translation.fast_path import FastPathTranslator
from translation.quality_path import QualityPathTranslator
from worker import run_server


def build_pipeline(tier: str = "server", lang_pair: str = "vi-en") -> dict:
    config = DeploymentConfig(tier=tier, lang_pair=lang_pair)
    return {
        "config": config,
        "model_map": config.get_model_map(),
        "glossary": GlossaryManager(lang_pair=lang_pair),
        "acronym": AcronymResolver(),
        "rag": RAGEngine(),
        "audio": AudioPipeline(tier=config.tier),
        "asr": ASREngine(tier=config.tier),
        "revision": RevisionHandler(),
        "fast": FastPathTranslator(tier=config.tier),
        "quality": QualityPathTranslator(tier=config.tier),
        "monitor": HealthMonitor(),
        "session": SessionManager(),
    }


def preflight_pipeline(
    pipeline: dict,
) -> tuple[dict[str, str | None], list[str]]:
    """Eagerly verify the same runtime paths required by live sessions."""

    return preflight_runtime(
        audio=pipeline["audio"],
        asr=pipeline["asr"],
        fast=pipeline["fast"],
        quality=pipeline["quality"],
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=None)
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument(
        "--check",
        action="store_true",
        help="preload runtime dependencies, probe configured AI APIs, and exit",
    )
    parser.add_argument("--ingest-doc", action="append", default=[], help="ingest a document into local RAG")
    args = parser.parse_args()

    pipeline = build_pipeline()
    if args.ingest_doc:
        total = 0
        for path in args.ingest_doc:
            total += pipeline["rag"].ingest_document(path)
        print(f"Ingested {total} document chunks.")
        return

    if args.check:
        config = pipeline["config"]
        try:
            checks, warnings = preflight_pipeline(pipeline)
        except ModelUnavailableError as error:
            print(f"Pipeline preflight failed: {error}", file=sys.stderr)
            raise SystemExit(1) from error
        print(f"Pipeline initialized: tier={config.tier}, lang={config.lang_pair}")
        print(f"Audio VAD ready: {checks['vad']}")
        print(f"ASR ready: {checks['asr']}")
        print(
            "Translation ready: "
            f"fast={checks['fastTranslation'] or 'unavailable'}, "
            f"quality={checks['qualityTranslation'] or 'unavailable'}",
        )
        if warnings:
            print(f"Readiness warnings: {', '.join(warnings)}")
        print("Runtime dependencies loaded and configured external AI APIs probed.")
        return

    asyncio.run(run_server(args.host, args.port))


if __name__ == "__main__":
    main()
