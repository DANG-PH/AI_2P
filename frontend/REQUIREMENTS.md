# ViEnMeet — Product & Prototype Requirements

> **Project:** ViEnMeet  
> **Tagline:** Two languages. One conversation.  
> **Document type:** Product Requirements Document (PRD) + Frontend Prototype Specification  
> **Target:** 2-day AI hackathon prototype  
> **Primary platform:** Responsive web application  
> **Primary language pair:** Vietnamese ↔ English  
> **Status:** MVP scope locked

---

## 1. Product Overview

ViEnMeet is a translation-first meeting application that enables Vietnamese and English speakers to communicate naturally during live business meetings.

Each participant joins the same meeting room from a separate device. Their audio streams are treated as independent language channels:

- Vietnamese participant audio → Vietnamese speech recognition → English translation.
- English participant audio → English speech recognition → Vietnamese translation.

The application prioritizes:

1. Translation accuracy.
2. Low perceived latency.
3. A natural meeting flow.
4. Clear, readable bilingual captions.
5. Stability under realistic meeting conditions.
6. Privacy-ready and deployable system architecture.

The MVP is a working web prototype that demonstrates the full product journey from creating a room to viewing a bilingual meeting summary.

---

## 2. Challenge Alignment

The original hackathon challenge asks teams to build a working Vietnamese–English translator for live business meetings, with emphasis on bidirectional translation, strong communication accuracy, low perceived latency, intuitive UX, robustness, and deployability.

The suggested judging weights are:

| Criterion | Weight |
|---|---:|
| Translation accuracy | 30% |
| Latency and responsiveness | 20% |
| User experience and meeting flow | 20% |
| Robustness in realistic conditions | 15% |
| Technical design and deployability | 15% |

Bonus considerations include:

- Open AI models that can be hosted on-premise.
- Edge-device deployment.
- Noise robustness.
- Conversational turn-taking.
- Extensibility to additional language pairs.

### Prototype positioning

Although the web prototype supports two participants joining from separate devices, it can still be demonstrated in person by using two laptops, tablets, or phones in the judging room.

This design avoids speaker-identification ambiguity because each participant has a separate audio stream.

---

## 3. Product Goals

### 3.1 Primary goals

- Enable two people to join the same bilingual meeting room.
- Translate Vietnamese speech into English in near real time.
- Translate English speech into Vietnamese in near real time.
- Display the translation most useful to each participant.
- Preserve original transcript and translated transcript.
- Support both participants speaking at the same time through independent audio streams.
- Generate a useful post-meeting summary and transcript.
- Provide a polished, realistic, presentation-ready web experience.

### 3.2 Secondary goals

- Support business terminology through a glossary.
- Provide draft and final translation states.
- Surface connection, microphone, latency, and translation status.
- Allow users to copy and download meeting content.
- Prepare the frontend architecture for later WebRTC, WebSocket, ASR, and translation integration.

### 3.3 Non-goals for the initial prototype

- Full Zoom or Google Meet replacement.
- Group meetings with more than two primary speakers.
- Screen sharing.
- Calendar integration.
- User accounts and authentication.
- Billing and subscriptions.
- Production-grade encryption claims.
- Training a speech or translation model from scratch.
- Guaranteed offline or on-premise processing.
- Perfect simultaneous speech separation from one shared microphone.
- Advanced speaker diarization.
- Production-ready moderation or compliance features.

---

## 4. Target Users

### 4.1 Vietnamese participant

A Vietnamese-speaking businessperson participating in a meeting with an English-speaking partner.

Needs:

- Understand the English participant quickly.
- Speak Vietnamese naturally.
- See English translations of their own speech for verification.
- See Vietnamese translations of the other participant prominently.
- Review decisions and action items after the meeting.

### 4.2 English participant

An English-speaking businessperson participating in a meeting with a Vietnamese-speaking partner.

Needs:

- Understand Vietnamese speech quickly.
- Speak English naturally.
- See Vietnamese translations of their own speech for verification.
- See English translations of the other participant prominently.
- Review decisions and action items after the meeting.

