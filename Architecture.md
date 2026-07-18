# ViEnMeet — Integration Guide

> Tài liệu contract giữa 3 hệ thống. Trạng thái implementation NestJS được xác
> minh từ source `realtime-service/src`.
>
> - **Frontend (React + Vite)**: đọc **Phần 2**
> - **AI Service (FastAPI)**: đọc **Phần 3** — quan trọng nhất, có nhiều thay
>   đổi so với draft trước.
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
   │  - GET /sessions/:id │        │                      │
   └──────────┬───────────┘        └──────────────────────┘
              │                               ▲
              │ N raw ws pipelines            │ (client connect trực tiếp
              │ (1 per client, internal)      │  bằng JWT NestJS cấp)
              ▼
   ┌──────────────────────┐
   │  FastAPI AI Worker   │
   │  (localhost:8000)    │
   │  - VAD + STT + LLM   │
   │  - N concurrent WS   │
   └──────────────────────┘
```

**Điểm quan trọng nhất về NestJS ↔ FastAPI:** NestJS mở **1 WebSocket riêng cho
mỗi client**, không phải 1 WebSocket chung cho cả session. Trong meeting có 3
người, FastAPI nhận **3 kết nối đồng thời** với cùng `sessionId` nhưng khác
`clientId`. Chi tiết ở Phần 3.

### 1.2 Nhiệm vụ mỗi hệ thống

| Hệ thống | Nhiệm vụ | Trạng thái |
|----------|----------|------------|
| **Client** (React + Vite) | UI, capture audio, hiển thị transcript, video call | Vertical slice + demo mode, chưa bật production connection |
| **NestJS** | Auth LiveKit, session state, forward audio per client, inject clientId vào events, broadcast tới room | ✅ Ready, xem Phần 5 |
| **FastAPI** | VAD + Speech-to-Text + Translation, xử lý N kết nối đồng thời cho cùng session | ⏳ Chờ AI team |
| **LiveKit Server** | Video call SFU | ✅ Deploy Docker |

### 1.3 Backend NestJS đang expose gì

| Endpoint | Method | Purpose | Ai gọi |
|----------|--------|---------|--------|
| `/audio` (Socket.IO namespace) | WSS | Realtime transcript pipeline | Client |
| `/livekit/token` | POST | Sinh JWT để join room LiveKit | Client |
| `/sessions/:sessionId` | GET | Public snapshot session (participants, status) | Client (optional, poll) |
| `/health` | GET | Health check monitoring | Ops |
| `ws://localhost:8000/ws/session?sessionId=...&clientId=...` | — | Bridge sang FastAPI (1 kết nối per client) | NestJS gọi FastAPI |

**Base URL production:** `https://api-hackathon.dangpham.id.vn`

---

## PHẦN 2 — CHO FRONTEND DEVELOPER

### 2.1 Cài dependencies

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
Bước 4: Nhận 'session.ready' → gateway + AI worker đều đã sẵn sàng
Bước 5: User bật mic → capture audio 16kHz PCM → emit 'audio.chunk'
Bước 6: Chuẩn hóa events transcript và cập nhật store bằng utteranceId
```

**Về `session.ready`:** backend chỉ emit event này **sau khi** WebSocket sang
FastAPI đã OPEN thành công. Nhận được event = cả gateway VÀ AI worker sẵn sàng.
Frontend có thể bắt đầu gửi `audio.chunk` an toàn ngay sau `session.ready`.

Nếu AI worker unreachable trong 5s, backend emit `error` với
`code: 'AI_UNAVAILABLE'` rồi disconnect socket. Frontend cần handle case này để
cho user retry hoặc báo "AI service đang bảo trì".

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
- Khi gọi LiveKit token, `participantName === clientId` để map video ↔ transcript.
- Transcript events có sẵn `clientId` từ backend — dùng để identify speaker.

### 2.4 Transcript integration (Socket.IO)

#### 2.4.1 Kết nối

```typescript
import { io, type Socket } from 'socket.io-client';

