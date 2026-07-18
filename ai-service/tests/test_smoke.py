"""Smoke tests for real-model integration points without downloading models."""

import asyncio
import base64
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import struct
from tempfile import TemporaryDirectory
import time
from unittest.mock import patch

import numpy as np

import worker as worker_module
from asr.engine import ASREngine, ASRSegment
from asr.revision import RevisionHandler
from audio.pipeline import AudioPipeline
from config.acronym import AcronymResolver
from config.deployment import DeploymentConfig
from config.glossary import GlossaryManager
from fallback.monitor import FallbackLevel, HealthMonitor
from model_errors import ModelUnavailableError
from rag.engine import RAGEngine
from session.memory import SessionEntry, SessionManager
from translation.fast_path import FastPathTranslator
from translation.quality_path import QualityContext, QualityPathTranslator
from worker import FINAL_BYTES, PipelineSession


ROOT = Path(__file__).resolve().parents[1]


class TensorDict(dict):
    def to(self, _device):
        return self


class FakeWhisperModel:
    def __init__(self):
        self.last_options = {}

    def transcribe(self, _audio, **_options):
        self.last_options = _options
        return {
            "text": "xin chao KPI",
            "language": "vi",
            "segments": [
                {
                    "avg_logprob": -0.05,
                    "words": [
                        {"word": "xin", "start": 0.0, "end": 0.2, "probability": 0.91},
                        {"word": "chao", "start": 0.2, "end": 0.4, "probability": 0.92},
                        {"word": "KPI", "start": 0.4, "end": 0.6, "probability": 0.93},
                    ],
                },
            ],
        }


class SequenceWhisperModel:
    def __init__(self, texts):
        self.texts = list(texts)
        self.calls = 0

    def transcribe(self, _audio, **_options):
        index = min(self.calls, len(self.texts) - 1)
        self.calls += 1
        text = self.texts[index]
        return {
            "text": text,
            "language": "en",
            "segments": [
                {
                    "avg_logprob": -0.05,
                    "words": [
                        {
                            "word": word,
                            "start": position * 0.2,
                            "end": (position + 1) * 0.2,
                            "probability": 0.9,
                        }
                        for position, word in enumerate(text.split())
                    ],
                },
            ],
        }


class FakeTokenizer:
    src_lang = None

    def __call__(self, text, **_kwargs):
        return TensorDict({"input_ids": [text]})

    def convert_tokens_to_ids(self, token):
        return token

    def batch_decode(self, _output, skip_special_tokens=True):
        return ["hello KPI"]


class FakeSeq2SeqModel:
    def generate(self, **_kwargs):
        return [[1, 2, 3]]


class FakeEncoder:
    def encode(self, value):
        if isinstance(value, list):
            return [[1.0, 0.0] for _ in value]
        return [1.0, 0.0]

    def get_sentence_embedding_dimension(self):
        return 2


class FakeDb:
    def __init__(self):
        self.points = []

    def upsert(self, collection_name, points):
        self.points.extend(points)

    def search(self, collection_name, query_vector, limit):
        return [SimpleNamespace(payload=point["payload"]) for point in self.points[:limit]]


class FakeChatCompletions:
    def __init__(
        self,
        content="hello KPI translated by llm",
        stream_chunks=None,
        stream_error=None,
    ):
        self.content = content
        self.stream_chunks = stream_chunks or [
            word + (" " if index < len(content.split()) - 1 else "")
            for index, word in enumerate(content.split())
        ]
        self.stream_error = stream_error
        self.calls = []

    def create(self, **_kwargs):
        self.last_kwargs = _kwargs
        self.calls.append(_kwargs)
        if _kwargs.get("stream") is True:
            return FakeChatStream(
                self.stream_chunks,
                self.stream_error,
            )
        message = SimpleNamespace(content=self.content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])