### 4.3 Demo operator

A team member presenting ViEnMeet to judges.

Needs:

- Create and join a room quickly.
- Run the product on two browser windows or two devices.
- Reset the demo safely.
- Recover from microphone, network, or AI pipeline errors.
- Use deterministic mock mode when the real pipeline is unavailable.

---

## 5. Core User Journey

```text
Landing
→ Create or Join Meeting
→ Device Setup
→ Waiting Room
→ Live Meeting
→ Meeting Summary
```

### 5.1 Host journey

1. Open ViEnMeet.
2. Select **Create meeting**.
3. Enter meeting information.
4. Select Vietnamese or English as the host language.
5. Configure microphone and optional camera.
6. Add business glossary terms.
7. Receive a meeting code and invitation link.
8. Wait for the second participant.
9. Start the meeting.
10. Communicate using real-time captions and translations.
11. End the meeting.
12. Review summary, decisions, action items, and transcript.

### 5.2 Guest journey

1. Open invitation link or enter meeting code.
2. Enter display name.
3. Select source language.
4. Configure microphone and optional camera.
5. Join the waiting room.
6. Enter the meeting when the host starts it.
7. Communicate using real-time captions and translations.
8. Review the post-meeting result.

---

## 6. Information Architecture and Routes

| Route | Page | Purpose |
|---|---|---|
| `/` | Landing page | Introduce the product and provide create/join actions |
| `/create` | Create meeting | Configure a new meeting |
| `/join` | Join meeting | Join using a meeting code or invitation link |
| `/room/:roomId/setup` | Device setup | Test microphone, camera, and language settings |
| `/room/:roomId/waiting` | Waiting room | Show participants and readiness |
| `/room/:roomId` | Live meeting | Conduct the translated meeting |
| `/room/:roomId/summary` | Meeting summary | Review summary, actions, decisions, and transcript |

For the prototype, routes may use local state and mock room IDs.

---

## 7. Functional Requirements

## 7.1 Landing Page

### Required content

- ViEnMeet wordmark and logo.
- Tagline: **Two languages. One conversation.**
- Product description:
  - “Near real-time Vietnamese–English interpretation for natural business meetings.”
- Primary action: **Create meeting**.
- Secondary action: **Join with code**.
- Small product preview showing a bilingual conversation.
- Three concise product benefits:
  - Near real-time translation.
  - Business terminology support.
  - Independent language channels.

### Requirements

- Must use a light visual theme.
- Must not look like a generic AI dashboard.
- Must not include pricing, testimonials, or fake customer logos.
- Must be responsive.
- All visible primary actions must work.

---

## 7.2 Create Meeting

### Required fields

- Meeting title.
- Host display name.
- Host source language:
  - Vietnamese.
  - English.
- Guest language inferred as the opposite language for MVP.
- Conversation type:
  - Two-device meeting.
- Optional camera toggle.
- Microphone selection.
- Business glossary.

### Business glossary fields

Each term contains:

- Source term.
- Preferred recognition or translation output.
- Optional note or category.

Default sample terms:

| Source term | Preferred output |
|---|---|
| AISoft | AISoft |
| NIC | National Innovation Center |
| POC | Proof of Concept |
| Zalo Mini App | Zalo Mini App |

### Required interactions

- Add glossary term.
- Edit glossary term.
- Remove glossary term.
- Validate required fields.
- Create a mock room ID.
- Copy invitation link.
- Continue to device setup.

---

## 7.3 Join Meeting

### Required fields

- Meeting code.
- Display name.
- Source language.

### Required interactions

- Join using code.
- Support room code from URL.
- Validate meeting code format.
- Show clear error state for invalid code.
- Continue to device setup.

For prototype mode, use deterministic mock meeting validation.

---

## 7.4 Device Setup

### Required controls

- Microphone selector.
- Microphone permission state.
- Live audio-level visualization.
- Test microphone button.
- Camera toggle.
- Camera preview when enabled.
- Source language confirmation.
- Speaker output status.
- Noise-level indicator.

### Required states

