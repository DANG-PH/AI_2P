# ViEnMeet — Integration Guide

> Tài liệu mô tả contract tích hợp dự kiến giữa 3 hệ thống. Trạng thái và
> giới hạn triển khai hiện tại được ghi rõ trong từng phần:
> - **Frontend (React + Vite)**: đọc **Phần 2**
> - **AI Service (FastAPI)**: đọc **Phần 3**
>
> Cả 2 team đọc **Phần 1** để hiểu bức tranh tổng thể.

---

## PHẦN 1 — TỔNG QUAN

### 1.1 Kiến trúc 3 hệ thống độc lập

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (React + Vite)                       │
│                                                                 │
│  ┌────────────────────┐        ┌──────────────────────┐         │
│  │ Transcript Module  │        │ Video Call Module    │         │
│  │  (Socket.IO)       │        │  (livekit-client)    │         │
│  └─────────┬──────────┘        └──────────┬───────────┘         │
└────────────┼───────────────────────────────┼────────────────────┘
             │                               │
             │ Socket.IO /audio              │ WebRTC (WSS + UDP)
             │ (WSS)                         │
             ▼                               ▼
   ┌──────────────────────┐        ┌──────────────────────┐
   │  NestJS Gateway      │        │  LiveKit Server      │
   │  api-hackathon.      │        │  livekit-hackathon.  │
   │   dangpham.id.vn     │        │   dangpham.id.vn     │
   │                      │        │                      │
   │  - Socket.IO /audio  │        │  - SFU               │
   │  - POST /livekit/    │───────▶│  - Signaling         │
   │    token             │  JWT   │  - Media forwarding  │
   │  - GET /health       │        │                      │
   │    (planned)         │        │                      │
   └──────────┬───────────┘        └──────────────────────┘
              │                               ▲
              │ raw ws://localhost:8000       │ (client connect trực tiếp
              │ (internal, không public)      │  bằng JWT NestJS cấp)
              ▼
   ┌──────────────────────┐
   │  FastAPI AI Worker   │
   │  (localhost:8000)    │
   │  - VAD + STT + LLM   │
   └──────────────────────┘
```

### 1.2 Nhiệm vụ mỗi hệ thống

| Hệ thống | Nhiệm vụ | Ai code |
|----------|----------|---------|
| **Client** (React + Vite) | UI, capture audio, hiển thị transcript, video call | Frontend team |
| **NestJS** | Auth LiveKit, session state, forward audio, broadcast events | Có implementation; xem giới hạn ở Phần 2 |
| **FastAPI** | VAD + Speech-to-Text + Translation | AI team |
| **LiveKit Server** | Video call SFU | ✅ Deploy Docker |

### 1.3 Backend NestJS đang expose gì

| Endpoint | Method | Purpose | Ai gọi |
|----------|--------|---------|--------|
| `/audio` (Socket.IO) | WSS | Realtime transcript pipeline | Client |
| `/livekit/token` | POST | Sinh JWT để join room LiveKit | Client |
| `/health` | GET | Health check monitoring | Ops — đã ghi trong contract nhưng chưa có controller tương ứng |
| `ws://localhost:8000/ws/session` | — | Bridge sang FastAPI | NestJS gọi FastAPI |

**Base URL production:** `https://api-hackathon.dangpham.id.vn`

---

## PHẦN 2 — CHO FRONTEND DEVELOPER

### 2.1 Cài dependencies

Frontend hiện dùng `pnpm` và chưa cài client production vì realtime connection
vẫn bị khóa ở prototype. Khi các blocker tại mục 2.10 được xử lý và team quyết
định bật tích hợp:

```bash
cd frontend
pnpm add socket.io-client livekit-client
```

Stack frontend hiện tại: React 19, Vite 8, TypeScript 6 strict, React Router 8,
Zustand 5 và Tailwind CSS 4. Node.js 22.22 trở lên.

### 2.2 Bootstrap flow — thứ tự thao tác khi vào phòng họp

```
Bước 1: Lấy roomId từ route /room/:roomId và clientId ổn định từ localStorage
Bước 2: Dùng roomId làm cả Socket.IO sessionId và LiveKit roomName
Bước 3: Song song (chạy đồng thời, không cần đợi nhau):
        [A] Kết nối Socket.IO (transcript)
        [B] Lấy token + connect LiveKit (video)
Bước 4: Nhận 'session.ready' → xác nhận gateway đã nhận client
Bước 5: Chỉ enable audio sau một tín hiệu AI-ready thực sự
Bước 6: User bật mic → capture audio 16kHz PCM → emit 'audio.chunk'
Bước 7: Chuẩn hóa events transcript và cập nhật store bằng utteranceId
```

> **Quan trọng:** implementation hiện phát `session.ready` ngay sau khi gọi
> `openSession()`, trước khi WebSocket sang AI worker phát sự kiện `open`.
> Vì vậy frontend chỉ được diễn giải event này là **gateway connected**, không
> phải AI-ready. Nếu gửi audio ở thời điểm này, backend có thể drop chunk.

