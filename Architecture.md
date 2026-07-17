# ViEngsMeet — Kiến trúc hệ thống

> Real-time Vietnamese ↔ English business meeting translator.
> AISG Hackathon 2 days.

## 1. Tổng quan luồng dữ liệu (bạn hỏi luồng đúng hay sai)

**Luồng bạn hình dung:**
> Client kết nối NestJS → gửi realtime voice → NestJS chuyển tiếp FastAPI → dịch → stream ngược NestJS → broadcast tất cả người trong cuộc họp.

**Đánh giá:** Đúng về mặt tổng thể. Chỉ cần bổ sung:

1. FastAPI làm **3 bước** chứ không chỉ dịch: **VAD → STT → Translation**.
2. Trước khi streaming voice, cần **setup session** (tạo session ID, JWT, mở WS #2 sang FastAPI trước).
3. Broadcast cần biết **"cuộc họp"** là gì → NestJS quản lý concept **room** (nhiều client cùng sessionId).

**Luồng chuẩn:**

```
[SETUP]
Client POST /sessions → NestJS trả sessionId + token
Client mở WS → NestJS verify token, mở WS #2 sang FastAPI, join room

[STREAMING]
Client mic → PCM 16kHz chunks → WS #1
      ↓
NestJS forward binary → WS #2
      ↓
FastAPI: VAD phát hiện câu → STT ra text → Translation stream tokens
      ↓
Events (stt.partial, stt.final, translate.token, translate.done) → WS #2
      ↓
NestJS broadcast tất cả client trong room → WS #1 (mỗi client)
      ↓
Client render 2 cột EN | VI

[END]
Client POST /sessions/:id/export → NestJS build DOCX từ RAM
NestJS close WS #2, cleanup session
```

---

## 2. Sơ đồ kiến trúc

```
┌───────────────────────────────────────────────────────────────┐
│                    Client (Next.js)                           │
│                                                               │
│  - Capture mic (AudioWorklet, PCM 16kHz)                      │
│  - WebSocket #1 → NestJS                                      │
│  - Render transcript 2 cột                                    │
│  - Export DOCX                                                │
└──────────────────────────┬────────────────────────────────────┘
                           │ WSS (public) + HTTPS REST
                           │
┌──────────────────────────▼────────────────────────────────────┐
│                    NestJS Gateway                             │
│                                                               │
│  Vai 1: WS SERVER cho client                                  │
│  Vai 2: WS CLIENT sang FastAPI                                │
│  Vai 3: REST API (session CRUD, export)                       │
│                                                               │
│  Session state trong RAM (Map)                                │
│  Broadcast events tới các client cùng room                    │
└──────────────────────────┬────────────────────────────────────┘
                           │ WS internal (docker network)
                           │
┌──────────────────────────▼────────────────────────────────────┐
│                    FastAPI AI Worker                          │
│                                                               │
│  Pipeline (asyncio):                                          │
│  - VAD (Silero) phát hiện đầu/cuối câu                        │
│  - STT (Faster-Whisper / PhoWhisper)                          │
│  - Glossary retrieval (JSON file, in-memory)                  │
│  - Translation (SEA-LION qua vLLM, streaming tokens)          │
│  - TTS optional                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. Client (Next.js / React) — Trách nhiệm

### 3.1 Nhiệm vụ chính

- **Audio capture**: xin quyền mic, capture PCM 16kHz mono, chunk 200ms.
- **Realtime UI**: hiển thị partial + final transcript, streaming translation tokens.
- **Session lifecycle**: tạo, join, kết thúc phiên họp.
- **Export**: download biên bản DOCX khi meeting kết thúc.

### 3.2 KHÔNG làm

- Không xử lý AI (STT, translation).
- Không lưu transcript lâu dài (server làm).
- Không gọi thẳng FastAPI (luôn qua NestJS).

### 3.3 Các module chính

```
apps/web/src/
├── app/
│   ├── page.tsx                    # Landing (tạo session)
│   ├── meeting/[id]/page.tsx       # Meeting room UI
│   └── layout.tsx
├── hooks/
│   ├── useAudioCapture.ts          # Mic → PCM chunks
│   ├── useMeetingSocket.ts         # WebSocket client + event handling
│   └── useSession.ts               # REST calls
├── components/
│   ├── TranscriptPanel.tsx         # 2 cột EN | VI
│   ├── RecordButton.tsx            # Toggle mic
│   ├── SpeakerSwitch.tsx           # VN/EN speaker
│   └── ExportButton.tsx
├── lib/
│   ├── api.ts                      # REST client
│   ├── ws-client.ts                # WebSocket wrapper + reconnect
│   └── audio-utils.ts              # PCM conversion helpers
└── stores/
    └── meetingStore.ts             # Zustand: session, utterances
```

### 3.4 Luồng client

**Tạo session:**
```
User bấm "Bắt đầu meeting"
→ POST /api/sessions { domain, languagePair }
→ Nhận { sessionId, token, wsUrl }
→ Navigate to /meeting/{sessionId}
→ Lưu token vào state
```

**Mở WebSocket:**
```
Component mount trên /meeting/{id}
→ new WebSocket(`${wsUrl}?sessionId=${id}&token=${token}`)
→ Chờ event 'session.ready'
→ Enable nút mic
```

**Recording:**
```
User bấm nút mic
→ getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } })
→ AudioContext + AudioWorklet load pcm-worklet.js
→ Worklet chunk PCM Int16 mỗi 200ms
→ postMessage ArrayBuffer về main thread
→ ws.send(buffer)  // binary frame