- Permission not requested.
- Permission granted.
- Permission denied.
- No microphone found.
- Testing.
- Ready.
- Excessive noise warning.

### Prototype behavior

- Use browser media-device APIs where practical.
- Provide mock fallback when permissions are unavailable.
- Do not claim advanced noise cancellation unless implemented.

---

## 7.5 Waiting Room

### Required content

- Meeting title.
- Meeting code.
- Invitation link.
- Current participant card.
- Remote participant card.
- Microphone readiness.
- Camera readiness.
- Selected language.
- Connection status.

### Required interactions

- Copy meeting code.
- Copy invitation link.
- Toggle microphone.
- Toggle camera.
- Leave room.
- Start meeting.

### Rules

- Host can start the meeting.
- Guest sees “Waiting for host”.
- Prototype may simulate the second participant joining.
- The page should support two real browser sessions later.

### Empty state

Use the ViEnMeet mascot only in the waiting state, not as a dominant live-meeting element.

---

## 7.6 Live Meeting

This is the highest-priority screen.

### 7.6.1 Layout

Desktop layout:

- 65–70% dark neutral video stage.
- 30–35% white live-translation panel.
- White or light application header.
- Compact floating meeting-control dock.

Tablet layout:

- Video stage above.
- Translation panel below.

Mobile layout:

- Remote participant fills the main stage.
- Current user appears in a small floating tile.
- Translation appears in a bottom sheet.
- Controls stay reachable at the bottom.

### 7.6.2 Video stage

Required:

- Remote participant tile.
- Current participant tile.
- Participant name.
- Source language.
- Microphone state.
- Camera state.
- Speaking indicator.
- Connection-quality indicator.

Prototype may use avatars or placeholder video tiles when camera is disabled.

### 7.6.3 Translation panel

Each translation entry must include:

- Speaker name.
- Timestamp.
- Source language.
- Target language.
- Original transcript.
- Translated transcript.
- Translation status.
- Copy action.
- Correction action or correction placeholder.

Translation statuses:

- `listening`
- `transcribing`
- `draft`
- `final`
- `low-confidence`
- `failed`

Display priority:

- The translation that the current participant understands should be visually dominant.
- The original transcript should remain visible in secondary text.
- Do not use oversized colored chat bubbles.
- Use subtle separators, small badges, and restrained accents.

### 7.6.4 Independent audio channels

Each participant has a separate audio stream.

Conceptual pipeline:

```text
Participant A microphone
→ audio channel A
→ source-language ASR
→ target-language translation
→ transcript event

Participant B microphone
→ audio channel B
→ source-language ASR
→ target-language translation
→ transcript event
```

The application must associate every event with:

- Room ID.
- Participant ID.
- Source language.
- Sequence number.
- Start timestamp.
- End timestamp.
- Draft/final status.

### 7.6.5 Simultaneous speech

When both participants speak at the same time:

- Both streams continue processing independently.
- The UI shows a subtle “Both participants are speaking” indicator.
- Transcript events are ordered using timestamps.
- The application must not pause translation merely because both participants speak.
- No speaker diarization is required because each stream already identifies its participant.
- If TTS is added later, translated audio must be queued rather than played simultaneously.

### 7.6.6 Meeting controls

Required controls:

- Microphone toggle.
- Camera toggle.
- Captions toggle.
- Translation panel toggle.
- Notes.
- More options.
- End call.

Optional prototype control:

- Run/reset deterministic demo.

Rules:

- End call uses red.
- Disabled microphone or camera may use red-tinted state.
- Other controls use neutral colors.
- The control dock must not span the entire screen as a heavy dark toolbar.

### 7.6.7 System status

Show compact status indicators:

- Connection quality.
- Translation latency.
- Noise level.
- Processing mode.

Prototype example:

- Connection: Excellent.
- Translation latency: 780 ms.
- Noise level: Low.
- Translation mode: Cloud prototype.

Do not claim local, private, edge, or on-premise processing unless it is actually implemented.

### 7.6.8 Notes

Users can:

- Add a note.
- Remove a note.
- View notes during the meeting.
- Include notes in the summary page.