const socket: Socket = io(`${import.meta.env.VITE_API_URL}/audio`, {
  query: {
    sessionId,
    clientId,
    domain: 'business',           // optional, default 'business'
    languagePair: 'vi-en',        // optional, default 'vi-en'
    displayName: 'Nguyễn Văn A',  // optional, default = clientId
    localLanguage: 'vi',          // optional, 'vi' | 'en'
    title: 'Meeting Q4 review',   // optional, hiển thị cho participants khác
  },
  transports: ['websocket'],      // BẮT BUỘC — không dùng polling
});
```

⚠️ Nếu thiếu `sessionId` hoặc `clientId` → server emit `error` với code
`INVALID_CONNECTION` rồi disconnect.

⚠️ Nếu session đã ended → server emit `session.ended` rồi disconnect.

Query string bị giới hạn độ dài (mỗi field tối đa 128 chars, `title` 160,
`displayName` 80) để chống abuse.

#### 2.4.2 Events bạn PHẢI emit

| Event | Payload | Khi nào gửi |
|-------|---------|-------------|
| `audio.chunk` | `ArrayBuffer` (PCM Int16, 16kHz, mono) | Liên tục ~200ms/chunk khi đang ghi âm |
| `speaker.switch` | `{ speaker: 'vi' \| 'en' }` | Khi user đổi ngôn ngữ đang nói |
| `session.end` | (không payload) | Khi user bấm "Kết thúc meeting" |

**Về `audio.chunk`:**

- Chỉ được emit **sau khi** đã nhận `session.ready`. Emit sớm hơn thì backend
  không có pipeline nào để forward vào.
- Sai format (không phải ArrayBuffer / Buffer / TypedArray) → server emit
  `error` với `code: 'INVALID_AUDIO_CHUNK'`.
- Chunk audio của client nào thì gửi qua pipeline của client đó — backend biết
  chính xác ai là chủ chunk (không cần client tự khai).

**Về `speaker.switch`:**

- Là state **per-client**, không phải per-session. Client A switch sang 'en'
  không ảnh hưởng client B.
- Backend forward xuống pipeline FastAPI của client đó để chọn model
  (PhoWhisper cho `vi`, Whisper large-v3 cho `en`).

**Về `session.end`:**

- **Bất kỳ client nào** cũng có thể emit — kết thúc session cho cả room.
- Sau khi nhận, backend broadcast `session.ended`, đóng tất cả AI pipelines,
  disconnect tất cả sockets.

#### 2.4.3 Events bạn PHẢI listen

| Event | Payload | Xử lý UI |
|-------|---------|----------|
| `session.ready` | `{ clientId, sessionId }` | Gateway + AI ready. Enable mic. |
| `session.participants` | `{ participants: [{ clientId, displayName, language }] }` | Cập nhật danh sách participants trong UI |
| `stt.partial` | `{ text, speaker, clientId, displayName?, utteranceId }` | Hiện text nhạt màu, cùng `utteranceId` thì **replace** |
| `stt.final` | `{ text, speaker, clientId, displayName?, utteranceId }` | Chốt câu nguồn, tạo entry mới trong danh sách utterance |
| `translate.token` | `{ token, clientId, displayName?, utteranceId }` | Append token vào cột đích (streaming) |
| `translate.done` | `{ fullText, sourceText, speaker, clientId, displayName?, utteranceId }` | Chốt câu dịch, animation highlight |
| `session.ended` | `{ sessionId }` | Disable mic, hiện nút "Export" (nếu có) |
| `error` | `{ code, message, clientId? }` | Toast đỏ. Code xem bảng dưới. |

**Error codes có thể gặp:**

| Code | Nghĩa |
|------|-------|
| `INVALID_CONNECTION` | Thiếu sessionId/clientId trong query — sẽ disconnect ngay |
| `AI_UNAVAILABLE` | FastAPI worker không phản hồi trong 5s — sẽ disconnect |
| `AI_CONN_ERROR` | Kết nối AI worker bị lỗi sau khi đã mở |
| `AI_CONN_CLOSED` | AI worker đóng kết nối bất thường |
| `INVALID_AUDIO_CHUNK` | Client emit `audio.chunk` với data không phải binary |
| `STT_FAILED` | FastAPI báo lỗi trong quá trình transcribe |

**Về field `clientId` trong transcript events:**

Backend inject `clientId` vào **mọi** transcript event trước khi broadcast tới
room. `clientId` này chính là chủ của utterance — trùng với `participant.identity`
của LiveKit. Frontend dùng để overlay transcript lên đúng video tile.

**Về field `displayName`:** optional. Nếu client có gửi `displayName` trong query
lúc connect, backend echo lại trong mọi event của client đó. FE có thể fallback
về `clientId` khi thiếu.

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
`roomId`, `sequenceNumber` (derive ở FE), `clientId` (identity người nói),
`displayName`, source/target language, `startedAt`, `endedAt`, original/translated
text và status. Event có cùng `utteranceId` cập nhật đúng turn; không tự tạo turn
từ một orphan `translate.token`.

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
  roomName: sessionId,           // BẮT BUỘC trùng với sessionId Socket.IO
  participantName: clientId,     // BẮT BUỘC trùng với clientId Socket.IO
  displayName: 'Nguyễn Văn A',   // optional
  language: 'vi',                // optional, 'vi' | 'en'
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

Backend chấp nhận `roomName` và `participantName` với format tự do (không rỗng,
không quá 128 chars). Token có TTL 10 phút — đủ cho client join, sau đó LiveKit
tự maintain session.

#### 2.5.2 Connect vào room

```typescript
import { Room, RoomEvent, Track } from 'livekit-client';

const room = new Room();
await room.connect(url, token);
await room.localParticipant.enableCameraAndMicrophone();
```

#### 2.5.3 Handle events

```typescript
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  const container = document.getElementById(`video-${participant.identity}`);
  if (!container) return;

  if (track.kind === Track.Kind.Video) {
    const el = track.attach();
    container.appendChild(el);
  } else if (track.kind === Track.Kind.Audio) {
    track.attach();
  }
});

room.on(RoomEvent.ParticipantDisconnected, (participant) => {
  document.getElementById(`video-${participant.identity}`)?.replaceChildren();
});

room.on(RoomEvent.ParticipantConnected, (participant) => {
  console.log('New participant:', participant.identity);
});

