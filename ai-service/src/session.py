"""Session worker — one per WebSocket connection.

Implements the full session protocol expected by realtime-service/AiBridgeService.

Key design:
  - Audio queue consumed by _audio_pipeline_loop (async)
  - CPU-bound work (VAD, denoise) runs in thread pool via run_in_executor
  - VadBuffer callbacks use stored event loop reference (avoids deprecated get_event_loop)
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

import numpy as np
from websockets.asyncio.server import ServerConnection

from src import config as cfg
from src.asr import fpt_asr
from src.audio.processor import AudioProcessor
from src.audio.vad_buffer import VadBuffer
from src.translation import fpt_translate

logger = logging.getLogger(__name__)

_SAMPLE_RATE = 16_000
_VAD_FRAME_SAMPLES = 512  # Silero VAD v6 requires exactly 512 samples @ 16kHz


class SessionWorker:
    def __init__(self, ws: ServerConnection, processor: AudioProcessor) -> None:
        self._ws = ws
        self._processor = processor

        self._speaker: str = "vi"
        self._language_pair: str = "vi-en"
        self._initialized: bool = False
        self._utterance_id: str = ""
        self._loop: asyncio.AbstractEventLoop | None = None

        self._audio_queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=500)
        self._pcm_remainder: np.ndarray = np.array([], dtype=np.float32)  # leftover samples between chunks

        # VadBuffer callbacks — set after loop is available (in run())
        self._vad_buf: VadBuffer | None = None

        self._pipeline_task: asyncio.Task | None = None
        self._interim_asr_task: asyncio.Task | None = None
        self._interim_stt_task: asyncio.Task | None = None
        self._interim_translate_task: asyncio.Task | None = None
        self._final_task: asyncio.Task | None = None
        self._last_interim_text: str = ""

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------

    async def run(self) -> None:
        self._loop = asyncio.get_running_loop()

        # Now safe to build VadBuffer (callbacks need self._loop)
        self._vad_buf = VadBuffer(
            on_interim=self._schedule_interim,
            on_utterance=self._schedule_utterance,
            silence_ms=cfg.SILENCE_MS,
            interim_interval_s=cfg.INTERIM_INTERVAL_S,
        )

        self._pipeline_task = asyncio.create_task(self._audio_pipeline_loop())
        try:
            async for raw in self._ws:
                if isinstance(raw, bytes):
                    await self._on_audio(raw)
                elif isinstance(raw, str):
                    await self._on_control(raw)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Session WS error: %s", exc)
        finally:
            await self._shutdown()

    # ------------------------------------------------------------------
    # Message handlers
    # ------------------------------------------------------------------

    async def _on_control(self, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return

        msg_type = msg.get("type")
        logger.debug("Control message: %s", msg_type)

        if msg_type == "session.init":
            await self._handle_init(msg)
        elif msg_type == "session.close":
            await self._ws.close()
        elif msg_type == "speaker.switch":
            new_speaker = msg.get("speaker")
            if new_speaker in ("vi", "en"):
                self._speaker = new_speaker
                self._cancel_interim_tasks()
                if self._final_task and not self._final_task.done():
                    self._final_task.cancel()
                if self._vad_buf:
                    self._vad_buf.reset()
                self._utterance_id = ""
                logger.info("Speaker switched → %s", self._speaker)

    async def _on_audio(self, raw: bytes) -> None:
        if not self._initialized:
            return
        try:
            self._audio_queue.put_nowait(raw)
        except asyncio.QueueFull:
            pass  # ponytail: drop under backpressure — real-time audio, not lossless

    async def _handle_init(self, msg: dict[str, Any]) -> None:
        conf = msg.get("config", {})
        self._speaker = conf.get("speaker", "vi")
        self._language_pair = conf.get("languagePair", "vi-en")

        logger.info(
            "session.init: speaker=%s languagePair=%s",
            self._speaker,
            self._language_pair,
        )

        probe_ok = await self._probe_external_apis()
        if not probe_ok:
            await self._send_json({
                "type": "session.ready",
                "ready": False,
                "code": "EXTERNAL_API_UNAVAILABLE",
                "speaker": self._speaker,
                "languagePair": self._language_pair,
            })
            return

        self._initialized = True
        await self._send_json({
            "type": "session.ready",
            "ready": True,
            "speaker": self._speaker,
            "languagePair": self._language_pair,
            "capabilities": {
                "asr": f"fpt:vi={cfg.FPT_ASR_MODEL_VI},en={cfg.FPT_ASR_MODEL_EN}",
                "translate": f"fpt:{cfg.FPT_LLM_MODEL}",
            },
            "externalApisProbed": True,
        })
        logger.info("Session READY ✓")

    # ------------------------------------------------------------------
    # Audio pipeline — asyncio task
    # ------------------------------------------------------------------

    async def _audio_pipeline_loop(self) -> None:
        """Consume audio queue; split into 512-sample VAD frames, offload CPU to thread pool."""
        loop = asyncio.get_running_loop()
        while True:
            raw = await self._audio_queue.get()

            pcm_int16 = np.frombuffer(raw, dtype=np.int16)
            if len(pcm_int16) == 0:
                continue
            pcm_float = pcm_int16.astype(np.float32) / 32768.0

            # Prepend any leftover samples from previous chunk
            if len(self._pcm_remainder) > 0:
                pcm_float = np.concatenate([self._pcm_remainder, pcm_float])
                self._pcm_remainder = np.array([], dtype=np.float32)

            # Process in exact 512-sample frames (Silero VAD requirement)
            offset = 0
            while offset + _VAD_FRAME_SAMPLES <= len(pcm_float):
                frame = pcm_float[offset : offset + _VAD_FRAME_SAMPLES]
                offset += _VAD_FRAME_SAMPLES

                # Step 1: Silero VAD — run in thread pool
                is_speech = await loop.run_in_executor(
                    None, self._processor.is_speech, frame
                )

                if not is_speech:
                    if self._vad_buf:
                        self._vad_buf.push(frame, is_speech=False)
                    continue

                # Step 2: DeepFilterNet — run in thread pool
                frame_clean = await loop.run_in_executor(
                    None, self._processor.denoise, frame
                )

                # Step 3: VAD buffer — sync, fast
                if self._vad_buf:
                    self._vad_buf.push(frame_clean, is_speech=True)

            # Keep leftover samples for next chunk
            if offset < len(pcm_float):
                self._pcm_remainder = pcm_float[offset:]

    # ------------------------------------------------------------------
    # VadBuffer callbacks (called synchronously from push())
    # ------------------------------------------------------------------

    def _schedule_interim(self, pcm: np.ndarray) -> None:
        if self._loop:
            if self._interim_asr_task and not self._interim_asr_task.done():
                self._interim_asr_task.cancel()
            self._interim_asr_task = self._loop.create_task(self._run_interim_asr(pcm.copy()))

    def _schedule_utterance(self, pcm: np.ndarray) -> None:
        if self._loop:
            self._cancel_interim_tasks()
            if self._final_task and not self._final_task.done():
                self._final_task.cancel()
            self._final_task = self._loop.create_task(self._run_final_asr(pcm.copy()))

    def _cancel_interim_tasks(self) -> None:
        if self._interim_asr_task and not self._interim_asr_task.done():
            self._interim_asr_task.cancel()
        if self._interim_stt_task and not self._interim_stt_task.done():
            self._interim_stt_task.cancel()
        if self._interim_translate_task and not self._interim_translate_task.done():
            self._interim_translate_task.cancel()
        self._last_interim_text = ""

    async def _run_interim_asr(self, pcm: np.ndarray) -> None:
        try:
            text = await fpt_asr.transcribe(pcm, self._speaker)
            if not text or text == self._last_interim_text:
                return
            old_text = self._last_interim_text
            self._last_interim_text = text
            utt_id = self._current_utterance_id()

            if self._interim_stt_task and not self._interim_stt_task.done():
                self._interim_stt_task.cancel()
            self._interim_stt_task = self._loop.create_task(
                self._stream_stt_words(old_text, text, utt_id)
            )

            if self._interim_translate_task and not self._interim_translate_task.done():
                self._interim_translate_task.cancel()
            self._interim_translate_task = self._loop.create_task(
                self._stream_interim_translation(text, utt_id)
            )
        except asyncio.CancelledError:
            pass

    async def _stream_stt_words(self, old_text: str, new_text: str, utt_id: str) -> None:
        try:
            old_words = old_text.split() if old_text else []
            new_words = new_text.split() if new_text else []

            # Find common prefix length
            k = 0
            while k < len(old_words) and k < len(new_words) and old_words[k] == new_words[k]:
                k += 1

            # If no new words to stream (or only minor differences), just emit immediately
            if k >= len(new_words):
                await self._send_json({
                    "type": "stt.partial",
                    "text": new_text,
                    "speaker": self._speaker,
                    "utteranceId": utt_id,
                })
                return

            # Stream the remaining new words for smooth typing effect
            current_prefix = " ".join(new_words[:k]) if k > 0 else ""
            for i in range(k, len(new_words)):
                word = new_words[i]
                current_prefix = f"{current_prefix} {word}".strip() if current_prefix else word
                await self._send_json({
                    "type": "stt.partial",
                    "text": current_prefix,
                    "speaker": self._speaker,
                    "utteranceId": utt_id,
                })
                logger.debug("stt.partial [%s]: %r", self._speaker, current_prefix[:60])
                await asyncio.sleep(0.025)  # 25ms per word
        except asyncio.CancelledError:
            pass

    async def _stream_interim_translation(self, text: str, utt_id: str) -> None:
        src, tgt = self._speaker, self._other_language()
        try:
            async for partial in fpt_translate.translate_stream(text, src, tgt):
                await self._send_json({
                    "type": "translate.partial",
                    "text": partial,
                    "sourceText": text,
                    "speaker": self._speaker,
                    "utteranceId": utt_id,
                })
        except asyncio.CancelledError:
            pass

    async def _run_final_asr(self, pcm: np.ndarray) -> None:
        try:
            old_interim_text = self._last_interim_text
            self._cancel_interim_tasks()
            utt_id = self._current_utterance_id()
            self._utterance_id = ""  # clear so next speech gets a new utterance ID

            text = await fpt_asr.transcribe(pcm, self._speaker)
            if not text:
                return

            # Stream any remaining words before emitting stt.final
            await self._stream_stt_words(old_interim_text, text, utt_id)

            await self._send_json({
                "type": "stt.final",
                "text": text,
                "speaker": self._speaker,
                "utteranceId": utt_id,
            })
            logger.info("stt.final [%s]: %r", self._speaker, text[:80])

            src, tgt = self._speaker, self._other_language()

            last_partial = ""
            async for partial in fpt_translate.translate_stream(text, src, tgt):
                last_partial = partial
                await self._send_json({
                    "type": "translate.partial",
                    "text": partial,
                    "sourceText": text,
                    "speaker": self._speaker,
                    "utteranceId": utt_id,
                })

            if last_partial:
                await self._send_json({
                    "type": "translate.done",
                    "fullText": last_partial,
                    "sourceText": text,
                    "speaker": self._speaker,
                    "utteranceId": utt_id,
                })
                logger.info("translate.done [%s→%s]: %r", src, tgt, last_partial[:80])
        except asyncio.CancelledError:
            pass

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _current_utterance_id(self) -> str:
        if not self._utterance_id:
            self._utterance_id = str(uuid.uuid4())
        return self._utterance_id

    def _other_language(self) -> str:
        return "en" if self._speaker == "vi" else "vi"

    async def _probe_external_apis(self) -> bool:
        """Quick LLM ping to verify API key and connectivity before declaring ready."""
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=cfg.FPT_API_KEY, base_url=cfg.FPT_BASE_URL)
            resp = await client.chat.completions.create(
                model=cfg.FPT_LLM_MODEL,
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=1,
                timeout=15,
            )
            _ = resp.choices[0].message.content
            logger.info("External API probe ✓")
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("External API probe FAILED: %s", exc)
            return False

    async def _send_json(self, payload: dict[str, Any]) -> None:
        try:
            await self._ws.send(json.dumps(payload))
        except Exception as exc:  # noqa: BLE001
            logger.debug("WS send error: %s", exc)

    async def _shutdown(self) -> None:
        self._cancel_interim_tasks()
        if self._final_task and not self._final_task.done():
            self._final_task.cancel()
        if self._pipeline_task:
            self._pipeline_task.cancel()
            try:
                await self._pipeline_task
            except asyncio.CancelledError:
                pass
        if self._vad_buf:
            self._vad_buf.flush_remaining()
        logger.info("Session worker shut down")