Song song:
ws.onmessage = (e) => {
  const event = JSON.parse(e.data)
  switch(event.type):
    case 'stt.partial': updatePartialText(event)
    case 'stt.final': commitSourceText(event)
    case 'translate.token': appendToken(event)
    case 'translate.done': finalizeUtterance(event)
}
```

**Kết thúc:**
```
User bấm "Kết thúc"
→ ws.send({ type: 'session.end' })
→ POST /api/sessions/:id/export
→ Nhận file .docx blob
→ Trigger download
→ ws.close()
```

### 3.5 State management

```typescript
type Utterance = {
  id: string;
  speaker: 'vi' | 'en';
  sourceText: string;        // stt.final
  partialSource?: string;    // stt.partial (đang gõ)
  translatedText: string;    // build dần từ translate.token
  status: 'transcribing' | 'translating' | 'done';
  timestamp: number;
};

type MeetingStore = {
  sessionId: string | null;
  token: string | null;
  status: 'idle' | 'connecting' | 'active' | 'ended';
  utterances: Utterance[];
  currentSpeaker: 'vi' | 'en';
  // actions
  addPartial: (id: string, text: string) => void;
  commitFinal: (id: string, text: string) => void;
  appendToken: (id: string, token: string) => void;
};
```

---

## 4. NestJS Gateway — Trách nhiệm

### 4.1 Nhiệm vụ chính

- **REST API**: session CRUD, export DOCX, glossary CRUD.
- **WebSocket server**: nhận connection từ client, forward audio, broadcast events.
- **WebSocket client**: mở connection sang FastAPI cho mỗi session.
- **Session state**: giữ trong Map RAM (sessionId → session data).
- **Auth**: verify JWT, session ID validation.
- **Export**: build DOCX 2 cột từ transcript.

### 4.2 KHÔNG làm

- Không xử lý audio (không decode, không VAD).
- Không gọi model AI trực tiếp.
- Không lưu DB (RAM only cho hackathon).

### 4.3 Cấu trúc module

```
apps/gateway/src/
├── main.ts                         # Bootstrap với WsAdapter
├── app.module.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.service.ts             # JWT sign/verify
│   └── ws-auth.guard.ts
├── session/
│   ├── session.module.ts
│   ├── session.controller.ts       # REST: POST /sessions
│   ├── session.service.ts          # Business logic
│   └── session.store.ts            # In-memory Map
├── audio/
│   ├── audio.module.ts
│   ├── audio.gateway.ts            # WS server cho client
│   └── ai-bridge.service.ts        # WS client sang FastAPI
├── export/
│   ├── export.module.ts
│   ├── export.controller.ts        # POST /sessions/:id/export
│   └── docx-builder.service.ts     # python-docx equivalent
├── glossary/
│   ├── glossary.module.ts
│   └── glossary.service.ts         # Load JSON, cache RAM
└── common/
    ├── types/                      # Shared TS types
    └── config/