room.on(RoomEvent.TrackUnsubscribed, (track) => {
  track.detach().forEach((el) => el.remove());
});
```

#### 2.5.4 Mapping video ↔ transcript

Backend gắn `clientId` vào **mọi** transcript event, trùng với
`participant.identity` của LiveKit. Frontend map trực tiếp:

```typescript
socket.on('translate.done', ({ fullText, sourceText, clientId, utteranceId }) => {
  if (!clientId) return;

  // Lấy participant từ LiveKit theo identity
  const isLocal = room.localParticipant.identity === clientId;
  const participant = isLocal
    ? room.localParticipant
    : room.remoteParticipants.get(clientId);

  // Overlay transcript lên đúng video tile
  const tile = document.getElementById(`video-${clientId}`);
  if (tile) {
    showOverlay(tile, { sourceText, fullText });
  }
});
```

Không có race condition trộn speaker: NestJS mở 1 pipeline WebSocket riêng cho
mỗi client, event từ pipeline nào thì mang `clientId` của client đó — luôn đúng
chủ sở hữu utterance, kể cả khi nhiều người nói đồng thời.

### 2.6 Kết thúc phiên

```typescript
async function endMeeting() {
  socket.emit('session.end');
  await room.disconnect();
  socket.disconnect();
}
```

Sau khi 1 client emit `session.end`, tất cả clients trong room nhận
`session.ended`, sockets bị force disconnect, tất cả AI pipelines được đóng.
Session đó không thể connect lại (endedAt đã được set).

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
- `session.ready` đảm bảo cả gateway VÀ AI worker đều sẵn sàng — có thể bắt đầu
  ghi âm ngay.
- Mỗi transcript event có `clientId` — dùng để match với LiveKit participant.
- `error` giữ payload `{ code, message, clientId? }` và đánh dấu active turn là failed.
- UI ưu tiên bản dịch theo ngôn ngữ người tham gia, nhưng vẫn giữ transcript gốc.
- Mock và production adapter phải dùng chung typed event reducer.

### 2.10 Trạng thái tích hợp

**Đã có ở frontend:**

- [x] Room-scoped URL và canonical room identity.
- [x] Stable browser `clientId`.
- [x] Typed realtime event schemas và deterministic reducer.
- [x] UI EN/VI, responsive layout, transcript draft/final/failed states.
- [x] Deterministic mock mode được ghi nhãn rõ, không giả là AI thật.

**Backend contract đã sẵn sàng cho tích hợp:**

- [x] `session.ready` chỉ emit sau khi AI worker OPEN thật sự (không còn race).
- [x] Audio pipeline **tách riêng per client** — mỗi client có WebSocket riêng
      sang FastAPI, không còn nguy cơ trộn audio hay giẫm `speaker.switch` giữa
      các client.
- [x] Transcript events có `clientId` (bắt buộc) và `displayName` (optional).
- [x] `GET /health` đã implement.
- [x] `GET /sessions/:sessionId` cho public snapshot participants.

**Chưa bật production connection (todo frontend):**

- [ ] Cài `socket.io-client` và `livekit-client`.
- [ ] Socket.IO lifecycle adapter và retry/error UX.
- [ ] Shared microphone `MediaStream`, LiveKit publish và AudioWorklet PCM
      (resample thật sự về 16 kHz).
- [ ] LiveKit remote track lifecycle và cleanup.
- [ ] Production env/config validation.

**Còn lại (không blocker cho MVP hackathon):**

- Rotate LiveKit credentials trước production public. Hiện credentials đọc từ
  env, không hard-code trong config, nhưng cặp key/secret hackathon đã lộ trong
  cuộc trao đổi — cần đổi cặp mới trước khi go public.
- Sequence number / timing per event ở backend cho reconnect edge cases —
  frontend đang tự derive, chấp nhận cho MVP.

---

## PHẦN 3 — CHO AI SERVICE DEVELOPER (FASTAPI)

**Đây là phần thay đổi nhiều nhất so với draft trước.** Đọc kỹ mục 3.2 về
kiến trúc multi-connection.

### 3.1 Yêu cầu môi trường

- Python 3.10+
- FastAPI + uvicorn[standard] (dùng uvloop)
- GPU khuyến nghị (RTX 4060+ / A10 / L4) — tối thiểu 12GB VRAM
- Chạy PM2 hoặc systemd, listen `localhost:8000`

### 3.2 Kiến trúc kết nối — QUAN TRỌNG NHẤT

**NestJS mở 1 WebSocket riêng cho MỖI client**, không phải 1 kết nối chung
cho cả room. Đây là điểm khác biệt lớn nhất so với các draft cũ và ảnh hưởng
đến toàn bộ cách bạn thiết kế FastAPI.

```
Meeting có 3 người:
  Client A ──┐
  Client B ──┼─▶ NestJS ──┬─▶ FastAPI WS #1 (sessionId=abc, clientId=A)
  Client C ──┘            ├─▶ FastAPI WS #2 (sessionId=abc, clientId=B)
                          └─▶ FastAPI WS #3 (sessionId=abc, clientId=C)