class FakeChatStream:
    def __init__(self, chunks, error=None):
        self.chunks = list(chunks)
        self.error = error
        self.index = 0
        self.closed = False

    def __iter__(self):
        return self

    def __next__(self):
        if self.index < len(self.chunks):
            content = self.chunks[self.index]
            self.index += 1
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        delta=SimpleNamespace(content=content),
                    ),
                ],
            )
        if self.error is not None:
            error = self.error
            self.error = None
            raise error
        raise StopIteration

    def close(self):
        self.closed = True


class FakeOpenAiClient:
    def __init__(
        self,
        content="hello KPI translated by llm",
        stream_chunks=None,
        stream_error=None,
    ):
        self.completions = FakeChatCompletions(
            content,
            stream_chunks,
            stream_error,
        )
        self.chat = SimpleNamespace(completions=self.completions)


class FailingChatCompletions:
    def __init__(self):
        self.calls = 0

    def create(self, **_kwargs):
        self.calls += 1
        raise ConnectionError("probe failed")


class FailingOpenAiClient:
    def __init__(self):
        self.completions = FailingChatCompletions()
        self.chat = SimpleNamespace(completions=self.completions)


class FakeTranscriptions:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            text="hello",
            segments=[],
            language=kwargs.get("language", "unknown"),
        )


class FakeFptClient:
    def __init__(self):
        self.transcriptions = FakeTranscriptions()
        self.audio = SimpleNamespace(transcriptions=self.transcriptions)


class InstantQualityTranslator:
    def __init__(self, text="quality final"):
        self.text = text

    def translate(self, _context):
        return SimpleNamespace(translated_text=self.text, timed_out=False)

    def stream_translate(self, _context):
        words = self.text.split()
        for index, word in enumerate(words):
            yield word + (" " if index < len(words) - 1 else "")


class SlowQualityTranslator(InstantQualityTranslator):
    def translate(self, context):
        time.sleep(0.05)
        return super().translate(context)

    def stream_translate(self, context):
        time.sleep(0.05)
        yield from super().stream_translate(context)


class NetworkFailQualityTranslator:
    def translate(self, _context):
        raise ConnectionError("connection lost")

    def stream_translate(self, _context):
        raise ConnectionError("connection lost")
        yield


class PartialFailQualityTranslator:
    def stream_translate(self, _context):
        yield "partial quality "
        raise ConnectionError("connection lost during stream")


class UnavailableTranslator:
    def preflight(self):
        raise ModelUnavailableError("translator unavailable")


class SlowFastTranslator:
    def __init__(self):
        self.calls = 0

    def translate(self, text, source_lang="vi", target_lang="en"):
        self.calls += 1
        time.sleep(0.25)
        return SimpleNamespace(source_text=text, translated_text="slow fast")

    def stream_translate(self, text, source_lang="vi", target_lang="en"):
        self.calls += 1
        time.sleep(0.25)
        yield "slow "
        yield "fast"


class FakeWs:
    def __init__(self):
        self.events = []

    async def send_json(self, payload):
        self.events.append(payload)


def make_audio_pipeline():
    return AudioPipeline(
        vad_model=object(),
        get_speech_timestamps=lambda audio, _model, sampling_rate: [
            {"start": 0, "end": len(audio)},
        ],
    )


def make_overlap_audio_pipeline():
    return AudioPipeline(
        vad_model=object(),
        get_speech_timestamps=lambda audio, _model, sampling_rate: [
            {"start": 0, "end": len(audio)},
        ],
        denoise_mode="off",
    )