```

### 4.4 Luồng NestJS

**REST — Tạo session:**
```
POST /api/sessions
Body: { domain: "business", languagePair: "vi-en" }
→ SessionController.create()
  → SessionService.create()
    → generate sessionId (UUID)
    → sessionStore.set(sessionId, { ...config, utterances: [], clientSockets: new Set() })
    → AuthService.issueToken(sessionId) → JWT
  → Return { sessionId, token, wsUrl: "/audio" }
```

**WS Server — Client connect:**
```
Client kết nối wss://.../audio?sessionId=X&token=Y

AudioGateway.handleConnection(client, request):
  1. Parse query: sessionId, token
  2. AuthService.verify(token, sessionId) → nếu fail, close(1008)
  3. Attach client.sessionId = sessionId
  4. sessionStore.get(sessionId).clientSockets.add(client)
  5. AiBridgeService.openSession(sessionId)  // idempotent
  6. AiBridgeService.onEvent(sessionId, event => {
       broadcastToRoom(sessionId, event)
     })
  7. client.send({ type: 'session.ready' })
```

**WS Server — Client gửi audio:**
```
client.on('message', (data, isBinary) => {
  if (isBinary):
    // Fire-and-forget forward, KHÔNG await
    AiBridgeService.forwardAudio(client.sessionId, data)
  else:
    // Control JSON
    const msg = JSON.parse(data)
    if (msg.type === 'speaker.switch'):
      AiBridgeService.sendControl(client.sessionId, msg)
})
```

**WS Client — Nhận events từ FastAPI:**
```
AiBridgeService.openSession(sessionId):
  const aiWs = new WebSocket(`ws://ai:8000/ws/session?sessionId=${sessionId}`)
  await open
  aiWs.on('message', data => {
    const event = JSON.parse(data)
    // Emit qua EventEmitter, subscribers là các client
    emitter.emit('event', event)
  })
```

**Broadcast tới room:**
```
broadcastToRoom(sessionId, event):
  const session = sessionStore.get(sessionId)
  session.clientSockets.forEach(client => {
    if (client.readyState === OPEN):
      client.send(JSON.stringify(event))
  })
  
  // Nếu event có ý nghĩa persist, append vào utterances
  if (event.type === 'translate.done'):
    session.utterances.push({
      id: event.utteranceId,
      speaker: event.speaker,
      sourceText: event.sourceText,
      translatedText: event.fullText,
      timestamp: Date.now()
    })
```

**REST — Export:**
```
POST /api/sessions/:id/export
→ ExportController.export(id)
  → sessionStore.get(id) → utterances
  → DocxBuilderService.build(utterances, metadata)
    → 2 cột EN | VI, header, footer
  → Return .docx stream
```

### 4.5 Session store schema

```typescript
type ServerSession = {
  id: string;
  domain: string;
  languagePair: string;
  startedAt: Date;
  endedAt?: Date;
  utterances: Array<{
    id: string;
    speaker: 'vi' | 'en';
    sourceText: string;
    translatedText: string;
    timestamp: number;
    latencyMs: number;
  }>;
  clientSockets: Set<WebSocket>;    // multiple clients trong 1 meeting
  aiSocket: WebSocket;               // 1 kết nối duy nhất sang FastAPI
};

class SessionStore {
  private sessions = new Map<string, ServerSession>();
  