```

FastAPI phải xử lý **N kết nối đồng thời** với cùng `sessionId` (khác `clientId`).

**Vì sao thiết kế này:**
- Audio của client nào đi qua pipeline của client đó → không trộn audio.
- `speaker.switch` là state per-client → không giẫm ngôn ngữ của người khác.
- FastAPI biết chính xác chunk nào từ client nào — không cần đoán.

**Hệ quả bắt buộc với FastAPI:**

1. **Models phải là global**, load 1 lần khi startup, share across tất cả
   connections. **KHÔNG được load model per connection** — sẽ OOM ngay client
   thứ 2 vì SEA-LION 9B chiếm ~18GB VRAM.
2. `SessionPipeline` chỉ giữ **state per connection**: audio_queue, stt_queue,
   translate_queue, current_language, VAD buffer. Model là reference chung.
3. Dùng **vLLM continuous batching** để 1 model instance serve nhiều concurrent
   requests hiệu quả.
4. Whisper/PhoWhisper cần thread-safe hoặc lock nếu inference blocking — an toàn
   nhất là dùng `faster-whisper` (CTranslate2) hỗ trợ concurrent inference.

### 3.3 WebSocket endpoint bắt buộc

```
ws://localhost:8000/ws/session?sessionId=<uuid>&clientId=<uuid>
```

- `sessionId` và `clientId` đều bắt buộc trong query.
- FastAPI **không cần auth** — chỉ NestJS gọi được (localhost internal).
- Có thể có nhiều connection đồng thời với cùng `sessionId`, khác `clientId`.
- FastAPI **không cần biết** có bao nhiêu client trong 1 session — chỉ xử lý
  luồng riêng của mỗi connection.

### 3.4 Messages FastAPI NHẬN từ NestJS

#### Binary frame — audio chunks

- Format: **PCM Int16, 16kHz, mono, raw bytes** (không header, không metadata)
- Chunk size: ~6400 bytes = 200ms audio
- Frequency: ~5 chunks/giây khi client đang nói
- Mỗi connection có luồng audio riêng của 1 client → không cần lọc/tách.

#### Text frame — control JSON

```json
// Ngay sau khi accept connection
{ "type": "session.init", "config": { "domain": "business", "languagePair": "vi-en" } }

// Khi client đổi ngôn ngữ đang nói (per-client, không ảnh hưởng client khác)
{ "type": "speaker.switch", "speaker": "vi" }
{ "type": "speaker.switch", "speaker": "en" }

// Trước khi NestJS đóng kết nối của client này
{ "type": "session.close" }
```

### 3.5 Messages FastAPI PHẢI GỬI về NestJS (contract QUAN TRỌNG NHẤT)

Bắt buộc đúng chính xác `type` string (case-sensitive, dấu chấm `.`):

ℹ️ **FastAPI KHÔNG cần gửi `clientId`.** NestJS biết `clientId` từ pipeline
context (mỗi WS connection ứng với 1 client cụ thể) và tự inject vào event
trước khi broadcast tới frontend. FastAPI chỉ cần trả đúng 4 field như spec.

#### 3.5.1 `stt.partial` — text đang gõ dần (nhiều lần)

```json
{
  "type": "stt.partial",
  "text": "Xin chào chúng",
  "speaker": "vi",
  "utteranceId": "utt-abc123"
}
```

#### 3.5.2 `stt.final` — chốt câu nguồn (1 lần / utterance)

```json
{
  "type": "stt.final",
  "text": "Xin chào, chúng tôi đến từ Việt Nam.",
  "speaker": "vi",
  "utteranceId": "utt-abc123"
}
```

#### 3.5.3 `translate.token` — từng token dịch (nhiều lần)

```json
{
  "type": "translate.token",
  "token": " Vietnam",
  "utteranceId": "utt-abc123"
}
```

#### 3.5.4 `translate.done` — chốt bản dịch (1 lần / utterance) — ⚠️ ĐỦ 4 FIELD

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

#### 3.5.5 `error` — khi có lỗi

```json
{
  "type": "error",
  "code": "STT_FAILED",
  "message": "Whisper crashed on segment"
}
```

Error events được forward tới client với `code` này. Nếu muốn cho user thấy
thông báo cụ thể, dùng codes chuẩn hoặc bàn thêm với FE team.

### 3.6 `utteranceId` — quy ước sinh id

- **FastAPI sinh id này**, không phải NestJS hay Client.
- Mỗi lần VAD của 1 connection phát hiện 1 câu mới = 1 id mới.
- `utteranceId` **phải unique globally**, không chỉ trong 1 connection. Vì
  NestJS lưu utterances vào cùng session store dùng chung — nếu 2 clients cùng
  sinh `utt-1` sẽ ghi đè nhau.
- Format khuyến nghị: `f"utt-{uuid.uuid4().hex[:12]}"` — 12 hex chars đủ chống
  collision.
- Trong cùng 1 utterance, các event `stt.partial` → `stt.final` →
  `translate.token` → `translate.done` **PHẢI CÙNG utteranceId**.

### 3.7 Pipeline architecture per connection

3 task async chạy song song trong 1 connection, thông nhau qua queue:

```
WebSocket receive loop (per connection)
  ↓
audio_queue ─→ Task 1: VAD Loop (dùng model VAD global)
                  ↓ (khi speech end)
              stt_queue ─→ Task 2: STT Loop (dùng model STT global)
                              ↓ emit stt.partial, stt.final
                          translate_queue ─→ Task 3: Translate Loop (dùng vLLM global)
                                                ↓ emit translate.token, translate.done
                                            WebSocket send
```

Mỗi connection có **3 task riêng + 3 queue riêng + VAD buffer riêng**. Nhưng
**models là shared**.

### 3.8 Skeleton code (đã cập nhật cho multi-client)

```python
# main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from contextlib import asynccontextmanager
import asyncio
import json
import uuid
import logging

logger = logging.getLogger(__name__)