def make_split_audio_pipeline():
    return AudioPipeline(
        vad_model=object(),
        get_speech_timestamps=lambda audio, _model, sampling_rate: [
            {"start": 0, "end": len(audio) // 2},
            {"start": len(audio) // 2, "end": len(audio)},
        ],
    )


def make_fast_translator():
    return FastPathTranslator(
        client=FakeOpenAiClient(content="hello KPI"),
        model_name="fast-test-model",
    )


def test_health_monitor_basic():
    monitor = HealthMonitor()
    assert monitor.get_level() == FallbackLevel.NORMAL
    assert monitor.report_timeout() == FallbackLevel.REDUCE_CONTEXT
    monitor.report_timeout()
    assert monitor.report_timeout() == FallbackLevel.FAST_PATH_ONLY
    monitor.report_success()
    assert monitor.get_level() == FallbackLevel.NORMAL
    assert monitor.report_network_loss() == FallbackLevel.OFFLINE_MODE
    monitor = HealthMonitor()
    assert monitor.report_gpu_failure() == FallbackLevel.FAST_PATH_ONLY
    monitor = HealthMonitor()
    assert monitor.report_mic_loss() == FallbackLevel.REDUCE_CONTEXT
    monitor.report_mic_ok()
    assert monitor.report_critical_failure() == FallbackLevel.RAW_TRANSCRIPT


def test_config_and_data_loaders():
    config = DeploymentConfig()
    assert config.get_model_map()["asr"]

    glossary = GlossaryManager()
    glossary.load_static(str(ROOT / "data" / "glossary_vi_en.json"))
    glossary.add_session_term("KPI", "Key Performance Indicator")
    assert glossary.lookup("KPI") == "Key Performance Indicator"
    assert glossary.get_all()

    acronyms = AcronymResolver()
    acronyms.load_table(str(ROOT / "data" / "acronyms.json"))
    assert acronyms.resolve("mou")[0] == "Memorandum of Understanding"
    assert acronyms.is_first_occurrence("MOU")
    assert not acronyms.is_first_occurrence("MOU")


def test_rag_uses_vector_backend():
    db = FakeDb()
    rag = RAGEngine(encoder=FakeEncoder(), db=db)
    rag.add_session_transcript("Clause 3.2 covers the investment schedule.", "session-1")
    chunks = rag.retrieve("investment", top_k=1)
    assert db.points
    assert chunks[0].source == "session:session-1"


def test_rag_ingests_text_documents():
    db = FakeDb()
    rag = RAGEngine(encoder=FakeEncoder(), db=db)
    with TemporaryDirectory() as directory:
        path = Path(directory) / "agenda.md"
        path.write_text("Clause 3.2 covers investment.\n\nBudget is 12%.", encoding="utf-8")
        assert rag.ingest_document(str(path)) == 2
    assert len(db.points) == 2


def test_audio_asr_and_fast_translation_use_models():
    samples = np.ones(16000, dtype=np.int16) * 1200
    segment = make_audio_pipeline().process(samples)[0]
    assert segment.is_speech

    whisper = FakeWhisperModel()
    asr_segment = ASREngine(model=whisper).transcribe_stream(
        segment,
        glossary={"KPI": "Key Performance Indicator"},
        acronym_table={"MOU": ("Memorandum of Understanding", "", "")},
    )
    assert asr_segment.is_final
    assert asr_segment.text == "xin chao KPI"
    assert asr_segment.words[-1].text == "KPI"
    assert "KPI=Key Performance Indicator" in whisper.last_options["initial_prompt"]

    translated = make_fast_translator().translate(asr_segment.text, "vi", "en")
    assert translated.translated_text == "hello KPI"


def test_energy_vad_emergency_fallback():
    sample_rate = 16000
    samples = np.zeros(sample_rate, dtype=np.float32)
    speech_start = int(sample_rate * 0.25)
    speech_end = int(sample_rate * 0.75)
    time_axis = np.arange(speech_end - speech_start) / sample_rate
    samples[speech_start:speech_end] = 0.2 * np.sin(
        2 * np.pi * 220 * time_axis,
    )

    pipeline = AudioPipeline(
        vad_mode="energy",
        denoise_mode="off",
    )
    assert pipeline.preflight() == "energy"

    segments = pipeline.process(samples, sample_rate)
    assert len(segments) == 1
    assert segments[0].is_speech
    assert segments[0].timestamp_start <= 0.25
    assert segments[0].timestamp_end >= 0.75
    assert pipeline.process(np.zeros(sample_rate, dtype=np.float32)) == []


def test_silero_vad_missing_torch_fails_preflight():
    with patch.dict(sys.modules, {"torch": None}):
        pipeline = AudioPipeline(vad_mode="silero")
        try:
            pipeline.preflight()
        except ModelUnavailableError as error:
            message = str(error)
            assert "AUDIO_VAD=silero" in message
            assert "ai-service/requirements.txt" in message
            assert "AUDIO_VAD=energy" in message
        else:
            raise AssertionError("Silero preflight must fail when Torch is unavailable")


def test_invalid_vad_mode_fails_preflight():
    pipeline = AudioPipeline(vad_mode="unknown")
    try:
        pipeline.preflight()
    except ModelUnavailableError as error:
        assert "Unsupported AUDIO_VAD mode" in str(error)
    else:
        raise AssertionError("Unknown VAD mode must fail before processing audio")


def test_pipeline_error_event_hides_internal_details():
    ws = FakeWs()
    pipeline = PipelineSession(ws, "session-safe-error", "client-safe-error")
    internal_error = ModelUnavailableError(
        "Torch is missing from /srv/private/runtime.",
    )

    with patch.object(worker_module.LOGGER, "error") as log_error:
        asyncio.run(pipeline._send_pipeline_error(internal_error))

    event = ws.events[-1]
    assert event["code"] == "AI_MODEL_UNAVAILABLE"
    assert event["message"] == "The configured AI model is unavailable."
    assert "Torch" not in event["message"]
    log_error.assert_called_once()
    assert "Torch is missing" in str(log_error.call_args)


def test_worker_rejects_readiness_without_a_translation_path():
    ws = FakeWs()
    pipeline = PipelineSession(ws, "session-not-ready", "client-not-ready")
    pipeline.audio = make_audio_pipeline()
    pipeline.asr = ASREngine(model=FakeWhisperModel())
    pipeline.fast = UnavailableTranslator()
    pipeline.quality = UnavailableTranslator()

    with patch.object(worker_module.LOGGER, "warning"), patch.object(
        worker_module.LOGGER,
        "error",
    ):
        asyncio.run(
            pipeline.handle_control(
                json.dumps(
                    {
                        "type": "session.init",
                        "config": {
                            "languagePair": "vi-en",
                            "speaker": "en",
                        },
                    },
                ),
            ),
        )

    assert pipeline.ready is False
    assert pipeline.speaker == "en"
    assert ws.events[-1] == {
        "type": "session.ready",
        "ready": False,
        "code": "AI_MODEL_UNAVAILABLE",
        "message": "The AI session could not become ready.",
    }


def test_fpt_asr_failure_does_not_fallback_to_local():
    previous = os.environ.get("FPT_ASR")
    os.environ["FPT_ASR"] = "true"
    try:
        engine = ASREngine(model=FakeWhisperModel())
        engine._transcribe_fpt = lambda *_args, **_kwargs: (
            _ for _ in ()
        ).throw(RuntimeError("api failed"))
        segment = SimpleNamespace(audio=np.ones(16000, dtype=np.float32), is_speech=True)
        try:
            engine.transcribe_stream(segment)
        except ModelUnavailableError as error:
            assert "FPT ASR failed" in str(error)
        else:
            raise AssertionError("FPT ASR failure must not silently use local Whisper")
    finally:
        if previous is None:
            os.environ.pop("FPT_ASR", None)
        else:
            os.environ["FPT_ASR"] = previous


def test_fpt_asr_uses_session_language_and_caches_probe():
    with patch.dict(
        os.environ,
        {
            "FPT_ASR": "true",
            "FPT_API_KEY": "test-key",
            "WHISPER_LANGUAGE": "vi",
        },
    ):
        client = FakeFptClient()
        engine = ASREngine()
        engine._fpt_client = client

        assert engine.preflight().startswith("fpt:")
        assert engine.preflight().startswith("fpt:")
        assert len(client.transcriptions.calls) == 1

        segment = SimpleNamespace(
            audio=np.ones(16000, dtype=np.float32),
            is_speech=True,
        )
        result = engine.transcribe_stream(segment, language="en")

    assert result.text == "hello"
    assert client.transcriptions.calls[-1]["language"] == "en"


def test_translation_preflights_probe_once():
    fast_client = FakeOpenAiClient(content="Hello.")
    fast = FastPathTranslator(
        client=fast_client,
        model_name="fast-test-model",
    )
    assert fast.preflight() == "fpt-fast:fast-test-model"
    assert fast.preflight() == "fpt-fast:fast-test-model"
    assert len(fast_client.completions.calls) == 1

    quality_client = FakeOpenAiClient(content="Hello.")
    quality = QualityPathTranslator(
        client=quality_client,
        model="quality-test-model",
    )
    assert quality.preflight() == "quality:quality-test-model"
    assert quality.preflight() == "quality:quality-test-model"
    assert len(quality_client.completions.calls) == 1


def test_failed_translation_preflight_is_cached():
    client = FailingOpenAiClient()
    translator = FastPathTranslator(
        client=client,
        model_name="unavailable-test-model",
    )

    for _attempt in range(2):
        try:
            translator.preflight()
        except ModelUnavailableError:
            pass
        else:
            raise AssertionError("Unavailable remote model must fail preflight")

    assert client.completions.calls == 1


def test_audio_denoise_channel_diarization_and_overlap():
    samples = np.zeros((16000, 2), dtype=np.int16)
    samples[:, 0] = 4000
    samples[:, 1] = 14000
    pipeline = AudioPipeline(
        vad_model=object(),
        get_speech_timestamps=lambda audio, _model, sampling_rate: [
            {"start": 0, "end": len(audio)},
        ],
        denoiser=lambda audio, sample_rate: audio * 0.5,
    )
    segment = pipeline.process(samples)[0]
    assert segment.speaker_id == "speaker_2"
    assert segment.is_overlap
    assert float(np.max(np.abs(segment.audio))) < 0.3


def test_quality_path_uses_openai_compatible_client():
    client = FakeOpenAiClient()
    result = QualityPathTranslator(
        client=client,
        model="real-model-name",
    ).translate(
        QualityContext(
            asr_text="xin chao KPI",
            source_lang="vi",
            target_lang="en",
            acronym_table={
                "KPI": (
                    "Key Performance Indicator",
                    "Chi so hieu suat chinh",
                    "Key Performance Indicator",
                ),
            },
        ),
    )
    assert result.translated_text == "hello KPI translated by llm"
    user_prompt = client.completions.last_kwargs["messages"][1]["content"]
    assert "KPI: Key Performance Indicator (VI:" in user_prompt
    assert "('Key Performance Indicator'" not in user_prompt


def test_translation_paths_yield_provider_deltas():
    fast_client = FakeOpenAiClient(
        content="hello world",
        stream_chunks=["hel", "lo ", "world"],
    )
    fast = FastPathTranslator(
        client=fast_client,
        model_name="fast-test-model",
    )
    assert list(fast.stream_translate("xin chao", "vi", "en")) == [
        "hel",
        "lo ",
        "world",
    ]
    assert fast_client.completions.last_kwargs["stream"] is True

    quality_client = FakeOpenAiClient(
        content="quality final",
        stream_chunks=["quality", " final"],
    )
    quality = QualityPathTranslator(
        client=quality_client,
        model="quality-test-model",
    )
    assert list(
        quality.stream_translate(
            QualityContext(asr_text="xin chao"),
        ),
    ) == ["quality", " final"]
    assert quality_client.completions.last_kwargs["stream"] is True


def test_quality_path_reads_fpt_ai_factory_env():
    previous = {
        key: os.environ.get(key)
        for key in (
            "FPT_AI_FACTORY_BASE_URL",
            "FPT_AI_FACTORY_API_KEY",
            "FPT_AI_FACTORY_MODEL",
            "FPT_AI_FACTORY_TIMEOUT",
        )
    }
    try:
        os.environ["FPT_AI_FACTORY_BASE_URL"] = "https://factory.example/v1"
        os.environ["FPT_AI_FACTORY_API_KEY"] = "secret"
        os.environ["FPT_AI_FACTORY_MODEL"] = "fpt-model"
        os.environ["FPT_AI_FACTORY_TIMEOUT"] = "2.5"

        translator = QualityPathTranslator()
        assert translator.base_url == "https://factory.example/v1"
        assert translator.api_key == "secret"
        assert translator.model == "fpt-model"
        assert translator._timeout == 2.5
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def test_revision_and_minutes():
    old = ASRSegment(
        text="ROI is 10 percent.",
        stability_score=1.0,
        is_final=True,
        segment_id="u1",
    )
    new = ASRSegment(text="ROI is 12 percent.", segment_id="u1")
    revision = RevisionHandler().check_revision(old, new)
    assert revision.is_dirty
    assert revision.is_semantic_change

    session = SessionManager()
    session.add_entry(
        SessionEntry(
            speaker_id="en",
            source_text="We need to send the MOU.",
            translated_text="Can gui MOU.",
            timestamp=1.2,
        ),
    )
    assert "Action items" in session.generate_minutes()


def test_worker_session_translation_with_injected_models():
    worker_session = PipelineSession(FakeWs(), "room", "client")
    worker_session.fast = make_fast_translator()
    worker_session.quality = SlowQualityTranslator("hello KPI translated by llm")
    worker_session.rag = RAGEngine(encoder=FakeEncoder(), db=FakeDb())
    translated = asyncio.run(worker_session.translate_dual("xin chao KPI", "u1"))
    assert translated == "hello KPI (Key Performance Indicator) translated by llm"
    translation_events = [
        event["type"]
        for event in worker_session.ws.events
        if event["type"].startswith("translate")
    ]
    assert translation_events[-1] == "translate.done"
    assert translation_events.count("translate.done") == 1
    assert "translate.token" in translation_events


def test_quality_success_does_not_start_fast_fallback():
    worker_session = PipelineSession(FakeWs(), "room", "client")
    fast = SlowFastTranslator()
    worker_session.fast = fast
    worker_session.quality = InstantQualityTranslator("quality wins")
    worker_session.rag = RAGEngine(encoder=FakeEncoder(), db=FakeDb())

    translated = asyncio.run(worker_session.translate_dual("xin chao", "u1"))
    event_types = [event["type"] for event in worker_session.ws.events]
    assert translated == "quality wins"
    assert "translate.done" in event_types
    assert "translate.token" in event_types
    assert fast.calls == 0


def test_quality_network_failure_emits_status_and_uses_fast_path():
    worker_session = PipelineSession(FakeWs(), "room", "client")
    worker_session.fast = make_fast_translator()
    worker_session.quality = NetworkFailQualityTranslator()
    worker_session.rag = RAGEngine(encoder=FakeEncoder(), db=FakeDb())

    translated = asyncio.run(worker_session.translate_dual("xin chao KPI", "u1"))
    status = next(event for event in worker_session.ws.events if event["type"] == "system.status")
    assert translated == "hello KPI (Key Performance Indicator)"
    assert status["level"] == int(FallbackLevel.OFFLINE_MODE)
    assert status["networkOk"] is False


def test_partial_quality_stream_resets_before_fast_fallback():
    worker_session = PipelineSession(FakeWs(), "room", "client")
    worker_session.fast = FastPathTranslator(
        client=FakeOpenAiClient(
            content="fallback translation",
            stream_chunks=["fallback ", "translation"],
        ),
        model_name="fast-test-model",
    )
    worker_session.quality = PartialFailQualityTranslator()
    worker_session.rag = RAGEngine(encoder=FakeEncoder(), db=FakeDb())

    translated = asyncio.run(
        worker_session.translate_dual("xin chao", "u1"),
    )
    tokens = [
        event
        for event in worker_session.ws.events
        if event["type"] == "translate.token"
    ]

    assert translated == "fallback translation"
    assert tokens[0]["token"] == "partial quality "
    assert "reset" not in tokens[0]
    assert tokens[1] == {
        "type": "translate.token",
        "token": "fallback ",
        "utteranceId": "u1",
        "reset": True,
    }
    assert tokens[2]["token"] == "translation"
    assert "reset" not in tokens[2]


def test_worker_revision_overlap_and_status_events():
    asyncio.run(_worker_revision_overlap_and_status_events())


async def _worker_revision_overlap_and_status_events():
    worker_session = PipelineSession(FakeWs(), "room", "client")
    worker_session.audio = make_overlap_audio_pipeline()
    worker_session.asr = ASREngine(
        model=SequenceWhisperModel(["ROI is 10 percent", "ROI is 12 percent"]),
    )
    worker_session.fast = make_fast_translator()
    worker_session.quality = InstantQualityTranslator("ROI is 12 percent translated")
    worker_session.rag = RAGEngine(encoder=FakeEncoder(), db=FakeDb())
    worker_session.audio_buffer.extend((np.ones(FINAL_BYTES // 2, dtype=np.int16) * 32767).tobytes())

    await worker_session.emit_partial("u1")
    await worker_session.finalize_utterance("u1")

    event_types = [event["type"] for event in worker_session.ws.events]
    revision = next(event for event in worker_session.ws.events if event["type"] == "stt.revision")
    overlap = next(event for event in worker_session.ws.events if event["type"] == "audio.overlap")
    assert "stt.partial" in event_types
    assert "stt.final" in event_types
    assert revision["semanticChange"] is True
    assert any(change["op"] == "replace" for change in revision["diff"])
    assert overlap["bufferedCount"] == 1
    assert len(worker_session.overlap_buffer) == 1


def test_worker_combines_multiple_audio_segments():
    worker_session = PipelineSession(FakeWs(), "room", "client")
    worker_session.audio = make_split_audio_pipeline()
    worker_session.asr = ASREngine(model=FakeWhisperModel())
    combined = worker_session._transcribe(np.ones(FINAL_BYTES // 2, dtype=np.int16).tobytes(), "u1")
    assert combined.text == "xin chao KPI xin chao KPI"
    assert combined.segment_id == "u1"


def test_websocket_worker_contract_with_injected_models():
    asyncio.run(_websocket_worker_contract())


async def _websocket_worker_contract():
    original_pipeline_session = worker_module.PipelineSession

    class TestPipelineSession(original_pipeline_session):
        def __init__(self, ws, session_id, client_id):
            super().__init__(ws, session_id, client_id)
            self.audio = make_audio_pipeline()
            self.asr = ASREngine(model=FakeWhisperModel())
            self.fast = make_fast_translator()
            self.quality = SlowQualityTranslator("hello KPI translated by llm")
            self.rag = RAGEngine(encoder=FakeEncoder(), db=FakeDb())

    worker_module.PipelineSession = TestPipelineSession
    server = await asyncio.start_server(worker_module.handle_client, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    reader, writer = await asyncio.open_connection("127.0.0.1", port)

    try:
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        writer.write(
            (
                "GET /ws/session?sessionId=room&clientId=client HTTP/1.1\r\n"
                "Host: 127.0.0.1\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                f"Sec-WebSocket-Key: {key}\r\n"
                "Sec-WebSocket-Version: 13\r\n"
                "\r\n"
            ).encode("ascii"),
        )
        await writer.drain()
        response = await reader.readuntil(b"\r\n\r\n")
        assert b"101 Switching Protocols" in response

        await _client_send_json(
            writer,
            {
                "type": "session.init",
                "config": {
                    "languagePair": "vi-en",
                    "speaker": "en",
                },
            },
        )

        events = []
        while not any(
            event.get("type") == "session.ready" for event in events
        ):
            events.append(await _client_receive_json(reader))
        ready = next(
            event for event in events if event["type"] == "session.ready"
        )
        assert ready["ready"] is True
        assert ready["speaker"] == "en"
        assert ready["languagePair"] == "vi-en"
        assert ready["externalApisProbed"] is True

        samples = np.ones(FINAL_BYTES // 2, dtype=np.int16) * 1200
        await _client_send_frame(writer, samples.tobytes(), opcode=0x2)

        while not any(event.get("type") == "translate.done" for event in events):
            events.append(await _client_receive_json(reader))
        try:
            while True:
                events.append(await asyncio.wait_for(_client_receive_json(reader), timeout=0.05))
        except asyncio.TimeoutError:
            pass

        event_types = [event["type"] for event in events]
        assert "stt.final" in event_types
        assert "stt.partial" in event_types
        assert "translate.token" in event_types
        assert event_types.count("translate.done") == 1
        final = next(event for event in events if event["type"] == "stt.final")
        assert final["speaker"] == "en"
        done = next(event for event in events if event["type"] == "translate.done")
        assert done["speaker"] == "en"
        assert done["sourceText"] == "xin chao KPI"
        assert done["fullText"] == "hello KPI (Key Performance Indicator) translated by llm"
    finally:
        worker_module.PipelineSession = original_pipeline_session
        writer.close()
        await writer.wait_closed()
        server.close()
        await server.wait_closed()


async def _client_send_json(writer: asyncio.StreamWriter, payload: dict):
    await _client_send_frame(writer, json.dumps(payload).encode("utf-8"), opcode=0x1)


async def _client_send_frame(writer: asyncio.StreamWriter, payload: bytes, opcode: int):
    mask = os.urandom(4)
    header = bytearray([0x80 | opcode])
    length = len(payload)
    if length < 126:
        header.append(0x80 | length)
    elif length < 65536:
        header.extend((0x80 | 126, *struct.pack("!H", length)))
    else:
        header.extend((0x80 | 127, *struct.pack("!Q", length)))

    masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
    writer.write(bytes(header) + mask + masked)
    await writer.drain()


async def _client_receive_json(reader: asyncio.StreamReader) -> dict:
    first, second = await reader.readexactly(2)
    opcode = first & 0x0F
    length = second & 0x7F
    if length == 126:
        length = struct.unpack("!H", await reader.readexactly(2))[0]
    elif length == 127:
        length = struct.unpack("!Q", await reader.readexactly(8))[0]

    payload = await reader.readexactly(length) if length else b""
    assert opcode == 0x1
    return json.loads(payload.decode("utf-8"))


def test_imports():
    from audio.pipeline import AudioPipeline as _AudioPipeline
    from fallback.monitor import HealthMonitor as _HealthMonitor
    from session.memory import SlidingWindow as _SlidingWindow

    assert _AudioPipeline
    assert _HealthMonitor
    assert _SlidingWindow


if __name__ == "__main__":
    test_health_monitor_basic()
    test_config_and_data_loaders()
    test_rag_uses_vector_backend()
    test_rag_ingests_text_documents()
    test_audio_asr_and_fast_translation_use_models()
    test_energy_vad_emergency_fallback()
    test_silero_vad_missing_torch_fails_preflight()
    test_invalid_vad_mode_fails_preflight()
    test_pipeline_error_event_hides_internal_details()
    test_worker_rejects_readiness_without_a_translation_path()
    test_fpt_asr_failure_does_not_fallback_to_local()
    test_fpt_asr_uses_session_language_and_caches_probe()
    test_translation_preflights_probe_once()
    test_failed_translation_preflight_is_cached()
    test_audio_denoise_channel_diarization_and_overlap()
    test_quality_path_uses_openai_compatible_client()
    test_quality_path_reads_fpt_ai_factory_env()
    test_revision_and_minutes()
    test_worker_session_translation_with_injected_models()
    test_quality_success_does_not_start_fast_fallback()
    test_quality_network_failure_emits_status_and_uses_fast_path()
    test_worker_revision_overlap_and_status_events()
    test_worker_combines_multiple_audio_segments()
    test_websocket_worker_contract_with_injected_models()
    test_imports()
    print("All smoke tests passed.")