### 2.3 Setup identifiers

```typescript
const CLIENT_ID_STORAGE_KEY = 'vienmeet-client-id';

function getOrCreateClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!id) {
    id = `client-${crypto.randomUUID()}`;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
  }
  return id;
}

// Canonical route: /room/:roomId
const roomId = routeParams.roomId;
const sessionId = roomId;
const roomName = roomId;
const clientId = getOrCreateClientId();
```

Các invariant frontend:

- `roomId === sessionId === roomName`.
- Một browser giữ một `clientId` ổn định qua reload.
- Khi gọi LiveKit token, `participantName === clientId`.
- Transcript phải giữ `roomId`, thứ tự, timing và draft/final status. Vì server
  chưa gửi sequence/timing, frontend tạm derive hai giá trị này khi nhận event.

### 2.4 Transcript integration (Socket.IO)

#### 2.4.1 Kết nối

```typescript
import { io, type Socket } from 'socket.io-client';

const socket: Socket = io(`${import.meta.env.VITE_API_URL}/audio`, {
  query: {
    sessionId,
    clientId,
    domain: 'business',        // optional, default 'business'
    languagePair: 'vi-en',     // optional, default 'vi-en'
  },
  transports: ['websocket'],   // BẮT BUỘC — không dùng polling
});

socket.on('connect', () => console.log('Socket connected'));
socket.on('connect_error', (err) => console.error('Connect failed:', err));
```

⚠️ Nếu thiếu `sessionId` hoặc `clientId` → server sẽ disconnect ngay lập tức.

#### 2.4.2 Events bạn PHẢI emit

| Event | Payload | Khi nào gửi |
|-------|---------|-------------|
| `audio.chunk` | `ArrayBuffer` (PCM Int16, 16kHz, mono) | Liên tục ~200ms/chunk khi đang ghi âm |
| `speaker.switch` | `{ speaker: 'vi' \| 'en' }` | Khi user đổi ngôn ngữ đang nói |
| `session.end` | (không payload) | Khi user bấm "Kết thúc meeting" |

⚠️ **Chưa bật gửi `audio.chunk` trong frontend hiện tại.** Backend cần phát
một event AI-ready sau khi bridge WebSocket thật sự mở. Chỉ dựa vào
`session.ready` hiện tại chưa đủ an toàn vì event này được phát trước callback
`aiWs.on('open')`.

#### 2.4.3 Events bạn PHẢI listen

| Event | Payload | Xử lý UI |
|-------|---------|----------|
| `session.ready` | `{ clientId, sessionId }` | Đánh dấu `gateway-connected`; chưa được coi là AI-ready |
| `stt.partial` | `{ text, speaker, utteranceId }` | Hiện text nhạt màu, cùng `utteranceId` thì **replace** |
| `stt.final` | `{ text, speaker, utteranceId }` | Chốt câu nguồn màu đen, tạo entry mới trong danh sách utterance |
| `translate.token` | `{ token, utteranceId }` | Append token vào cột đích (streaming) |
| `translate.done` | `{ fullText, sourceText, speaker, utteranceId }` | Chốt câu dịch, animation highlight |
| `session.ended` | (không payload) | Disable mic, hiện nút "Export" (nếu có) |
| `error` | `{ code, message }` | Toast đỏ |

**Broadcast note:** cả 4 event transcript được broadcast tới **TẤT CẢ client
trong room**. Ai cũng thấy transcript của người đang nói. Không phải chỉ người
nói mới thấy.

Frontend đã định nghĩa các schema trên trong `src/types/realtime.ts`. Cả
deterministic demo và adapter Socket.IO tương lai phải đưa event qua cùng reducer
thuần `applyRealtimeTranscriptEvent` trong `src/lib/realtimeEvents.ts`; không
duy trì hai state machine khác nhau.

#### 2.4.4 State machine 1 utterance

```
[stt.partial] × N     → replace originalText, status = transcribing
[stt.final] × 1       → chốt originalText, status = draft
[translate.token] × N → append translatedText, status = draft
[translate.done] × 1  → replace bản cuối, status = final, set endedAt
```

Frontend lưu một normalized `ConversationTurn` thay vì một state song song riêng
cho Socket.IO. Turn map `utteranceId` từ event vào field `id`, đồng thời giữ
`roomId`,
`sequenceNumber`, participant/speaker identity, source/target language,
`startedAt`, `endedAt`, original/translated text và status. Event có cùng
`utteranceId` cập nhật đúng turn; không tự tạo turn từ một orphan
`translate.token`.

#### 2.4.5 Capture audio 16kHz PCM