# ============================================================
# GLOBAL MODELS — load 1 lần, share across all connections
# ============================================================
class Models:
    whisper_en = None
    phowhisper_vi = None
    llm = None
    vad = None
    ready = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading models (once, shared across all connections)...")
    # Models.whisper_en = load_whisper('large-v3')
    # Models.phowhisper_vi = load_phowhisper()
    # Models.llm = load_sea_lion_with_vllm()   # continuous batching
    # Models.vad = load_silero_vad()
    # warmup với dummy input để tránh cold start ở request đầu
    Models.ready = True
    logger.info("Models ready")
    yield
    # cleanup on shutdown nếu cần


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {
        "status": "ok" if Models.ready else "loading",
        "models_loaded": Models.ready,
    }


@app.websocket("/ws/session")
async def session_endpoint(
    websocket: WebSocket,
    sessionId: str,
    clientId: str,   # BẮT BUỘC: NestJS luôn gửi clientId trong query
):
    if not Models.ready:
        await websocket.close(code=1013, reason="Models still loading")
        return

    await websocket.accept()
    logger.info(f"Session {sessionId}/{clientId} connected")

    pipeline = SessionPipeline(sessionId, clientId, websocket)
    await pipeline.start()

    try:
        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            if "bytes" in message and message["bytes"]:
                await pipeline.audio_queue.put(message["bytes"])

            elif "text" in message and message["text"]:
                try:
                    event = json.loads(message["text"])
                    await pipeline.handle_control(event)
                except json.JSONDecodeError as e:
                    logger.warning(f"Invalid JSON: {e}")

    except WebSocketDisconnect:
        logger.info(f"Session {sessionId}/{clientId} disconnected")
    except Exception as e:
        logger.error(f"Session {sessionId}/{clientId} error: {e}", exc_info=True)
    finally:
        await pipeline.cleanup()


class SessionPipeline:
    """
    Per-connection state. Multiple instances có thể tồn tại đồng thời cho cùng
    sessionId (khác clientId). Models là global, chỉ queues và buffer là riêng.
    """

    def __init__(self, session_id: str, client_id: str, websocket: WebSocket):
        self.session_id = session_id
        self.client_id = client_id
        self.ws = websocket
        self.audio_queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.stt_queue: asyncio.Queue = asyncio.Queue(maxsize=20)
        self.translate_queue: asyncio.Queue = asyncio.Queue(maxsize=20)
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
            speaker = event.get("speaker")
            if speaker in ("vi", "en"):
                self.current_language = speaker
                logger.info(
                    f"{self.session_id}/{self.client_id}: language switched to {speaker}"
                )

        elif etype == "session.close":
            await self.cleanup()

    async def _vad_loop(self):
        """
        Silero VAD tích luỹ speech segment. Dùng model global.
        """
        import numpy as np
        speech_buffer = []

        try:
            while True:
                chunk_bytes = await self.audio_queue.get()
                pcm = np.frombuffer(chunk_bytes, dtype=np.int16)
                pcm_float = pcm.astype(np.float32) / 32768.0

                is_speech = Models.vad.is_speech(pcm_float)

                if is_speech:
                    speech_buffer.append(pcm_float)
                elif speech_buffer:
                    segment = np.concatenate(speech_buffer)
                    speech_buffer.clear()
                    await self.stt_queue.put(segment)

        except asyncio.CancelledError:
            pass

    async def _stt_loop(self):
        """
        Nhận segment, chạy STT với model global. Sinh utteranceId unique.
        """
        try:
            while True:
                segment = await self.stt_queue.get()
                # Unique globally, không chỉ trong connection này
                utt_id = f"utt-{uuid.uuid4().hex[:12]}"

                model = (
                    Models.phowhisper_vi
                    if self.current_language == "vi"
                    else Models.whisper_en
                )

                async for partial in self._transcribe_stream(model, segment):
                    await self.ws.send_json({
                        "type": "stt.partial",
                        "text": partial,
                        "speaker": self.current_language,
                        "utteranceId": utt_id,
                    })

                final_text = await self._transcribe_final(model, segment)
                await self.ws.send_json({
                    "type": "stt.final",
                    "text": final_text,
                    "speaker": self.current_language,
                    "utteranceId": utt_id,
                })

                await self.translate_queue.put({
                    "text": final_text,
                    "utt_id": utt_id,
                    "speaker": self.current_language,
                })

        except asyncio.CancelledError:
            pass

    async def _translate_loop(self):
        """
        Dùng vLLM continuous batching → nhiều concurrent requests hiệu quả.
        """
        try:
            while True:
                req = await self.translate_queue.get()

                source_text = req["text"]
                source_lang = req["speaker"]
                target_lang = "en" if source_lang == "vi" else "vi"
                utt_id = req["utt_id"]

                prompt = self._build_prompt(source_text, source_lang, target_lang)

                full_text = ""
                async for token in self._llm_stream(prompt):
                    full_text += token
                    await self.ws.send_json({
                        "type": "translate.token",
                        "token": token,
                        "utteranceId": utt_id,
                    })

                # ⚠️ ĐỦ 4 FIELD
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
        # Implement: streaming Whisper. Model đã shared, có thể có lock nếu cần.
        ...

    async def _transcribe_final(self, model, segment) -> str:
        ...

    async def _llm_stream(self, prompt: str):
        # Implement: gọi Models.llm (vLLM), stream từng token async.
        ...

    def _build_prompt(self, text: str, src: str, tgt: str) -> str:
        return f"Translate from {src} to {tgt}: {text}"

    async def cleanup(self):
        for t in self.tasks:
            t.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