  create(config): ServerSession { ... }
  get(id): ServerSession | undefined { ... }
  addClient(id, ws): void { ... }
  removeClient(id, ws): void { ... }
  appendUtterance(id, utt): void { ... }
  end(id): void { ... }
}
```

---

## 5. FastAPI AI Worker — Trách nhiệm

### 5.1 Nhiệm vụ chính

- **WebSocket server**: nhận audio từ NestJS, gửi events về.
- **VAD**: Silero VAD phát hiện đầu/cuối câu.
- **STT**: Whisper cho EN, PhoWhisper cho VN.
- **Glossary retrieval**: match keywords với dict thuật ngữ.
- **Translation**: SEA-LION qua vLLM, streaming tokens.
- **TTS** (optional): F5-TTS, trả về audio binary.

### 5.2 KHÔNG làm

- Không quản session lifecycle (NestJS làm).
- Không auth (NestJS đã filter).
- Không lưu data.
- Không giao tiếp trực tiếp với client.

### 5.3 Cấu trúc

```
apps/ai/
├── main.py                         # FastAPI app, WS endpoint
├── pipeline/
│   ├── __init__.py
│   ├── session.py                  # SessionPipeline class
│   ├── vad.py                      # Silero VAD wrapper
│   ├── stt.py                      # Whisper + PhoWhisper wrapper
│   ├── translate.py                # SEA-LION via vLLM
│   └── tts.py                      # F5-TTS (optional)
├── models/
│   ├── loader.py                   # Load model 1 lần khi startup
│   └── warmup.py                   # Warm-up với dummy input
├── glossary/
│   ├── store.py                    # Load JSON, keyword match
│   └── data/
│       ├── business.json
│       ├── it.json
│       └── manufacturing.json
├── schemas/
│   └── events.py                   # Pydantic models
├── config.py
└── requirements.txt
```

### 5.4 Luồng FastAPI

**Startup:**
```
on_startup:
  load Whisper large-v3
  load PhoWhisper (nếu có GPU đủ)
  load SEA-LION 9B via vLLM
  load Silero VAD
  load glossaries từ JSON
  warm-up với dummy input
```

**WS endpoint:**
```
@app.websocket("/ws/session")
async def session_endpoint(websocket, sessionId):
  await websocket.accept()
  pipeline = SessionPipeline(sessionId, websocket)
  await pipeline.start()  # start 3 background tasks
  
  try:
    while True:
      message = await websocket.receive()
      if "bytes" in message:
        await pipeline.audio_queue.put(message["bytes"])
      elif "text" in message:
        event = json.loads(message["text"])
        await pipeline.handle_control(event)
  except WebSocketDisconnect:
    pass
  finally:
    await pipeline.cleanup()
```

**Pipeline với 3 task async song song:**

```
class SessionPipeline:
  audio_queue: Queue[bytes]
  stt_queue: Queue[np.ndarray]
  translate_queue: Queue[UtteranceText]
  
  async def start(self):
    self.tasks = [
      asyncio.create_task(self._vad_loop()),
      asyncio.create_task(self._stt_loop()),
      asyncio.create_task(self._translate_loop()),
    ]
  
  async def _vad_loop(self):
    speech_buffer = []
    while True:
      chunk = await self.audio_queue.get()
      pcm_np = pcm_bytes_to_np(chunk)
      
      is_speech = vad.detect(pcm_np)
      if is_speech:
        speech_buffer.append(pcm_np)
      elif speech_buffer:  # transition speech → silence
        segment = np.concatenate(speech_buffer)
        speech_buffer.clear()
        await self.stt_queue.put(segment)
  
  async def _stt_loop(self):
    while True:
      segment = await self.stt_queue.get()
      language = self.detect_language(segment)  # hoặc hint từ control
      model = phowhisper if language == 'vi' else whisper_en
      
      # Emit partial results
      async for partial in model.stream_transcribe(segment):
        await self.ws.send_json({
          "type": "stt.partial",
          "text": partial,
          "speaker": language,
          "utteranceId": self.current_utt_id,
        })
      
      final_text = await model.finalize(segment)
      await self.ws.send_json({
        "type": "stt.final",
        "text": final_text,
        "speaker": language,
        "utteranceId": self.current_utt_id,
      })
      
      await self.translate_queue.put({
        "text": final_text,
        "source_lang": language,
        "target_lang": "en" if language == "vi" else "vi",
        "utterance_id": self.current_utt_id,
      })
  
  async def _translate_loop(self):
    while True:
      req = await self.translate_queue.get()
      
      # Retrieve glossary terms
      terms = glossary.retrieve(req["text"], self.domain, top_k=5)
      
      # Build prompt
      prompt = build_translation_prompt(
        text=req["text"],
        source_lang=req["source_lang"],
        target_lang=req["target_lang"],
        glossary=terms,
      )
      
      # Stream tokens
      full_text = ""
      async for token in llm.stream(prompt):
        full_text += token
        await self.ws.send_json({
          "type": "translate.token",
          "token": token,
          "utteranceId": req["utterance_id"],
        })
      
      await self.ws.send_json({
        "type": "translate.done",
        "fullText": full_text,
        "utteranceId": req["utterance_id"],
      })