Contract backend yêu cầu **PCM signed Int16 little-endian, 16 kHz, mono**.
Browser thường capture ở sample rate thiết bị (thường 44.1 hoặc 48 kHz), và
constraint `sampleRate: 16000` chỉ là yêu cầu, không đảm bảo kết quả.

Audio adapter cần:

1. Xin một `MediaStream` audio và dùng chung cho LiveKit + transcript pipeline.
2. Đọc sample rate thực tế từ `AudioContext`.
3. Downmix về mono và resample thật sự về 16 kHz trong AudioWorklet.
4. Convert Float32 sang signed Int16 little-endian.
5. Buffer thành chunk khoảng 200 ms (3,200 samples / 6,400 bytes) trước khi emit.
6. Không connect worklet ra destination để tránh local echo.
7. Stop tracks, disconnect nodes, close context và ngừng emit khi mute/unmount.

Phải kiểm thử ít nhất với input 44.1 kHz và 48 kHz; chỉ đổi kiểu Float32 sang
Int16 mà không resample là sai contract.

⚠️ **LiveKit và transcript phải dùng chung một `MediaStream`.** Không gọi
`getUserMedia()` hai lần cho cùng microphone. Media track gốc được publish qua
LiveKit; một nhánh Web Audio đọc cùng stream để resample và gửi transcript.
Mute/unmute cần điều phối cả publish state và việc emit PCM, nhưng chỉ owner của
media adapter mới được stop track.

### 2.5 Video call integration (LiveKit)

#### 2.5.1 Lấy token từ NestJS

```typescript
import type {
  LiveKitTokenRequest,
  LiveKitTokenResponse,
} from '@/types/realtime';

const payload: LiveKitTokenRequest = {
  roomName: sessionId,       // BẮT BUỘC trùng với sessionId Socket.IO
  participantName: clientId, // BẮT BUỘC trùng với clientId Socket.IO
};

const res = await fetch(`${import.meta.env.VITE_API_URL}/livekit/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

if (!res.ok) throw new Error(`LiveKit token request failed: ${res.status}`);

const { token, url } = (await res.json()) as LiveKitTokenResponse;
// url = "wss://livekit-hackathon.dangpham.id.vn"
```

#### 2.5.2 Connect vào room

```typescript
import { Room, RoomEvent, Track } from 'livekit-client';

const room = new Room();
await room.connect(url, token);
await room.localParticipant.enableCameraAndMicrophone();
```

#### 2.5.3 Handle events

```typescript
// Khi có người mới publish track (hoặc mình vừa join thấy người có sẵn)
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  const container = document.getElementById(`video-${participant.identity}`);
  if (!container) return;

  if (track.kind === Track.Kind.Video) {
    const el = track.attach();
    container.appendChild(el);
  } else if (track.kind === Track.Kind.Audio) {
    track.attach();  // audio auto play
  }
});

// Người rời phòng
room.on(RoomEvent.ParticipantDisconnected, (participant) => {
  document.getElementById(`video-${participant.identity}`)?.replaceChildren();
});

// Người mới join (chưa publish track)
room.on(RoomEvent.ParticipantConnected, (participant) => {
  console.log('New participant:', participant.identity);
  // Có thể tạo sẵn tile trống chờ track
});

// Track unpublish (user tắt cam)
room.on(RoomEvent.TrackUnsubscribed, (track) => {
  track.detach().forEach((el) => el.remove());
});
```

#### 2.5.4 Mapping video ↔ transcript

LiveKit phải dùng `participant.identity === clientId`. Tuy nhiên transcript
events hiện chỉ có `speaker` (`vi`/`en`) và `utteranceId`, không có `clientId`
hoặc `participantId`. Vì vậy frontend **chưa thể map transcript vào đúng video
tile một cách tin cậy**, đặc biệt khi có reconnect hoặc hai người cùng nói.
Backend cần bổ sung participant identity vào mọi transcript event trước khi bật
overlay theo người.

### 2.6 Kết thúc phiên

```typescript
async function endMeeting() {
  socket.emit('session.end');   // báo NestJS đóng session
  await room.disconnect();       // rời LiveKit
  socket.disconnect();           // đóng Socket.IO
}
```

### 2.7 Env cho Vite

```dotenv
VITE_API_URL=https://api-hackathon.dangpham.id.vn
```

Chỉ đọc URL qua `import.meta.env.VITE_API_URL`. Không đưa secret vào biến
`VITE_*` vì mọi giá trị này được bundle xuống browser. Không cần set
`LIVEKIT_URL` ở frontend — NestJS trả về URL cùng token từ
`POST /livekit/token`.

### 2.8 Kiến trúc frontend hiện tại

Frontend đang là vertical slice chạy hoàn toàn trong browser:

```text
React Router
  └─ page (layout + orchestration)
      ├─ UI components
      ├─ typed EN/VI dictionaries
      └─ Zustand meeting store
           ├─ deterministic demo events
           └─ future Socket.IO adapter
                    │
                    ▼
          applyRealtimeTranscriptEvent
                    │
                    ▼
           normalized meeting turns