---

## 7.7 Meeting Summary

### Required overview

- Meeting title.
- Date and time.
- Duration.
- Participants.
- Languages.
- Number of conversation turns.

### Required sections

#### Summary

A concise summary of the meeting.

#### Decisions

Confirmed decisions made during the meeting.

#### Action items

Each action item contains:

- Description.
- Owner.
- Status.
- Optional due date.

#### Transcript

Full bilingual transcript in chronological order.

### Required actions

- Copy summary.
- Copy an individual action item.
- Download transcript as `.txt`.
- Download summary as `.md` if time allows.
- Start another meeting.
- Return to landing page.

---

## 8. Mock Demo Requirements

The frontend must be demonstrable before real AI integration.

### Deterministic sample conversation

#### Turn 1 — Vietnamese

Original:

> Xin chào ông James. Chúng tôi muốn thảo luận về khả năng triển khai một dự án thử nghiệm tại Việt Nam.

Translation:

> Hello, James. We would like to discuss the possibility of launching a pilot project in Vietnam.

#### Turn 2 — English

Original:

> That sounds promising. What timeline are you considering?

Translation:

> Điều đó nghe rất triển vọng. Các bạn đang dự kiến tiến độ như thế nào?

#### Turn 3 — Vietnamese

Original:

> Chúng tôi dự kiến bắt đầu vào tháng Chín và thực hiện trong ba tháng.

Translation:

> We expect to start in September and run the pilot for three months.

#### Turn 4 — English

Original:

> Please send us a technical proposal after this meeting.

Translation:

> Vui lòng gửi cho chúng tôi đề xuất kỹ thuật sau cuộc họp này.

### Demo transition sequence

For each turn:

1. Show speaker activity.
2. Reveal source transcript progressively.
3. Show `transcribing`.
4. Show a temporary `draft` translation.
5. Replace it with the `final` translation.
6. Auto-scroll to the newest turn.

### Demo controls

- Start demo.
- Pause demo.
- Reset demo.
- Simulate simultaneous speech.
- Simulate low-confidence term.
- Simulate connection warning.

Mock mode must be visibly labeled as simulated during development and internal testing.

---

## 9. Design System

## 9.1 Visual direction

ViEnMeet should resemble a polished professional meeting product rather than a generic AI SaaS dashboard.

Use:

- Light product shell.
- White content surfaces.
- Dark charcoal video stage.
- Neutral typography.
- Minimal shadows.
- Subtle borders.
- Restrained blue and teal brand accents.

Avoid:

- Large dark navy backgrounds outside the meeting stage.
- Excessive gradients.
- Glassmorphism.
- Purple AI glow.
- Decorative floating shapes.
- Large colored chat bubbles.
- Excessive rounded pills.
- Heavy dashboards with unnecessary metrics.

---

## 9.2 Color tokens

```css
:root {
  --background: #F7F8FA;
  --surface: #FFFFFF;
  --surface-subtle: #F1F3F5;

  --text-primary: #17181B;
  --text-secondary: #667085;
  --text-muted: #98A2B3;

  --border: #E4E7EC;
  --border-strong: #D0D5DD;

  --primary: #2563EB;
  --primary-hover: #1D4ED8;
  --primary-soft: #EFF6FF;

  --translation: #0F766E;
  --translation-soft: #F0FDFA;

  --meeting-stage: #18191C;
  --meeting-tile: #24262B;

  --success: #15803D;
  --warning: #D97706;
  --danger: #DC2626;
  --live: #DC2626;
}
```

### Color usage rules

- Blue is the primary action color.
- Teal indicates translation-related features.
- Red is reserved for live state, errors, disabled media, and ending a call.
- The dark stage must be charcoal, not saturated navy.
- Do not use blue and teal gradients across large surfaces.
- Small logo gradients are acceptable when consistent with the brand assets.

---

## 9.3 Typography

Preferred fonts:

1. Geist.
2. Inter.
3. System sans-serif fallback.

Weights:

- Page headings: 600–700.
- Section headings: 600.
- Body: 400–500.
- Translated text: 500–600.
- Metadata: 400–500.

