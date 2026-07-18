"""Dependency-free WebSocket AI worker for realtime-service.

The NestJS bridge connects to this process through AI_WS_URL and forwards
binary PCM16 audio chunks. This worker emits partial ASR, final ASR, fast
translation tokens, quality translation finals, and error events.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
from copy import copy
import struct
import time
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

import numpy as np

from asr.engine import ASREngine
from asr.revision import RevisionHandler
from audio.pipeline import AudioPipeline
from config.acronym import AcronymResolver
from config.glossary import GlossaryManager
from fallback.monitor import FallbackLevel, HealthMonitor
from model_errors import ModelUnavailableError
from rag.engine import RAGEngine
from readiness import preflight_runtime
from session.memory import SessionEntry, SessionManager
from translation.fast_path import FastPathTranslator
from translation.quality_path import QualityContext, QualityPathTranslator


GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2
PARTIAL_BYTES = int(SAMPLE_RATE * BYTES_PER_SAMPLE * 0.8)
FINAL_BYTES = int(SAMPLE_RATE * BYTES_PER_SAMPLE * 1.2)
LOGGER = logging.getLogger("vienmeet.ai")


# --- FIX: shared/global model instances -------------------------------------
# Truoc day moi PipelineSession (moi client connect) tu tao AudioPipeline(),
# ASREngine(), FastPathTranslator() rieng, khien VAD (Silero), Whisper, va
# NLLB bi load lai tu dau cho MOI session/connect. Gio dung 1 instance dung
# chung cho toan server, load 1 lan duy nhat luc khoi dong.
#
# QualityPathTranslator KHONG can dung chung: no chi tao 1 OpenAI client tro
# toi API ngoai (FPT AI Factory), khong load model cuc bo nao, nen khoi tao
# rat nhe va giu nguyen per-session la on.
_SHARED_AUDIO_PIPELINE: AudioPipeline | None = None
_SHARED_ASR_ENGINE: ASREngine | None = None
_SHARED_FAST_TRANSLATOR: FastPathTranslator | None = None


def get_shared_audio_pipeline() -> AudioPipeline:
    global _SHARED_AUDIO_PIPELINE
    if _SHARED_AUDIO_PIPELINE is None:
        _SHARED_AUDIO_PIPELINE = AudioPipeline()
        _SHARED_AUDIO_PIPELINE.preflight()  # load VAD ngay, chi 1 lan
    return _SHARED_AUDIO_PIPELINE


def get_shared_asr_engine() -> ASREngine:
    global _SHARED_ASR_ENGINE
    if _SHARED_ASR_ENGINE is None:
        _SHARED_ASR_ENGINE = ASREngine()
        # FIX: dung preflight() - ham nay da tu kiem tra self._use_fpt_asr
        # (dat tu FPT_ASR trong .env) va chi goi _ensure_model() (tai
        # Whisper local ~2.9GB) khi KHONG dung FPT ASR. Truoc day worker.py
        # goi thang _ensure_model() vo dieu kien nen luon tai Whisper du
        # FPT_ASR=true. preflight() cung validate FPT API key ngay luc
        # khoi dong thay vi doi den request dau tien moi bao loi.
        _SHARED_ASR_ENGINE.preflight()
    return _SHARED_ASR_ENGINE


def get_shared_fast_translator() -> FastPathTranslator:
    global _SHARED_FAST_TRANSLATOR
    if _SHARED_FAST_TRANSLATOR is None:
        _SHARED_FAST_TRANSLATOR = FastPathTranslator()
        # FIX: FastPathTranslator ban moi goi FPT API (khong load NLLB cuc
        # bo nua), nen chi can preflight() de khoi tao client HTTP nhe,
        # khong con _ensure_model() (ham nay khong ton tai trong ban moi).
        _SHARED_FAST_TRANSLATOR.preflight()
    return _SHARED_FAST_TRANSLATOR
# -----------------------------------------------------------------------------


class WebSocketClosed(Exception):
    pass


class WebSocketProtocolError(Exception):
    pass


class WebSocketConnection:
    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self.reader = reader
        self.writer = writer
        self.path = "/"

    async def handshake(self) -> None:
        request = await self.reader.readuntil(b"\r\n\r\n")
        lines = request.decode("latin1").split("\r\n")
        if not lines or not lines[0].startswith("GET "):
            raise WebSocketProtocolError("Invalid WebSocket request")

        parts = lines[0].split(" ")
        self.path = parts[1] if len(parts) > 1 else "/"
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                key, value = line.split(":", 1)
                headers[key.strip().lower()] = value.strip()

        ws_key = headers.get("sec-websocket-key")
        if not ws_key:
            raise WebSocketProtocolError("Missing Sec-WebSocket-Key")

        accept = base64.b64encode(
            hashlib.sha1((ws_key + GUID).encode("ascii")).digest(),
        ).decode("ascii")
        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n"
            "\r\n"
        )
        self.writer.write(response.encode("ascii"))
        await self.writer.drain()

    async def receive(self) -> tuple[str, bytes | str]:
        while True:
            try:
                first, second = await self.reader.readexactly(2)
            except asyncio.IncompleteReadError as error:
                raise WebSocketClosed from error

            opcode = first & 0x0F
            masked = bool(second & 0x80)
            length = second & 0x7F
            if length == 126:
                length = struct.unpack("!H", await self.reader.readexactly(2))[0]
            elif length == 127:
                length = struct.unpack("!Q", await self.reader.readexactly(8))[0]

            mask = await self.reader.readexactly(4) if masked else b""
            payload = await self.reader.readexactly(length) if length else b""
            if masked:
                payload = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))

            if opcode == 0x8:
                raise WebSocketClosed
            if opcode == 0x9:
                await self.send_frame(payload, opcode=0xA)
                continue
            if opcode == 0x1:
                return "text", payload.decode("utf-8")
            if opcode == 0x2:
                return "binary", payload

            raise WebSocketProtocolError(f"Unsupported WebSocket opcode: {opcode}")

    async def send_json(self, payload: dict[str, Any]) -> None:
        await self.send_frame(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
            opcode=0x1,
        )

    async def send_frame(self, payload: bytes, opcode: int = 0x1) -> None:
        header = bytearray([0x80 | opcode])
        length = len(payload)
        if length < 126:
            header.append(length)
        elif length < 65536:
            header.extend((126, *struct.pack("!H", length)))
        else:
            header.extend((127, *struct.pack("!Q", length)))

        self.writer.write(bytes(header) + payload)
        await self.writer.drain()

    async def close(self) -> None:
        if not self.writer.is_closing():
            self.writer.close()
            await self.writer.wait_closed()


class PipelineSession:
    def __init__(self, ws: WebSocketConnection, session_id: str, client_id: str):
        self.ws = ws
        self.session_id = session_id
        self.client_id = client_id
        self.speaker = "vi"
        self.language_pair = "vi-en"
        self.ready = False
        self.audio_buffer = bytearray()
        self.partial_sent = False
        self.partial_segment = None
        self.last_revision = None
        self.overlap_buffer: list[dict[str, Any]] = []
        self.overlap_buffer_limit = int(os.getenv("OVERLAP_BUFFER_LIMIT", "20"))
        self._last_status_key = None
        self._mic_down_sent = False
        self.utterance_count = 0
        self.started_at = time.time()

        # FIX: dung cac model dung chung (da load san tu luc server khoi
        # dong) thay vi tao moi cho tung session. QualityPathTranslator van
        # tao per-session vi no chi la 1 client HTTP nhe toi API ngoai.
        self.audio = get_shared_audio_pipeline()
        self.asr = get_shared_asr_engine()
        self.revision = RevisionHandler()
        self.fast = get_shared_fast_translator()
        self.quality = QualityPathTranslator()
        self.monitor = HealthMonitor()
        self.session = SessionManager()
        self.rag = RAGEngine()
        self.glossary = GlossaryManager()
        self.acronym = AcronymResolver()
        self._load_static_data()

    async def run(self) -> None:
        while True:
            kind, payload = await self.ws.receive()
            if kind == "text":
                if not await self.handle_control(str(payload)):
                    return
            else:
                await self.handle_audio(bytes(payload))

    async def handle_control(self, payload: str) -> bool:
        try:
            message = json.loads(payload)
        except json.JSONDecodeError:
            await self.ws.send_json(
                {"type": "error", "code": "BAD_CONTROL_JSON", "message": "Invalid control JSON"},
            )
            return True

        message_type = message.get("type")
        if message_type == "session.close":
            try:
                self.rag.add_session_transcript(self.session.generate_minutes(), self.session_id)
                self._export_session()
            except Exception:
                pass
            return False

        if message_type == "speaker.switch":
            speaker = message.get("speaker")
            if speaker in ("vi", "en"):
                self.speaker = speaker
            return True

        if message_type == "session.init":
            self.ready = False
            config = message.get("config") if isinstance(message.get("config"), dict) else {}
            self.language_pair = str(config.get("languagePair") or self.language_pair)
            configured_speaker = config.get("speaker")
            if configured_speaker in ("vi", "en"):
                self.speaker = configured_speaker
            for item in config.get("glossary", []) if isinstance(config.get("glossary"), list) else []:
                if isinstance(item, dict):
                    self.glossary.add_session_term(
                        str(item.get("originalTerm") or item.get("term") or ""),
                        str(item.get("preferredOutput") or item.get("translation") or ""),
                    )
            self._ingest_documents(config.get("documents", []))
            try:
                capabilities, warnings = await asyncio.to_thread(
                    self._preflight_session,
                )
            except Exception as error:
                self.ready = False
                LOGGER.error(
                    "Readiness failed for session=%s client=%s: %s",
                    self.session_id,
                    self.client_id,
                    error,
                )
                await self.ws.send_json(
                    {
                        "type": "session.ready",
                        "ready": False,
                        "code": "AI_MODEL_UNAVAILABLE",
                        "message": "The AI session could not become ready.",
                    },
                )
                return True

            self.ready = True
            await self.send_health_status(force=True)
            await self.ws.send_json(
                {
                    "type": "session.ready",
                    "ready": True,
                    "speaker": self.speaker,
                    "languagePair": self.language_pair,
                    "capabilities": capabilities,
                    "warnings": warnings,
                    "externalApisProbed": False,
                },
            )
            return True

        if message_type in ("status.get", "health.get"):
            await self.send_health_status(force=True)
            return True

        if message_type in ("rag.ingest", "document.ingest", "rag.upload"):
            paths = message.get("paths", message.get("path", []))
            if isinstance(paths, str):
                paths = [paths]
            count = self._ingest_documents(paths)
            if count == 0:
                await self.ws.send_json(
                    {
                        "type": "error",
                        "code": "RAG_INGEST_EMPTY",
                        "message": "No documents ingested.",
                    },
                )
            else:
                await self.ws.send_json(
                    {
                        "type": "rag.ingested",
                        "chunks": count,
                    },
                )
            return True

        return True

    async def handle_audio(self, payload: bytes) -> None:
        if not self.ready:
            await self.ws.send_json(
                {
                    "type": "error",
                    "code": "AI_NOT_READY",
                    "message": "The AI session is not ready for audio.",
                },
            )
            return

        await self._track_mic_signal(payload)
        self.audio_buffer.extend(payload)
        utterance_id = self._utterance_id()

        if not self.partial_sent and len(self.audio_buffer) >= PARTIAL_BYTES:
            await self.emit_partial(utterance_id)

        if len(self.audio_buffer) >= FINAL_BYTES:
            await self.finalize_utterance(utterance_id)

    def _preflight_session(self) -> tuple[dict[str, str | None], list[str]]:
        def log_optional_error(capability: str, error: Exception) -> None:
            LOGGER.warning(
                "Optional capability unavailable for session=%s "
                "client=%s capability=%s: %s",
                self.session_id,
                self.client_id,
                capability,
                error,
            )

        return preflight_runtime(
            audio=self.audio,
            asr=self.asr,
            fast=self.fast,
            quality=self.quality,
            on_optional_error=log_optional_error,
        )

    async def emit_partial(self, utterance_id: str) -> None:
        try:
            asr_segment = self._transcribe(bytes(self.audio_buffer), utterance_id)
            if not asr_segment or not asr_segment.text:
                return
            asr_segment.is_final = False
            asr_segment.stability_score = min(asr_segment.stability_score, 0.6)
            self.partial_segment = asr_segment
            self.partial_sent = True
            await self.ws.send_json(
                {
                    "type": "stt.partial",
                    "text": asr_segment.text,
                    "speaker": asr_segment.speaker_id or self.speaker,
                    "sourceLang": self.speaker,
                    "stability": asr_segment.stability_score,
                    "overlap": asr_segment.is_overlap,
                    "utteranceId": utterance_id,
                },
            )
        except Exception:
            return

    async def finalize_utterance(self, utterance_id: str) -> None:
        raw = bytes(self.audio_buffer)
        self.audio_buffer.clear()
        self.partial_sent = False
        self.utterance_count += 1

        try:
            asr_segment = self._transcribe(raw, utterance_id)
            if not asr_segment or not asr_segment.text:
                return
        except Exception as error:
            await self._send_pipeline_error(error)
            return

        if asr_segment.is_overlap:
            self._remember_overlap(raw, utterance_id)
            await self.send_overlap(asr_segment, utterance_id)

        if self.last_revision and self.last_revision.is_dirty:
            await self.send_revision(self.last_revision, utterance_id)

        await self.ws.send_json(
            {
                "type": "stt.final",
                "text": asr_segment.text,
                "speaker": asr_segment.speaker_id or self.speaker,
                "sourceLang": self.speaker,
                "stability": asr_segment.stability_score,
                "overlap": asr_segment.is_overlap,
                "utteranceId": utterance_id,
            },
        )

        try:
            translation = await self.translate_dual(asr_segment.text, utterance_id)
        except Exception as error:
            await self._send_pipeline_error(error)
            return

        self.session.add_entry(
            SessionEntry(
                speaker_id=asr_segment.speaker_id or self.speaker,
                source_text=asr_segment.text,
                translated_text=translation,
                timestamp=time.time() - self.started_at,
            ),
        )
        self.partial_segment = None
        self.last_revision = None

    def _transcribe(self, raw: bytes, utterance_id: str):
        self.last_revision = None
        samples = np.frombuffer(raw, dtype=np.int16)
        segments = self.audio.process(samples, sample_rate=SAMPLE_RATE)
        if not segments:
            return None

        asr_segments = []
        for index, segment in enumerate(segments):
            segment.speaker_id = segment.speaker_id or self.speaker
            segment.segment_id = f"{utterance_id}-{index}"
            asr_segment = self.asr.transcribe_stream(
                segment,
                glossary=self.glossary.get_all(),
                acronym_table=self.acronym.get_all(),
            )
            if asr_segment.text:
                asr_segments.append(asr_segment)

        if not asr_segments:
            return None

        asr_segment = self._combine_asr_segments(asr_segments, utterance_id)
        if self.partial_segment is not None:
            revision = self.revision.check_revision(self.partial_segment, asr_segment)
            self.last_revision = revision if revision.is_dirty else None
        return asr_segment

    def _combine_asr_segments(self, segments, utterance_id: str):
        if len(segments) == 1:
            segments[0].segment_id = utterance_id
            return segments[0]

        combined = copy(segments[0])
        combined.text = " ".join(segment.text for segment in segments if segment.text).strip()
        combined.words = [word for segment in segments for word in segment.words]
        combined.stability_score = sum(segment.stability_score for segment in segments) / len(segments)
        combined.is_final = all(segment.is_final for segment in segments)
        combined.segment_id = utterance_id
        combined.speaker_id = segments[0].speaker_id
        combined.is_overlap = any(segment.is_overlap for segment in segments)
        combined.timestamp_start = min(segment.timestamp_start for segment in segments)
        combined.timestamp_end = max(segment.timestamp_end for segment in segments)
        return combined

    def translate(self, text: str) -> str:
        source_lang, target_lang = self._language_pair()
        if self.monitor.get_level() >= FallbackLevel.FAST_PATH_ONLY:
            return self.fast.translate(text, source_lang, target_lang).translated_text

        context = QualityContext(
            asr_text=text,
            source_lang=source_lang,
            target_lang=target_lang,
            sliding_window=[entry.source_text for entry in self.session.window.get_context()],
            glossary=self.glossary.get_all(),
            acronym_table=self.acronym.get_all(),
            rag_chunks=self._rag_chunks(text),
        )
        try:
            result = self.quality.translate(context)
        except Exception:
            self.monitor.report_timeout()
            return self.fast.translate(text, source_lang, target_lang).translated_text

        if result.timed_out:
            self.monitor.report_timeout()
        else:
            self.monitor.report_success()
        return result.translated_text

    async def translate_dual(self, source_text: str, utterance_id: str) -> str:
        source_lang, target_lang = self._language_pair()
        if self.monitor.get_level() >= FallbackLevel.FAST_PATH_ONLY:
            return await self.translate_fast_only(source_text, utterance_id, source_lang, target_lang)

        fast_task = asyncio.create_task(
            asyncio.to_thread(self.fast.translate, source_text, source_lang, target_lang),
        )
        quality_task = asyncio.create_task(
            asyncio.to_thread(self._translate_quality, source_text, source_lang, target_lang),
        )

        fast_text = ""
        quality_failed = False
        pending = {fast_task, quality_task}
        try:
            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    if task is fast_task:
                        try:
                            fast_result = task.result()
                            fast_text = fast_result.translated_text
                            await self.stream_translation_tokens(utterance_id, fast_text)
                        except Exception as error:
                            self.monitor.report_timeout()
                            await self.send_health_status()
                            if quality_task not in pending:
                                quality_failed = True
                    else:
                        try:
                            quality_text = task.result()
                            final_text = self._annotate_acronyms(quality_text, source_text)
                            await self.send_translation_done(utterance_id, source_text, final_text)
                            self.monitor.report_success()
                            await self.send_health_status()
                            if not fast_task.done():
                                fast_task.cancel()
                            return final_text
                        except Exception as error:
                            level = self._report_quality_error(error)
                            await self.send_health_status()
                            if level == FallbackLevel.REDUCE_CONTEXT:
                                self.session.window.resize(3)
                            quality_failed = True

                if quality_failed and fast_text:
                    final_text = self._annotate_acronyms(fast_text, source_text)
                    await self.send_translation_done(utterance_id, source_text, final_text)
                    return final_text
        finally:
            for task in (fast_task, quality_task):
                if not task.done():
                    task.cancel()

        if fast_text:
            final_text = self._annotate_acronyms(fast_text, source_text)
            await self.send_translation_done(utterance_id, source_text, final_text)
            return final_text

        await self.ws.send_json(
            {
                "type": "error",
                "code": "RAW_TRANSCRIPT",
                "message": "Translation models failed; showing raw ASR transcript.",
            },
        )
        await self.send_translation_done(utterance_id, source_text, source_text)
        return source_text

    async def translate_fast_only(
        self,
        source_text: str,
        utterance_id: str,
        source_lang: str,
        target_lang: str,
    ) -> str:
        try:
            result = await asyncio.to_thread(self.fast.translate, source_text, source_lang, target_lang)
            final_text = self._annotate_acronyms(result.translated_text, source_text)
            await self.stream_translation_tokens(utterance_id, final_text)
            await self.send_translation_done(utterance_id, source_text, final_text)
            return final_text
        except Exception:
            self.monitor.report_critical_failure()
            await self.send_health_status()
            await self.ws.send_json(
                {
                    "type": "error",
                    "code": "RAW_TRANSCRIPT",
                    "message": "Translation models failed; showing raw ASR transcript.",
                },
            )
            await self.send_translation_done(utterance_id, source_text, source_text)
            return source_text

    def _translate_quality(self, source_text: str, source_lang: str, target_lang: str) -> str:
        context = QualityContext(
            asr_text=source_text,
            source_lang=source_lang,
            target_lang=target_lang,
            sliding_window=[entry.source_text for entry in self.session.window.get_context()],
            glossary=self.glossary.get_all(),
            acronym_table=self.acronym.get_all(),
            rag_chunks=self._rag_chunks(source_text),
        )
        result = self.quality.translate(context)
        if result.timed_out:
            raise TimeoutError("Quality translation timed out")
        return result.translated_text

    def _rag_chunks(self, text: str) -> list[str]:
        try:
            return [chunk.text for chunk in self.rag.retrieve(text, top_k=3)]
        except Exception:
            return []

    async def stream_translation(self, utterance_id: str, source_text: str, text: str) -> None:
        await self.stream_translation_tokens(utterance_id, text)
        await self.send_translation_done(utterance_id, source_text, text)

    async def stream_translation_tokens(self, utterance_id: str, text: str) -> None:
        words = text.split()
        for index, word in enumerate(words):
            await self.ws.send_json(
                {
                    "type": "translate.token",
                    "token": word + (" " if index < len(words) - 1 else ""),
                    "utteranceId": utterance_id,
                },
            )

    async def send_translation_done(self, utterance_id: str, source_text: str, text: str) -> None:
        await self.ws.send_json(
            {
                "type": "translate.done",
                "fullText": text,
                "sourceText": source_text,
                "speaker": self.speaker,
                "utteranceId": utterance_id,
            },
        )

    async def send_revision(self, revision, utterance_id: str) -> None:
        await self.ws.send_json(
            {
                "type": "stt.revision",
                "utteranceId": utterance_id,
                "segmentId": revision.segment_id,
                "oldText": revision.old_text,
                "newText": revision.new_text,
                "semanticChange": revision.is_semantic_change,
                "diff": revision.diff,
            },
        )

    async def send_overlap(self, asr_segment, utterance_id: str) -> None:
        await self.ws.send_json(
            {
                "type": "audio.overlap",
                "utteranceId": utterance_id,
                "speaker": asr_segment.speaker_id or self.speaker,
                "sourceLang": self.speaker,
                "start": asr_segment.timestamp_start,
                "end": asr_segment.timestamp_end,
                "strategy": "dominant-speaker-with-buffer",
                "bufferedCount": len(self.overlap_buffer),
                "message": "Multiple speakers detected; overlapped audio was buffered.",
            },
        )

    async def send_health_status(self, force: bool = False) -> None:
        status = self.monitor.status
        key = (
            int(status.level),
            status.consecutive_timeouts,
            status.gpu_available,
            status.network_ok,
            status.mic_ok,
        )
        if not force and key == self._last_status_key:
            return

        self._last_status_key = key
        await self.ws.send_json(
            {
                "type": "system.status",
                "level": int(status.level),
                "status": status.level.name.lower(),
                "consecutiveTimeouts": status.consecutive_timeouts,
                "gpuAvailable": status.gpu_available,
                "networkOk": status.network_ok,
                "micOk": status.mic_ok,
            },
        )

    def _annotate_acronyms(self, text: str, source_text: str) -> str:
        for token in sorted(set(source_text.split()) | set(text.split())):
            acronym = "".join(character for character in token if character.isalnum()).upper()
            if len(acronym) < 2 or not acronym.isupper():
                continue

            resolved = self.acronym.resolve(acronym)
            if resolved:
                full_name = resolved[0]
                if self.acronym.is_first_occurrence(acronym) and acronym in text and f"{acronym} (" not in text:
                    text = text.replace(acronym, f"{acronym} ({full_name})", 1)
            elif acronym in text and self.acronym.is_first_occurrence(acronym):
                text = text.replace(acronym, f"{acronym} (?)", 1)
        return text

    def _remember_overlap(self, raw: bytes, utterance_id: str) -> None:
        self.overlap_buffer.append(
            {
                "utteranceId": utterance_id,
                "audio": raw,
                "timestamp": time.time() - self.started_at,
            },
        )
        if len(self.overlap_buffer) > self.overlap_buffer_limit:
            self.overlap_buffer = self.overlap_buffer[-self.overlap_buffer_limit:]

    async def _track_mic_signal(self, payload: bytes) -> None:
        has_signal = self._payload_has_signal(payload)
        if has_signal and self._mic_down_sent:
            self.monitor.report_mic_ok()
            self._mic_down_sent = False
            await self.send_health_status()
            return
        if not has_signal and not self._mic_down_sent:
            self.monitor.report_mic_loss()
            self._mic_down_sent = True
            await self.send_health_status()

    def _payload_has_signal(self, payload: bytes) -> bool:
        if not payload:
            return False
        samples = np.frombuffer(payload, dtype=np.int16).astype(np.int32)
        return bool(samples.size and np.max(np.abs(samples)) > 32)

    def _report_quality_error(self, error: Exception) -> FallbackLevel:
        message = str(error).casefold()
        if any(marker in message for marker in ("network", "connection", "connect", "timeout", "dns", "socket")):
            return self.monitor.report_network_loss()
        if any(marker in message for marker in ("cuda out of memory", "gpu", "cublas", "cudnn")):
            return self.monitor.report_gpu_failure()
        return self.monitor.report_timeout()

    def _language_pair(self) -> tuple[str, str]:
        return (self.speaker, "en" if self.speaker == "vi" else "vi")

    def _utterance_id(self) -> str:
        return f"{self.session_id}-{self.client_id}-{self.utterance_count + 1}"

    def _load_static_data(self) -> None:
        data_dir = Path(__file__).resolve().parent / "data"
        glossary_path = data_dir / "glossary_vi_en.json"
        acronym_path = data_dir / "acronyms.json"
        if glossary_path.exists():
            self.glossary.load_static(str(glossary_path))
        if acronym_path.exists():
            self.acronym.load_table(str(acronym_path))

    def _ingest_documents(self, paths) -> int:
        if not isinstance(paths, list):
            return 0

        total = 0
        allowed_root = Path(os.getenv("RAG_ALLOWED_ROOT", Path(__file__).resolve().parent / "data")).resolve()
        for raw_path in paths:
            path = Path(str(raw_path)).expanduser().resolve()
            if allowed_root not in (path, *path.parents):
                continue
            if path.is_file():
                total += self.rag.ingest_document(str(path))
        return total

    def _export_session(self) -> None:
        export_dir = os.getenv("SESSION_EXPORT_DIR")
        if not export_dir:
            return

        path = Path(export_dir) / f"{self.session_id}.json"
        self.session.export(str(path))

    async def _send_pipeline_error(self, error: Exception) -> None:
        code = "AI_MODEL_UNAVAILABLE" if isinstance(error, ModelUnavailableError) else "AI_PIPELINE_ERROR"
        LOGGER.error(
            "Pipeline error for session=%s client=%s code=%s: %s",
            self.session_id,
            self.client_id,
            code,
            error,
        )
        message = str(error).casefold()
        if any(marker in message for marker in ("cuda out of memory", "gpu", "cublas", "cudnn")):
            self.monitor.report_gpu_failure()
        else:
            self.monitor.report_critical_failure()
        await self.send_health_status()
        await self.ws.send_json(
            {
                "type": "error",
                "code": code,
                "message": (
                    "The configured AI model is unavailable."
                    if code == "AI_MODEL_UNAVAILABLE"
                    else "The AI pipeline could not process this audio turn."
                ),
            },
        )


async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    ws = WebSocketConnection(reader, writer)
    try:
        await ws.handshake()
        query = parse_qs(urlsplit(ws.path).query)
        session_id = query.get("sessionId", ["local-session"])[0]
        client_id = query.get("clientId", ["local-client"])[0]
        await PipelineSession(ws, session_id, client_id).run()
    except WebSocketClosed:
        pass
    except Exception as error:
        try:
            await ws.send_json(
                {
                    "type": "error",
                    "code": "AI_WORKER_ERROR",
                    "message": str(error),
                },
            )
        except Exception:
            pass
    finally:
        await ws.close()


async def run_server(host: str | None = None, port: int | None = None) -> None:
    host = host or os.getenv("AI_WS_HOST", "127.0.0.1")
    port = port or int(os.getenv("AI_WS_PORT", "8765"))

    # FIX: "warm up" cac shared instance NGAY luc server khoi dong, TRUOC khi
    # mo cong nhan client, de client dau tien khong phai doi load. Voi cau
    # hinh FPT_ASR=true, get_shared_asr_engine() se KHONG tai Whisper local
    # nua; get_shared_fast_translator() chi khoi tao 1 HTTP client toi FPT
    # API (khong con NLLB local), nen buoc warm-up nay rat nhanh va nhe RAM.
    print("Warming up shared resources (VAD; ASR/translate via FPT API when configured)...")
    await asyncio.to_thread(get_shared_audio_pipeline)
    await asyncio.to_thread(get_shared_asr_engine)
    await asyncio.to_thread(get_shared_fast_translator)
    print("All shared resources ready.")

    server = await asyncio.start_server(handle_client, host, port)
    sockets = ", ".join(str(socket.getsockname()) for socket in server.sockets or [])
    print(f"AI worker listening on ws://{host}:{port}/ws/session ({sockets})")
    async with server:
        await server.serve_forever()