```

Các module quan trọng:

| Module | Trách nhiệm |
|---|---|
| `src/app/router.tsx` | Route và compatibility redirect |
| `src/lib/meetingIdentity.ts` | Sinh `roomId`, persist `clientId` |
| `src/types/realtime.ts` | Contract Socket.IO và LiveKit có type strict |
| `src/lib/realtimeEvents.ts` | Reducer thuần cho partial/final/token/done |
| `src/store/meetingStore.ts` | Meeting state, realtime session state và actions |
| `src/hooks/useDemoSimulation.ts` | Phát deterministic backend-shaped events |
| `src/i18n` | Typed English/Vietnamese UI copy |

Route đã triển khai:

| Route | Trạng thái |
|---|---|
| `/` | Landing |
| `/create` | Tạo room local và redirect sang setup |
| `/room/:roomId/setup` | Meeting/device setup dạng prototype |
| `/room/:roomId` | Live meeting với deterministic transcript |
| `/room/:roomId/summary` | Summary và export trong browser |
| `/setup`, `/meeting`, `/summary` | Compatibility redirects |

`/join` và `/room/:roomId/waiting` thuộc P0 trong
`frontend/REQUIREMENTS.md` nhưng chưa được triển khai. Tài liệu không được mô tả
hai route này là đã hoàn tất.

### 2.9 State và event invariants

- `stt.partial` replace source text của cùng `utteranceId`.
- `stt.final` chốt source và đưa turn sang draft/translation.
- `translate.token` append target text; token không có utterance trước đó bị bỏ
  qua.
- `translate.done` thay bằng bản source/translation cuối và chốt `endedAt`.
- Event đến trễ không được downgrade một turn đã final.
- `session.ready` chỉ chuyển session state sang `gateway-connected`.
- `error` giữ payload `{ code, message }` và đánh dấu active turn là failed.
- UI ưu tiên bản dịch theo ngôn ngữ người tham gia, nhưng vẫn giữ transcript gốc.
- Mock và production adapter phải dùng chung typed event reducer.

### 2.10 Trạng thái tích hợp và blocker

**Đã có ở frontend:**

- [x] Room-scoped URL và canonical room identity.
- [x] Stable browser `clientId`.
- [x] Typed realtime event schemas và deterministic reducer.
- [x] UI EN/VI, responsive layout, transcript draft/final/failed states.
- [x] Deterministic mock mode được ghi nhãn rõ, không giả là AI thật.

**Chưa bật production connection:**

- [ ] Cài `socket.io-client` và `livekit-client`.
- [ ] Socket.IO lifecycle adapter và retry/error UX.
- [ ] Shared microphone `MediaStream`, LiveKit publish và AudioWorklet PCM.
- [ ] LiveKit remote track lifecycle và cleanup.
- [ ] Production env/config validation.

**Backend contract cần xử lý trước khi bật:**

1. `session.ready` phải được phát sau khi AI WebSocket mở, hoặc bổ sung một
   event AI-ready riêng.
2. Audio cần tách theo participant/client. Hiện một AI WebSocket dùng chung cho
   cả room và `speaker.switch` là state cấp session, nên hai client có thể bị
   trộn audio và giẫm ngôn ngữ của nhau.
3. Transcript events cần `clientId`/`participantId`, sequence và timing để map
   đúng video tile, giữ thứ tự và xử lý reconnect.
4. Thêm `GET /health` vào implementation hoặc sửa contract/monitoring docs.
5. Credential LiveKit phải được rotate và chuyển khỏi file config được commit;
   frontend không bao giờ nhận secret.

Cho đến khi các mục trên được giải quyết, frontend giữ deterministic mode và
không thực hiện backend, LiveKit hay external AI calls.

---

## PHẦN 3 — CHO AI SERVICE DEVELOPER (FASTAPI)

### 3.1 Yêu cầu môi trường

- Python 3.10+
- FastAPI + uvicorn[standard] (dùng uvloop)
- GPU khuyến nghị (RTX 4060+ / A10 / L4) — tối thiểu 12GB VRAM
- Chạy PM2 hoặc systemd, listen `localhost:8000`

### 3.2 WebSocket endpoint bắt buộc

```
ws://localhost:8000/ws/session?sessionId=<uuid>
```

- NestJS mở **đúng 1 kết nối** per session (nhiều client cùng phòng chung 1 ws).
- FastAPI không cần biết có bao nhiêu client — chỉ xử lý 1 luồng audio, gửi 1 luồng event.
- FastAPI **không cần auth** — NestJS đã filter, chỉ NestJS gọi được (localhost).

### 3.3 Messages FastAPI NHẬN từ NestJS

#### Binary frame — audio chunks
- Format: **PCM Int16, 16kHz, mono, raw bytes** (không header, không metadata)
- Chunk size: ~6400 bytes = 200ms audio
- Frequency: ~5 chunks/giây khi user đang nói

#### Text frame — control JSON

```json
// Ngay sau khi accept connection
{ "type": "session.init", "config": { "domain": "business", "languagePair": "vi-en" } }