Typography must support Vietnamese diacritics correctly.

---

## 9.4 Shape and spacing

Recommended radii:

- Buttons: 10px.
- Inputs: 10px.
- Panels: 14px.
- Video tiles: 12px.
- Control dock: 14px.

Rules:

- Do not apply `rounded-3xl` to every component.
- Use an 8px spacing system.
- Prefer clear hierarchy over decorative cards.
- Use subtle shadows only for floating controls or overlays.

---

## 9.5 Logo and mascot usage

### Primary logo

- Use the ViEnMeet symbol and wordmark.
- On light backgrounds:
  - `Vi`: blue.
  - `En`: teal.
  - `Meet`: near-black.
- Remove glow effects in the actual UI.
- Keep sufficient clear space around the logo.

### App icon and favicon

- Dark navy or charcoal square background is acceptable.
- Use the compact V/E speech-bubble symbol.
- No small wordmark.
- Must remain legible at 16–32px.

### Mascot

Use only for:

- Waiting room.
- Empty states.
- Onboarding.
- Friendly system guidance.

Do not place the mascot prominently inside the live meeting interface.

---

## 10. Accessibility Requirements

- Use semantic HTML.
- All icon-only buttons require accessible labels.
- Maintain keyboard-visible focus states.
- Do not communicate state using color alone.
- Maintain sufficient color contrast.
- Support browser zoom.
- Respect `prefers-reduced-motion`.
- Captions must remain readable at common laptop resolutions.
- Dialogs must trap focus correctly.
- Form fields require visible labels and error messages.
- Meeting controls must be keyboard accessible.

---

## 11. Responsive Requirements

### Desktop

- Two-column live meeting layout.
- Translation panel visible by default.
- Floating bottom controls.
- Sidebar or panel may be collapsible.

### Tablet

- Video stage occupies the upper area.
- Translation content appears underneath.
- Controls remain fixed or sticky.

### Mobile

- Remote participant is primary.
- Local participant appears as picture-in-picture.
- Translation uses a draggable or expandable bottom sheet.
- Controls fit within the viewport without horizontal scrolling.
- The user can switch between:
  - Meeting.
  - Translation.
  - Notes.

---

## 12. Frontend Technical Requirements

### Recommended stack

- React.
- Vite.
- TypeScript.
- React Router.
- Tailwind CSS.
- Zustand.
- Lucide React.
- Framer Motion for subtle transitions only.
- shadcn/ui where useful.
- pnpm.

### Rules

- TypeScript strict mode.
- Avoid `any`.
- Keep page components focused on layout and orchestration.
- Use reusable feature components.
- Store shared types in `src/types`.
- Store mock data in `src/data`.
- Store state logic in `src/store`.
- Do not make external AI calls in the frontend prototype.
- Do not expose API keys in browser code.
- Do not leave prominent buttons non-functional.
- Run lint and build after meaningful changes.

---

## 13. Suggested Frontend Structure

```text
src/
├── app/
│   ├── App.tsx
│   └── router.tsx
├── components/
│   ├── brand/
│   ├── create-meeting/
│   ├── device-setup/
│   ├── landing/
│   ├── meeting/
│   ├── summary/
│   ├── waiting-room/
│   └── ui/
├── data/
│   ├── mockMeeting.ts
│   └── mockParticipants.ts
├── hooks/
├── lib/
│   ├── constants.ts
│   ├── downloads.ts
│   └── utils.ts
├── pages/
│   ├── CreateMeetingPage.tsx
│   ├── DeviceSetupPage.tsx
│   ├── JoinMeetingPage.tsx
│   ├── LandingPage.tsx
│   ├── LiveMeetingPage.tsx
│   ├── MeetingSummaryPage.tsx
│   └── WaitingRoomPage.tsx
├── store/
│   └── meetingStore.ts
├── styles/
│   └── globals.css
└── types/
    └── meeting.ts
```

---

## 14. Domain Types

Minimum recommended types:

