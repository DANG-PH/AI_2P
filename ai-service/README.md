# ai-service — Realtime Meeting Translate Worker

Python WebSocket service kết nối với `realtime-service` (NestJS), thực hiện pipeline:

```
PCM audio (16kHz mono 16-bit)
  → Silero VAD (phát hiện giọng người)
  → DeepFilterNet (lọc tiếng ồn)
  → FPT ASR: FPT.AI-whisper-large-v3-turbo
  → FPT LLM: SaoLa3.1-medium (streaming translate)
```

## Setup

### 1. Tạo virtual env

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # Linux/Mac
```

### 2. Cài dependencies

```bash
pip install -r requirements.txt
```

> ⚠️ `torch` + `silero-vad` + `deepfilternet` nặng ~1-2GB. Lần đầu sẽ lâu.

### 3. Cấu hình API key

```bash
copy .env.example .env
```

Sửa `.env`:
```
FPT_API_KEY=<key thật của bạn từ marketplace.fptcloud.com>
```

### 4. Chạy

```bash
python -m src.main
```

Server lắng nghe tại `ws://0.0.0.0:8765`.

## Cấu trúc

```
src/
  main.py              Entry point, WebSocket server
  config.py            Load env vars
  session.py           SessionWorker — 1 instance/connection
  audio/
    processor.py       Silero VAD + DeepFilterNet (singleton)
    vad_buffer.py      Buffer PCM frames, detect utterance boundaries
  asr/
    fpt_asr.py         FPT Speech-to-Text API
  translation/
    fpt_translate.py   FPT LLM streaming translate
```

## WebSocket Protocol

Kết nối từ `realtime-service`:
```
ws://localhost:8765/ws/session?sessionId=X&clientId=Y
```

### Events (worker → realtime-service)

| Event | Mô tả |
|-------|-------|
| `session.ready` | Xác nhận đã probe APIs xong |
| `stt.partial` | Text interim trong lúc nói |
| `stt.final` | Text cuối khi kết thúc câu |
| `translate.partial` | Dịch streaming (accumulated) |
| `translate.done` | Dịch hoàn chỉnh |
| `error` | Lỗi với code |

## Tuning

| Biến | Mặc định | Mô tả |
|------|---------|-------|
| `VAD_THRESHOLD` | `0.5` | Ngưỡng Silero VAD (0–1). Tăng → ít nhạy hơn |
| `SILENCE_MS` | `400` | Khoảng lặng (ms) để kết thúc câu |
| `INTERIM_INTERVAL_S` | `1.5` | Tần suất gửi interim ASR |
| `FPT_ASR_MODEL_VI` | `FPT.AI-whisper-large-v3-turbo` | Model ASR chuyên biệt cho tiếng Việt |
| `FPT_ASR_MODEL_EN` | `whisper-large-v3-turbo` | Model ASR chuẩn đa ngữ cho tiếng Anh |
| `FPT_LLM_MODEL` | `SaoLa3.1-medium` | Đổi sang `gpt-oss-20b` cho accuracy cao hơn |