```

---

## 6. Protocol & Event Schema

### 6.1 Client ↔ NestJS (WS #1)

**Client → NestJS:**
- Binary frames: PCM audio Int16 16kHz mono, chunks 200ms
- JSON control frames:
```json
{ "type": "speaker.switch", "speaker": "vi" | "en" }
{ "type": "session.end" }
{ "type": "glossary.override", "sourceTerm": "X", "targetTerm": "Y" }
```

**NestJS → Client:**
```json
{ "type": "session.ready" }
{ "type": "stt.partial", "text": "...", "speaker": "vi", "utteranceId": "..." }
{ "type": "stt.final", "text": "...", "speaker": "vi", "utteranceId": "..." }
{ "type": "translate.token", "token": "...", "utteranceId": "..." }
{ "type": "translate.done", "fullText": "...", "utteranceId": "..." }
{ "type": "error", "code": "...", "message": "..." }
```

### 6.2 NestJS ↔ FastAPI (WS #2)

Cùng schema như trên, nhưng:
- Không có auth (đã filter tại NestJS)
- Có thêm control messages nội bộ:
```json
{ "type": "session.init", "config": { "domain": "business", ... } }
{ "type": "session.close" }
```

### 6.3 REST endpoints (NestJS)

```
POST   /api/sessions
       Body: { domain, languagePair }
       Response: { sessionId, token, wsUrl }

GET    /api/sessions/:id
       Response: { session data, utterances[] }

POST   /api/sessions/:id/export?format=docx
       Response: file stream

DELETE /api/sessions/:id
       Response: { ok: true }

GET    /api/glossaries
       Response: { glossaries: [...] }

POST   /api/glossaries/:id/terms
       Body: { sourceTerm, targetTerm }
       Response: { term }
```

---

## 7. Deployment (VPS)

```yaml
# docker-compose.yml
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on: [gateway, web]

  web:
    build: ./apps/web
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
    ports: ["3000:3000"]

  gateway:
    build: ./apps/gateway
    environment:
      - AI_WS_URL=ws://ai:8000/ws/session
      - JWT_SECRET=${JWT_SECRET}
      - FRONTEND_URL=https://app.yourdomain.com
    ports: ["3001:3001"]
    depends_on: [ai]

  ai:
    build: ./apps/ai
    environment:
      - MODEL_CACHE=/models
    volumes:
      - ./models:/models
    ports: ["8000:8000"]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  caddy_data:
```

```
# Caddyfile
api.yourdomain.com {
  reverse_proxy /api/* gateway:3001
  reverse_proxy /audio gateway:3001
}

app.yourdomain.com {
  reverse_proxy web:3000
}
```

---

## 8. Latency budget

| Stage | Target |
|-------|--------|
| Client mic → NestJS | 30-80ms |
| NestJS forward → FastAPI | 1-3ms |
| VAD detect end of speech | 300-500ms |
| STT transcribe (streaming partial) | 200-500ms |
| Glossary retrieval | 10-30ms |
| SEA-LION first token | 300-500ms |
| SEA-LION all tokens | 500-1000ms |
| FastAPI event → NestJS | 1-3ms |
| NestJS broadcast → clients | 30-80ms |
| **Total perceived (partial visible)** | **~600-900ms** |
| **Total complete (translation done)** | **~1.2-1.8s** |

---

## 9. Bảo mật

- TLS/WSS everywhere (Caddy + Let's Encrypt tự động)
- JWT auth cho WS handshake
- Session ID = UUID v4 (không đoán được)
- CORS strict tới frontend origin
- Không log content transcript, chỉ log metadata
- Audio không lưu disk
- On-premise: model chạy local, không gọi cloud API

---

## 10. Roadmap sau hackathon

- [ ] Speaker diarization (pyannote-audio)
- [ ] Multi-domain glossary với vector search (Qdrant)
- [ ] Fine-tune SEA-LION LoRA cho business VN-SG context
- [ ] React Native mobile app cho delegates
- [ ] Postgres + Redis cho multi-session scale
- [ ] Prometheus/Grafana monitoring
- [ ] End-to-end encryption client-to-client