```

### 3.9 Concurrency và VRAM

**Concurrent connections:** trong một meeting 3 người, sẽ có 3 SessionPipeline
instances cùng chạy trên FastAPI. Mỗi instance có 3 async tasks riêng → tổng
9 tasks concurrent. Điều này an toàn với asyncio vì I/O bound.

**VRAM budget:**

Models là **shared global** → không nhân theo số client:

| Component | VRAM | Ghi chú |
|-----------|------|---------|
| Silero VAD | ~50MB (CPU thường là đủ) | Nhẹ, có thể chạy CPU |
| Whisper large-v3 | ~3GB fp16 | Shared |
| PhoWhisper large | ~3GB fp16 | Shared |
| SEA-LION 9B (fp16) | ~18GB | Shared, vLLM batch |
| **Tổng cố định** | **~24GB** | Không tăng theo số client |
| **Activation memory per concurrent inference** | ~500MB-1GB | Có tăng, nhưng modest |

Với GPU 24GB (RTX 3090/4090/A5000): serve được 3-5 client đồng thời.
Với GPU 12GB: cần int8 quantization cho SEA-LION hoặc bỏ PhoWhisper.

**Concurrency với vLLM:** vLLM tự batch multiple concurrent requests. FastAPI
gọi `llm.generate_stream(prompt)` từ nhiều task cùng lúc → vLLM tự merge vào
batch → throughput cao. Không cần lock hay queue thêm.

**Concurrency với Whisper:** `faster-whisper` (CTranslate2) thread-safe cho
inference concurrent. Nhưng nếu dùng openai-whisper gốc, cần lock:

```python
whisper_lock = asyncio.Lock()

async def _transcribe_final(self, model, segment):
    async with whisper_lock:
        return model.transcribe(segment)
```

### 3.10 Model recommendations

| Component | Model | VRAM | Note |
|-----------|-------|------|------|
| VAD | Silero VAD | ~50MB (CPU) | `torch.hub.load('snakers4/silero-vad')` |
| STT tiếng Việt | PhoWhisper-large | ~3GB fp16 | HuggingFace `vinai/PhoWhisper-large` |
| STT tiếng Anh | Whisper large-v3 (Faster-Whisper) | ~3GB | `faster-whisper` package, CTranslate2 optimized, thread-safe |
| Translation | Gemma-SEA-LION-v3-9B-IT | ~18GB fp16 / ~9GB int8 | AISG's own model |
| LLM serving | vLLM 0.6+ | — | Continuous batching + streaming, tự handle concurrent requests |

**Nếu VRAM < 12GB, fallback:**
- STT: dùng Whisper large-v3 cho cả 2 ngôn ngữ (bỏ PhoWhisper)
- Translation: Qwen2.5-7B-Instruct int8 (~7GB) hoặc SEA-LION 9B int4

### 3.11 Test với mock NestJS (không cần chạy backend thật)

```python
# test_client.py
import asyncio
import websockets
import json

async def test():
    # Note: query PHẢI có cả sessionId VÀ clientId
    uri = "ws://localhost:8000/ws/session?sessionId=test-session&clientId=test-client"

    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({
            "type": "session.init",
            "config": {"domain": "business", "languagePair": "vi-en"}
        }))

        with open("test.wav", "rb") as f:
            audio_data = f.read()

        # Chia thành chunks 200ms (6400 bytes) và gửi realtime
        for i in range(0, len(audio_data), 6400):
            await ws.send(audio_data[i:i+6400])
            await asyncio.sleep(0.2)

        # Nhận events
        async for msg in ws:
            print(json.loads(msg))

asyncio.run(test())
```

**Test multi-client:** chạy 2 test_client cùng lúc với cùng `sessionId` khác
`clientId` để verify concurrent handling:

```python
async def multi_test():
    await asyncio.gather(
        test_one_client("client-A"),
        test_one_client("client-B"),
        test_one_client("client-C"),
    )