// Khi user đổi ngôn ngữ đang nói (để chọn model Whisper/PhoWhisper)
{ "type": "speaker.switch", "speaker": "vi" }
{ "type": "speaker.switch", "speaker": "en" }

// Trước khi NestJS đóng kết nối
{ "type": "session.close" }
```

### 3.4 Messages FastAPI PHẢI GỬI về NestJS (contract QUAN TRỌNG NHẤT)

Bắt buộc đúng chính xác `type` string (case-sensitive, dấu chấm `.`):

#### 3.4.1 `stt.partial` — text đang gõ dần (nhiều lần)

```json
{
  "type": "stt.partial",
  "text": "Xin chào chúng",
  "speaker": "vi",
  "utteranceId": "utt-abc123"
}
```

#### 3.4.2 `stt.final` — chốt câu nguồn (1 lần / utterance)

```json
{
  "type": "stt.final",
  "text": "Xin chào, chúng tôi đến từ Việt Nam.",
  "speaker": "vi",
  "utteranceId": "utt-abc123"
}
```

#### 3.4.3 `translate.token` — từng token dịch (nhiều lần)

```json
{
  "type": "translate.token",
  "token": " Vietnam",
  "utteranceId": "utt-abc123"
}
```

#### 3.4.4 `translate.done` — chốt bản dịch (1 lần / utterance) — ⚠️ ĐỦ 4 FIELD

```json
{
  "type": "translate.done",
  "fullText": "Hello, we are from Vietnam.",
  "sourceText": "Xin chào, chúng tôi đến từ Việt Nam.",
  "speaker": "vi",
  "utteranceId": "utt-abc123"
}
```

⚠️ **CẢNH BÁO CỰC KỲ QUAN TRỌNG:**
- `translate.done` PHẢI có đầy đủ `fullText`, `sourceText`, `speaker`, `utteranceId`.
- NestJS dùng `sourceText` + `speaker` để lưu utterance vào session store (phục vụ export DOCX sau này).
- Thiếu field → NestJS ghi `undefined`, **không có warning**, đến lúc export mới phát hiện.

#### 3.4.5 `error` — khi có lỗi

```json
{
  "type": "error",
  "code": "STT_FAILED",
  "message": "Whisper crashed on segment"
}
```

### 3.5 `utteranceId` — quy ước sinh id

- **FastAPI sinh id này**, không phải NestJS hay Client.
- Mỗi lần VAD phát hiện 1 câu mới = 1 id mới.
- Format tự do (UUID, counter, timestamp). Ví dụ: `f"utt-{uuid.uuid4().hex[:8]}"`.
- Trong cùng 1 utterance, các event `stt.partial` → `stt.final` → `translate.token` → `translate.done` **PHẢI CÙNG utteranceId**.

### 3.6 Pipeline architecture

3 task async chạy song song, thông nhau qua queue:

```
WebSocket receive loop
  ↓
audio_queue ─→ Task 1: VAD Loop (Silero VAD)
                  ↓ (khi speech end)
              stt_queue ─→ Task 2: STT Loop (Whisper/PhoWhisper)
                              ↓ emit stt.partial, stt.final
                          translate_queue ─→ Task 3: Translate Loop (SEA-LION)
                                                ↓ emit translate.token, translate.done
                                            WebSocket send
```

### 3.7 Skeleton code

```python
# main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import json
import uuid
import logging

logger = logging.getLogger(__name__)
app = FastAPI()

# Load models 1 lần khi startup
whisper_en = None
phowhisper_vi = None
llm = None
vad = None

@app.on_event("startup")
async def load_models():
    global whisper_en, phowhisper_vi, llm, vad
    logger.info("Loading models...")
    # whisper_en = load_whisper('large-v3')
    # phowhisper_vi = load_phowhisper()
    # llm = load_sea_lion()
    # vad = load_silero_vad()
    # warmup với dummy input
    logger.info("Models ready")


@app.get("/health")
async def health():
    return {"status": "ok", "models_loaded": all([whisper_en, llm, vad])}


@app.websocket("/ws/session")
async def session_endpoint(websocket: WebSocket, sessionId: str):
    await websocket.accept()
    logger.info(f"Session {sessionId} connected")

    pipeline = SessionPipeline(sessionId, websocket)
    await pipeline.start()

    try:
        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            # Binary = audio chunk
            if "bytes" in message and message["bytes"]:
                await pipeline.audio_queue.put(message["bytes"])

            # Text = JSON control
            elif "text" in message and message["text"]:
                try:
                    event = json.loads(message["text"])
                    await pipeline.handle_control(event)
                except json.JSONDecodeError as e:
                    logger.warning(f"Invalid JSON: {e}")

    except WebSocketDisconnect:
        logger.info(f"Session {sessionId} disconnected")
    except Exception as e:
        logger.error(f"Session {sessionId} error: {e}", exc_info=True)
    finally:
        await pipeline.cleanup()