```ts
type LanguageCode = "vi" | "en";

type MeetingStatus =
  | "draft"
  | "waiting"
  | "live"
  | "ended";

type TranslationStatus =
  | "listening"
  | "transcribing"
  | "draft"
  | "final"
  | "low-confidence"
  | "failed";

type ParticipantRole = "host" | "guest";

type Participant = {
  id: string;
  displayName: string;
  role: ParticipantRole;
  sourceLanguage: LanguageCode;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  connectionStatus: "connecting" | "connected" | "poor" | "disconnected";
};

type GlossaryTerm = {
  id: string;
  source: string;
  preferredOutput: string;
  note?: string;
};

type ConversationTurn = {
  id: string;
  roomId: string;
  participantId: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  originalText: string;
  translatedText: string;
  status: TranslationStatus;
  sequenceNumber: number;
  startedAt: number;
  endedAt?: number;
  confidence?: number;
};

type MeetingNote = {
  id: string;
  content: string;
  createdAt: number;
};

type ActionItem = {
  id: string;
  description: string;
  ownerParticipantId?: string;
  dueDate?: string;
  status: "open" | "done";
};

type Meeting = {
  id: string;
  title: string;
  status: MeetingStatus;
  hostId: string;
  participants: Participant[];
  glossary: GlossaryTerm[];
  turns: ConversationTurn[];
  notes: MeetingNote[];
  actionItems: ActionItem[];
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
};
```

---

## 15. Future Realtime Architecture

The prototype must be structured so that real services can be added later.

### Media layer

Recommended:

- WebRTC for participant audio/video.
- Managed WebRTC/SFU provider or established media stack for production.
- Avoid building a custom media server during the hackathon unless necessary.

### AI transport layer

Recommended:

- WebSocket for streaming audio or transcript events.
- One logical stream per participant.
- Each event includes room and participant metadata.

### Conceptual architecture

```text
Browser A
├── WebRTC media ─────────────┐
└── AI audio stream A ────────┤
                              ├── Meeting backend
Browser B                     │   ├── Session management
├── WebRTC media ─────────────┤   ├── Streaming ASR
└── AI audio stream B ────────┘   ├── Translation
                                  ├── Glossary handling
                                  └── Realtime events
```

### Example audio event

```ts
type AudioChunkMessage = {
  roomId: string;
  participantId: string;
  sourceLanguage: LanguageCode;
  sequenceNumber: number;
  startedAt: number;
  audioData: ArrayBuffer;
};
```

### Example transcript event

```ts
type TranscriptEvent = {
  roomId: string;
  participantId: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  originalText: string;
  translatedText: string;
  status: "draft" | "final";
  sequenceNumber: number;
  startedAt: number;
  endedAt?: number;
  confidence?: number;
};
```

---

## 16. Reliability and Error Handling

The UI must handle:

- Microphone permission denied.
- Camera permission denied.
- No media device found.
- Remote participant disconnected.
- Temporary connection degradation.
- Translation timeout.
- ASR failure.
- Low-confidence transcript.
- Empty translation result.
- Duplicate or out-of-order transcript events.
- Meeting ended remotely.
- Page refresh during a meeting.
- Unsupported browser.

### Recovery behavior

- Show a clear non-blocking error when possible.
- Preserve existing transcript.
- Allow retry.
- Never silently discard a finalized turn.
- Use sequence numbers to prevent duplicate events.
- Keep mock demo mode available for presentation fallback.

---

## 17. Privacy and Trust Requirements

- Do not state that the application is end-to-end encrypted unless verified.
- Do not state that audio is processed locally unless verified.
- Clearly label prototype processing mode.
- Avoid storing microphone audio in the browser prototype.
- Transcript download should happen locally in the browser.
- Do not send data to analytics services during the hackathon unless explicitly required.
- Explain future privacy-ready architecture without misrepresenting current implementation.

---

## 18. Performance Targets

These are prototype targets, not production guarantees.

### UI targets

- Initial page usable within 3 seconds on normal hackathon Wi-Fi.
- UI interactions respond within 100 ms where practical.
- Transcript draft appears progressively.
- Auto-scroll remains smooth with at least 100 turns.
- No major layout shift during status changes.