```

Verify:
- Không OOM khi 3 connection cùng lúc
- Events từ 3 connection tách biệt, không lẫn utteranceId
- Latency vẫn OK

### 3.12 Checklist AI Service

- [ ] Setup FastAPI + uvicorn với `lifespan` handler
- [ ] Load models 1 lần trong `lifespan`, expose qua global module
- [ ] **KHÔNG load model trong `SessionPipeline.__init__`**
- [ ] Warmup models với dummy input để tránh cold start
- [ ] `GET /health` trả về `models_loaded` status
- [ ] `WS /ws/session?sessionId=X&clientId=Y` accept connection
- [ ] Handle `session.init`, `speaker.switch`, `session.close`
- [ ] 3 background tasks per connection: VAD → STT → Translate
- [ ] Emit 4 event types với đúng field names
- [ ] `utteranceId` unique GLOBALLY (`uuid4().hex[:12]` là an toàn)
- [ ] `translate.done` ĐỦ 4 field: `fullText`, `sourceText`, `speaker`, `utteranceId`
- [ ] Test multi-client concurrent (3 connections cùng sessionId) — không lẫn
      events, không OOM
- [ ] vLLM continuous batching enabled cho concurrent LLM inference
- [ ] Cleanup pipeline khi WS disconnect (cancel tasks, free queue memory)
- [ ] Chạy bằng PM2: `pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name fastapi`

---

## PHẦN 4 — TIMELINE FLOW TỔNG THỂ

### 4.1 Sequence diagram meeting 2 người

```
Client A (VN)    Client B (EN)    NestJS      LiveKit      FastAPI
    │                │              │            │            │
    │  [A join]                                                │
    │─POST /livekit/token────────────▶            │            │
    │◀──{token, url}────────────────  │            │           │
    │─room.connect(url, token)──────────────────▶  │           │
    │─socket.io(/audio ?sid=X&cid=A)──▶            │           │
    │                          openSession(X,A)───────────────▶│
    │                              ◀── WS #A open ────────────│
    │◀──'session.ready' (gateway + AI ready)                   │
    │                                                          │
    │                  [B join tương tự → mở WS #B riêng]      │
    │                │                │                        │
    │                │─POST /livekit/token▶                    │
    │                │◀──{token,url}──                         │
    │                │─room.connect─────▶ (LiveKit)            │
    │                │─socket.io ?sid=X&cid=B─▶                │
    │                │          openSession(X,B)──────────────▶│
    │                │              ◀── WS #B open ───────────│
    │                │◀──'session.ready' (gateway + AI ready)  │
    │                │                                         │
    │                │ [Video call auto: LiveKit forward       │
    │                │  tracks giữa A và B, không đụng NestJS] │
    │                │                                         │
    │  [A nói]                                                 │
    │─emit 'audio.chunk'(A)──▶                                 │
    │                              forwardAudio qua WS #A ────▶│
    │                                       VAD/STT trên WS #A│
    │                              ◀──stt.partial (WS #A)──── │
    │                              [inject clientId=A]         │
    │◀──'stt.partial' {clientId:A} │                           │
    │                │◀──'stt.partial' {clientId:A}            │
    │                              ◀──stt.final (WS #A)────── │
    │◀──'stt.final' {clientId:A} ─ │                           │
    │                │◀──'stt.final' {clientId:A}              │
    │                                       LLM stream trên #A│
    │                              ◀──translate.token (WS #A) │
    │◀──'translate.token' {clientId:A}                         │
    │                │◀──'translate.token' {clientId:A}        │
    │                              ◀──translate.done (WS #A)  │
    │◀──'translate.done' {clientId:A}                          │
    │                │◀──'translate.done' {clientId:A}         │
    │                              save utterance to store     │
    │                                                          │
    │                │ [B nói tương tự — audio đi WS #B,       │
    │                │  events có clientId=B]                  │
    │                                                          │
    │  [A end meeting]                                         │
    │─emit 'session.end'─────────▶                             │
    │◀──'session.ended' (broadcast) ─                          │
    │                │◀──'session.ended'                       │
    │                    closeRoomSessions(X)                  │
    │                              WS #A close───────────────▶ │
    │                              WS #B close───────────────▶ │
    │─disconnect                                               │
    │                │─disconnect                              │
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

### 5.1 Đã có

1. **Socket.IO `/audio` namespace**, websocket-only, các handler `audio.chunk`,
   `speaker.switch`, `session.end`.
2. **`session.ready` đúng semantics**: chỉ emit sau khi
   `AiBridgeService.openSession()` promise resolve (WS sang FastAPI đã OPEN).
   Timeout 5s → nếu AI không phản hồi, emit `error {code: 'AI_UNAVAILABLE'}` và
   disconnect socket.
3. **1 AI WebSocket pipeline per client**: `AiBridgeService` giữ
   `Map<sessionId+clientId, AiPipeline>`. Audio của client nào đi qua pipeline
   của client đó. Không có nguy cơ trộn audio, không có current-speaker race.
4. **`clientId` injection vào transcript events**: `handleAiEvent` merge
   `clientId` và `displayName` (nếu có) vào mọi event trước khi broadcast tới
   room.
5. **Reconnect handling**: khi 1 client reconnect với cùng `clientId`,
   `SessionStore` return socket cũ, gateway disconnect socket cũ, join room lại
   với socket mới. `removeClient` check `socketId` để chống stale disconnect từ
   socket cũ xóa mất connection mới.
6. **Session lifecycle**: `endedAt` là source of truth. Session đã ended → client
   connect vào bị disconnect ngay với `session.ended`.
7. **`session.end` triệt để**: broadcast `session.ended`, đóng tất cả AI
   pipelines của room (`closeRoomSessions`), force disconnect tất cả sockets.
8. **`POST /livekit/token`** nhận `roomName`, `participantName`, `displayName`,
   `language` và trả `{ token, url }`. `roomName` chấp nhận format tự do (không
   rỗng, ≤128 chars).
9. **`GET /health`** trả `{ status: 'ok', ts, uptime }`.
10. **`GET /sessions/:sessionId`** trả public snapshot: `title`, `startedAt`,
    `participantCount`, `participants[]`. Session ended trả `exists: false`.

### 5.2 Kiến trúc

**AiBridgeService:**
- `Map<key, AiPipeline>` where `key = JSON.stringify([sessionId, clientId])`.
- `openSession(sessionId, clientId, config)`: mở WS mới, await OPEN, timeout 5s.
- `forwardAudio(sessionId, clientId, chunk)`: forward binary tới pipeline riêng.
- `sendControl(sessionId, clientId, message)`: forward JSON control.
- `closeClientSession(sessionId, clientId)`: đóng 1 pipeline.
- `closeRoomSessions(sessionId)`: đóng tất cả pipelines của room khi session end.
- Emit `error` events khi connection fail: `AI_CONN_ERROR`, `AI_CONN_CLOSED`.

**SessionStore:**
- `Map<sessionId, ServerSession>` in RAM (không DB, không Redis).
- `Map<clientId, SessionClient>` per session — theo dõi participants với metadata.
- Public snapshot API cho REST endpoint.

### 5.3 Không có, roadmap sau MVP

- Auth JWT + host/guest roles + waiting room approval.
- Persistent storage (Postgres/Redis) khi cần scale > 1 instance.
- Export DOCX endpoint (utterances đã được lưu trong session store, chỉ cần
  build endpoint mới).
- Rate limit cho `POST /livekit/token`.
- Sequence number + timing per event cho reconnect edge cases.
- Rotate LiveKit credentials khỏi env commit history.

---

## PHẦN 6 — DEPLOY & OPS

### 6.1 Subdomain (self-managed nginx)

| Subdomain | Target | Protocol |
|-----------|--------|----------|
| `api-hackathon.dangpham.id.vn` | `127.0.0.1:4444` | HTTPS + WSS |
| `livekit-hackathon.dangpham.id.vn` | `127.0.0.1:7880` | HTTPS + WSS |

Frontend Vite deploy như static app. Host phải rewrite mọi route `/room/*` về
`index.html`.

### 6.2 Firewall

```bash
sudo ufw allow 50000:50100/udp   # LiveKit media
sudo ufw allow 7881/tcp          # LiveKit TCP fallback
```

### 6.3 PM2 processes

```bash
pm2 start dist/main.js --name nestjs-hackathon
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name fastapi
pm2 save
pm2 startup
```

### 6.4 LiveKit Docker

```bash
docker compose up -d livekit
```

Container đọc key/secret từ env `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` qua
`infra/.env`; **cùng cặp** với NestJS đọc. Không hard-code trong `livekit.yaml`.

### 6.5 Env `.env` cho NestJS

```
PORT=4444
AI_WS_URL=ws://localhost:8000/ws/session
LIVEKIT_API_KEY=<khớp với env LiveKit container>
LIVEKIT_API_SECRET=<khớp với env LiveKit container>
LIVEKIT_URL=wss://livekit-hackathon.dangpham.id.vn
```

---

## PHẦN 7 — TROUBLESHOOTING

| Triệu chứng | Nguyên nhân | Fix |
|-------------|-------------|-----|
| Client connect Socket.IO bị disconnect ngay | Thiếu `sessionId` hoặc `clientId` trong query | Check query string |
| Client nhận `error {code: AI_UNAVAILABLE}` khi connect | FastAPI không phản hồi trong 5s | Verify FastAPI đang chạy, models đã load xong |
| Client nhận `error {code: AI_CONN_ERROR/CLOSED}` giữa session | FastAPI crash hoặc restart | Check log FastAPI, xem lỗi OOM / model error |
| Client emit audio nhưng không có transcript | Emit trước `session.ready`, hoặc FastAPI VAD không detect speech | Đợi `session.ready`, check volume mic |
| Nhiều client cùng meeting, FastAPI OOM ở client thứ 2 | Load model per SessionPipeline thay vì global | Fix: models global, share across connections |
| `translate.done` xong nhưng export DOCX rỗng | FastAPI thiếu `sourceText` hoặc `speaker` field | Check FastAPI event schema, phải đủ 4 field |
| Utterance transcript ghi đè giữa các client | `utteranceId` không unique globally | Fix: dùng UUID thay vì counter per connection |
| LiveKit connect fail "invalid token" | Key/secret NestJS không khớp env LiveKit container | Verify cùng cặp giá trị trong cả 2 deployment |
| Video call kết nối nhưng không thấy hình | Firewall chặn UDP 50000-50100 | Mở UFW |
| WSS "Mixed Content" error trên frontend HTTPS | `LIVEKIT_URL` đang là `ws://` | Đổi sang `wss://` |
| FastAPI crash khi nhận audio | PCM format sai (không phải Int16 16kHz mono) | Client check AudioWorklet resample thật sự |

---

Tài liệu này mô tả contract giữa các service. Wire behavior thực tế của NestJS
đã được xác minh ở Phần 5. Nếu thay đổi contract event, cập nhật cả tài liệu,
shared types (`src/types/realtime.ts`), NestJS `common/types/events.type.ts`,
và implementation FastAPI trong cùng thay đổi.

**Changelog v3:**
- Xác nhận `session.ready` đã đảm bảo gateway + AI ready (mục 2.2, 2.10, 5).
- **Đổi kiến trúc lớn:** NestJS ↔ FastAPI giờ là **1 WebSocket per client**,
  không phải per session (mục 1.1, 3.2, 3.3, 5.2).
- Bổ sung `clientId` bắt buộc + `displayName` optional vào query
  connect Socket.IO (mục 2.4.1) và WS FastAPI (mục 3.3).
- Bổ sung `clientId` và `displayName` vào 4 transcript events (mục 2.4.3).
- Bảng error codes (mục 2.4.3).
- Bổ sung endpoint `GET /sessions/:sessionId` và `session.participants` event.
- Đại tu phần 3 (FastAPI): giải thích rõ multi-client, model sharing bắt buộc,
  concurrency với vLLM continuous batching, VRAM budget, test multi-client.
- Cập nhật port NestJS từ 3001 → 4444.
- Bỏ regex `room-*` cho roomName — chấp nhận format tự do.
- Sequence diagram vẽ lại với 2 WebSocket pipelines A và B riêng biệt.