class SessionPipeline:
    def __init__(self, session_id: str, websocket: WebSocket):
        self.session_id = session_id
        self.ws = websocket
        self.audio_queue: asyncio.Queue = asyncio.Queue()
        self.stt_queue: asyncio.Queue = asyncio.Queue()
        self.translate_queue: asyncio.Queue = asyncio.Queue()
        self.current_language = "vi"
        self.domain = "business"
        self.tasks = []

    async def start(self):
        self.tasks = [
            asyncio.create_task(self._vad_loop()),
            asyncio.create_task(self._stt_loop()),
            asyncio.create_task(self._translate_loop()),
        ]

    async def handle_control(self, event: dict):
        etype = event.get("type")
        if etype == "session.init":
            config = event.get("config", {})
            self.domain = config.get("domain", "business")
            language_pair = config.get("languagePair", "vi-en")
            self.current_language = language_pair.split("-")[0]

        elif etype == "speaker.switch":
            self.current_language = event.get("speaker", "vi")

        elif etype == "session.close":
            await self.cleanup()

    async def _vad_loop(self):
        """
        Silero VAD tích luỹ speech segment.
        Khi phát hiện end-of-speech, đẩy segment sang stt_queue.
        """
        import numpy as np
        speech_buffer = []

        try:
            while True:
                chunk_bytes = await self.audio_queue.get()

                # PCM Int16 bytes → numpy array
                pcm = np.frombuffer(chunk_bytes, dtype=np.int16)
                pcm_float = pcm.astype(np.float32) / 32768.0

                # VAD detect
                is_speech = vad.is_speech(pcm_float)

                if is_speech:
                    speech_buffer.append(pcm_float)
                elif speech_buffer:
                    # Speech ended → gộp segment, đẩy sang STT
                    segment = np.concatenate(speech_buffer)
                    speech_buffer.clear()
                    await self.stt_queue.put(segment)

        except asyncio.CancelledError:
            pass

    async def _stt_loop(self):
        """
        Nhận segment audio, chạy Whisper streaming.
        Emit stt.partial nhiều lần, stt.final 1 lần.
        """
        try:
            while True:
                segment = await self.stt_queue.get()
                utt_id = f"utt-{uuid.uuid4().hex[:8]}"

                # Chọn model theo ngôn ngữ hiện tại
                model = phowhisper_vi if self.current_language == "vi" else whisper_en

                # Streaming partial (giả sử model support)
                async for partial in self._transcribe_stream(model, segment):
                    await self.ws.send_json({
                        "type": "stt.partial",
                        "text": partial,
                        "speaker": self.current_language,
                        "utteranceId": utt_id,
                    })

                # Final
                final_text = await self._transcribe_final(model, segment)
                await self.ws.send_json({
                    "type": "stt.final",
                    "text": final_text,
                    "speaker": self.current_language,
                    "utteranceId": utt_id,
                })

                # Đẩy sang translate
                await self.translate_queue.put({
                    "text": final_text,
                    "utt_id": utt_id,
                    "speaker": self.current_language,
                })

        except asyncio.CancelledError:
            pass

    async def _translate_loop(self):
        """
        Nhận text, gọi LLM streaming, emit translate.token + translate.done.
        """
        try:
            while True:
                req = await self.translate_queue.get()

                source_text = req["text"]
                source_lang = req["speaker"]
                target_lang = "en" if source_lang == "vi" else "vi"
                utt_id = req["utt_id"]

                # Build prompt (có thể inject glossary ở đây)
                prompt = self._build_prompt(source_text, source_lang, target_lang)

                # Stream tokens
                full_text = ""
                async for token in self._llm_stream(prompt):
                    full_text += token
                    await self.ws.send_json({
                        "type": "translate.token",
                        "token": token,
                        "utteranceId": utt_id,
                    })

                # ⚠️ CHỐT VỚI ĐỦ 4 FIELD
                await self.ws.send_json({
                    "type": "translate.done",
                    "fullText": full_text,
                    "sourceText": source_text,
                    "speaker": source_lang,
                    "utteranceId": utt_id,
                })

        except asyncio.CancelledError:
            pass

    async def _transcribe_stream(self, model, segment):
        # Implement: streaming Whisper
        # Yield từng partial text
        ...

    async def _transcribe_final(self, model, segment) -> str:
        # Implement: final transcription
        ...

    async def _llm_stream(self, prompt: str):
        # Implement: vLLM streaming
        # Yield từng token
        ...

    def _build_prompt(self, text: str, src: str, tgt: str) -> str:
        return f"Translate from {src} to {tgt}: {text}"

    async def cleanup(self):
        for t in self.tasks:
            t.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
