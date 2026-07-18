# AI Pipeline — Real-Time VI-EN Meeting Translator

Thư mục này chứa toàn bộ backend AI pipeline, tổ chức theo các tầng kiến trúc trong `ai.md`.

## Cấu trúc

```
ai/
├── config/          # Tầng 0: Config Layer (glossary, acronym, session config)
├── rag/             # Tầng 0.5: RAG Domain Knowledge Layer
├── audio/           # Tầng 1: Audio Front-end (denoise, VAD, diarization, overlap)
├── asr/             # Tầng 2: ASR Streaming + Revision Handler
├── translation/     # Tầng 2.5: Fast Path (MT) + Quality Path (LLM)
├── fallback/        # Tầng 2.7: Health Monitor & Fallback
├── session/         # Tầng 5: Session Memory (sliding window, vector DB, minutes)
├── models/          # Model weights / download scripts (gitignored)
├── data/            # Glossary files, acronym tables, sample docs
├── tests/           # Unit & integration tests
├── main.py          # Pipeline entrypoint
└── requirements.txt # Python dependencies
```

## Chạy

```bash
cd ai
pip install -r requirements.txt
python main.py
```