### Realtime targets

- Perceived draft latency target: under 1.5 seconds.
- Final translation target: under 3 seconds after a completed speaking turn.
- Translation events must be rendered immediately when received.
- Simultaneous streams must not block one another.

---

## 19. Acceptance Criteria

## 19.1 Landing

- User can create a meeting.
- User can navigate to join a meeting.
- Layout works on desktop and mobile.
- Light theme is used correctly.

## 19.2 Create and join

- Required fields validate.
- Glossary supports add, edit, and delete.
- A mock room is created.
- Invitation link can be copied.
- Join code flow works.

## 19.3 Device setup

- Microphone permission can be requested.
- Audio-level visualization works or has a clear mock fallback.
- User can continue when ready.
- Permission errors are understandable.

## 19.4 Waiting room

- Host and guest states are visually distinct.
- Readiness is visible.
- Host can start.
- Guest can see waiting state.
- Invitation code can be copied.

## 19.5 Live meeting

- Two participants are visible.
- Translation panel is first-class and readable.
- Mock conversation can run from start to finish.
- Draft and final states are visible.
- Both-speakers-active state can be simulated.
- Captions can be toggled.
- Microphone and camera controls work.
- Notes can be added.
- Meeting can be ended.
- Layout works on laptop and mobile widths.

## 19.6 Summary

- Summary displays.
- Decisions display.
- Action items display.
- Full bilingual transcript displays.
- Summary can be copied.
- Transcript downloads as `.txt`.
- User can start another meeting.

## 19.7 Code quality

- `pnpm lint` passes.
- `pnpm build` passes.
- No unused code or imports.
- No exposed secrets.
- No major console errors.
- No prominent non-functional controls.

---

## 20. Implementation Priority

### P0 — Must complete

- Light visual system.
- Landing.
- Create/join room flow.
- Device setup.
- Waiting room.
- Live meeting layout.
- Translation panel.
- Deterministic bilingual demo.
- Draft/final translation states.
- Independent participant channels in state model.
- Simultaneous-speaking simulation.
- Meeting controls.
- Summary and transcript.
- Responsive design.
- Lint and build pass.

### P1 — Complete after P0 is stable

- Real microphone-level input.
- Two real browser sessions.
- WebSocket transcript events.
- Glossary-aware translation.
- Low-confidence correction.
- Connection-quality simulation.
- Notes.
- Transcript download.

### P2 — Bonus features

- Real WebRTC audio/video.
- Streaming ASR.
- Real translation model.
- Noise reduction.
- TTS.
- On-premise model mode.
- Edge-device mode.
- Additional languages.
- Automatic action-item extraction.

---

## 21. Demo Script

### Setup

- Device A: Vietnamese participant.
- Device B: English participant.
- Both join the same room.
- Add glossary terms before entering.
- Confirm microphones are ready.

### Demo flow

1. Vietnamese participant speaks.
2. Vietnamese transcript appears.
3. English draft appears.
4. Final English translation replaces the draft.
5. English participant replies.
6. English transcript appears.
7. Vietnamese translation appears.
8. Both participants briefly speak simultaneously.
9. ViEnMeet processes both channels independently.
10. End the meeting.
11. Show generated summary, decisions, action items, and transcript.
12. Download transcript.

### Fallback

If the real AI pipeline fails:

- Switch to deterministic mock mode.
- Keep the same UI and interaction flow.
- Clearly state that the simulation demonstrates the intended realtime event model.

---

## 22. Final Product Statement

ViEnMeet is not merely a translated-caption widget added to a video call.

It is a translation-first meeting experience where:

- each participant owns an independent language channel,
- translations are optimized for the listener,
- bilingual conversation remains visible and reviewable,
- simultaneous speech does not collapse into one mixed microphone stream,
- and the meeting produces useful outcomes after the call ends.

The MVP succeeds when two people can open ViEnMeet on separate devices, join one room, communicate across Vietnamese and English, and complete a smooth, believable end-to-end meeting demo.