```

### 3.8 Model recommendations

| Component | Model | VRAM | Note |
|-----------|-------|------|------|
| VAD | Silero VAD | ~50MB (CPU) | `torch.hub.load('snakers4/silero-vad')` |
| STT tiếng Việt | PhoWhisper-large | ~3GB fp16 | HuggingFace `vinai/PhoWhisper-large` |
| STT tiếng Anh | Whisper large-v3 (Faster-Whisper) | ~3GB | `faster-whisper` package, CTranslate2 optimized |
| Translation | Gemma-SEA-LION-v3-9B-IT | ~18GB fp16 / ~9GB int8 | AISG's own model |
| LLM serving | vLLM 0.6+ | — | Continuous batching + streaming |

**Nếu VRAM < 12GB, fallback:**
- STT: dùng Whisper large-v3 cho cả 2 ngôn ngữ (bỏ PhoWhisper)
- Translation: Qwen2.5-7B-Instruct (~14GB fp16 / ~7GB int8)

### 3.9 Test với mock NestJS (không cần chạy backend thật)

```python
# test_client.py
import asyncio
import websockets
import json

async def test():
    async with websockets.connect(
        "ws://localhost:8000/ws/session?sessionId=test-session"
    ) as ws:
        # Init
        await ws.send(json.dumps({
            "type": "session.init",
            "config": {"domain": "business", "languagePair": "vi-en"}
        }))

        # Gửi 1 file wav test
        with open("test.wav", "rb") as f:
            audio_data = f.read()

        # Chia thành chunks 200ms (6400 bytes)
        for i in range(0, len(audio_data), 6400):
            await ws.send(audio_data[i:i+6400])
            await asyncio.sleep(0.2)

        # Nhận events
        async for msg in ws:
            print(json.loads(msg))

asyncio.run(test())
```

### 3.10 Checklist AI Service

- [ ] Setup FastAPI + uvicorn, listen `0.0.0.0:8000`
- [ ] Load models khi startup, warmup với dummy input
- [ ] `GET /health` trả về status models
- [ ] `WS /ws/session?sessionId=X` accept connection
- [ ] Handle `session.init`, `speaker.switch`, `session.close`
- [ ] 3 background tasks: VAD → STT → Translate
- [ ] Emit 4 event types với đúng field names
- [ ] `translate.done` ĐỦ 4 field: `fullText`, `sourceText`, `speaker`, `utteranceId`
- [ ] `utteranceId` sinh unique mỗi câu, dùng xuyên suốt 4 event
- [ ] Cleanup pipeline khi WS disconnect (cancel tasks, free memory)
- [ ] Chạy bằng PM2: `pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name fastapi`

---

## PHẦN 4 — TIMELINE FLOW TỔNG THỂ

### 4.1 Sequence diagram meeting 2 người

```
Client A (VN)    Client B (EN)    NestJS      LiveKit      FastAPI
    │                │              │            │            │
    │  [Setup]                                                 │
    │─POST /livekit/token────────────▶            │            │
    │◀──{token, url}────────────────  │            │           │
    │─room.connect(url, token)──────────────────▶  │           │
    │─socket.io(/audio)───────────────▶            │           │
    │                              openSession()──────────────▶│
    │◀──'session.ready'──────────────  │  [gateway ack only]   │
    │                              ◀── AI WebSocket open ─────│
    │◀──'ai.ready' (contract cần bổ sung)                      │
    │                                                          │
    │                  [B join tương tự]                       │
    │                │                │                        │
    │                │─POST /livekit/token▶                    │
    │                │◀──{token,url}──                         │
    │                │─room.connect─────▶ (LiveKit)            │
    │                │─socket.io───────▶                       │
    │                │◀──'session.ready' [gateway ack only]    │
    │                │◀──'ai.ready' (contract cần bổ sung)     │
    │                │                                         │
    │                │ [Video call auto: A và B thấy nhau qua  │
    │                │  LiveKit — không đụng NestJS]           │
    │                │                                         │
    │  [A nói]                                                 │
    │─emit 'audio.chunk' (PCM 6400 bytes)─▶                    │
    │                              forwardAudio───────────────▶│
    │                                              VAD detect...│
    │                                              STT running...│
    │                              ◀──stt.partial───────────── │
    │◀──'stt.partial'───────────── │                           │
    │                │◀──'stt.partial'──                       │
    │                              ◀──stt.final────────────── │
    │◀──'stt.final'─────────────── │                           │
    │                │◀──'stt.final'───                        │
    │                                              LLM stream...│
    │                              ◀──translate.token────────  │
    │◀──'translate.token'────────  │                           │
    │                │◀──'translate.token'                     │
    │                              ◀──translate.done─────────  │
    │◀──'translate.done'─────────  │  save utterance to store  │
    │                │◀──'translate.done'                      │
    │                                                          │
    │                │ [B nói tương tự, A thấy dịch sang VN]   │
    │                                                          │
    │  [A end meeting]                                         │
    │─emit 'session.end'─────────▶                             │
    │◀──'session.ended' (broadcast) ─                          │
    │                │◀──'session.ended'                       │
    │                              closeSession()─────────────▶│
    │─socket.disconnect                                        │
    │─room.disconnect───────────────────────────▶              │
```

### 4.2 Latency budget (target)

| Stage | Target |
|-------|--------|
| Client mic → NestJS (Socket.IO) | 30-80ms |
| NestJS forward → FastAPI (localhost) | 1-3ms |
| VAD detect end-of-speech | 300-500ms |
| STT streaming partial | 200-500ms |
| SEA-LION first token | 300-500ms |
| SEA-LION full translation | 500-1000ms |
| FastAPI → NestJS → Client broadcast | 30-80ms |
| **Perceived (partial visible)** | **~600-900ms** |
| **Complete (translation done)** | **~1.2-1.8s** |

---

## PHẦN 5 — TRẠNG THÁI NESTJS ĐÃ XÁC MINH

Đối chiếu với `realtime-service/src`:

1. **Đã có:** `session.end` broadcast `session.ended` và gọi
   `closeSession(sessionId)`.
2. **Đã có:** namespace Socket.IO `/audio`, websocket-only, cùng các handler
   `audio.chunk`, `speaker.switch` và `session.end`.
3. **Đã có:** `POST /livekit/token` nhận `roomName`, `participantName` và trả
   `{ token, url }`.
4. **Chưa có:** `GET /health`; root controller hiện chỉ trả `Hello World!`.
5. **Cần sửa trước tích hợp:** readiness, participant-scoped audio và transcript
   identity như mục 2.10.

Source code hiện tại là wire behavior thực tế. Khi implementation và tài liệu
khác nhau, không được giả định phần được mô tả nhưng chưa có code là đã deploy.

---

## PHẦN 6 — DEPLOY & OPS

### 6.1 Subdomain (bạn tự setup nginx)

| Subdomain | Target | Protocol |
|-----------|--------|----------|
| `api-hackathon.dangpham.id.vn` | `127.0.0.1:3001` | HTTPS + WSS |
| `livekit-hackathon.dangpham.id.vn` | `127.0.0.1:7880` | HTTPS + WSS |

Frontend Vite có thể deploy như static app trên hạ tầng do team chọn. Host phải
rewrite mọi route `/room/*` về `index.html`; domain production chưa được chốt
trong repository.

### 6.2 Firewall

```bash
sudo ufw allow 50000:50100/udp   # LiveKit media
sudo ufw allow 7881/tcp          # LiveKit TCP fallback
```

### 6.3 PM2 processes

```bash
pm2 start dist/main.js --name nestjs
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name fastapi
pm2 save
pm2 startup
```

### 6.4 LiveKit Docker

```bash
docker compose up -d livekit
```

### 6.5 Env `.env` cho NestJS

```
PORT=3001
AI_WS_URL=ws://localhost:8000/ws/session
LIVEKIT_API_KEY=<khớp livekit.yaml>
LIVEKIT_API_SECRET=<khớp livekit.yaml>
LIVEKIT_URL=wss://livekit-hackathon.dangpham.id.vn
```

---

## PHẦN 7 — TROUBLESHOOTING

| Triệu chứng | Nguyên nhân | Fix |
|-------------|-------------|-----|
| Client connect Socket.IO bị disconnect ngay | Thiếu `sessionId` hoặc `clientId` trong query | Check query string |
| Client emit audio nhưng không có transcript | `session.ready` đến trước khi AI bridge mở nên chunk có thể bị drop | Bổ sung/đợi AI-ready thật sự |
| `translate.done` xong nhưng export DOCX rỗng | FastAPI thiếu `sourceText` hoặc `speaker` field | Check FastAPI event schema |
| LiveKit connect fail "invalid token" | Key/secret `.env` không khớp `livekit.yaml` | Verify 2 file khớp chính xác |
| Video call kết nối nhưng không thấy hình | Firewall chặn UDP 50000-50100 | Mở UFW |
| WSS "Mixed Content" error trên frontend HTTPS | LIVEKIT_URL đang là `ws://` | Đổi sang `wss://` |
| FastAPI crash khi nhận audio | PCM format sai (không phải Int16 16kHz mono) | Client check AudioWorklet convert đúng |
| Utterance transcript loạn thứ tự | Nhiều `utteranceId` bị trùng | FastAPI sinh unique id mỗi câu |

---

Tài liệu này mô tả intended contract; source của từng service mô tả wire
behavior hiện tại. Nếu thay đổi contract event, cập nhật cả tài liệu, shared
types và implementation trong cùng thay đổi.
