# ViEnMeet

**Two languages. One conversation.**

ViEnMeet is a translation-first meeting product for near real-time
Vietnamese–English business conversations between two participants on separate
devices. The frontend connects to the deployed NestJS realtime gateway and
LiveKit server described in [`../Architecture.md`](../Architecture.md).

## Product specification

[`REQUIREMENTS.md`](./REQUIREMENTS.md) is the authoritative PRD, target route
map, priority order, and acceptance checklist. Its MVP scope is broader than
the current vertical slice and includes dedicated create, join, device setup,
waiting-room, room-scoped meeting, and summary flows.

This README describes what is implemented now. Project execution rules are in
[`AGENTS.md`](./AGENTS.md), with compatible guidance for Claude in
[`CLAUDE.md`](./CLAUDE.md).

## Tech stack

- React 19.2
- Vite 8
- TypeScript 6 in strict mode
- Tailwind CSS 4
- React Router 8
- Zustand 5
- Lucide React
- Motion 12, the current Framer Motion package
- ESLint 10 flat config
- pnpm 10

Node.js 22.22 or newer is required.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Vite.

## Commands

```bash
pnpm dev      # Start the Vite development server
pnpm build    # Type-check and create a production build
pnpm lint     # Run ESLint
pnpm preview  # Preview the production build
```

## Current prototype routes

| Route | Screen |
| --- | --- |
| `/` | Concise product landing page and conversation preview |
| `/create` | Create a local room and continue to setup |
| `/room/:roomId/setup` | Meeting details, live microphone test, and glossary CRUD |
| `/room/:roomId` | LiveKit video and realtime bilingual transcript console |
| `/room/:roomId/summary` | Summary, actions, decisions, transcript, and browser export |

The old `/setup`, `/meeting`, and `/summary` paths redirect to a generated
room-scoped URL for compatibility.

## Implemented interactions

- Edit meeting and participant details
- Switch the entire interface between Vietnamese and English with the choice
  saved in the browser
- Switch automatic and push-to-talk conversation modes
- Test the browser microphone with live input levels
- Add, edit, and remove glossary terms
- Start and end a meeting
- Receive `stt.partial`, `stt.final`,
  `translate.token`, and `translate.done` events
- Toggle the microphone and swap the visible language order
- Use Space and Enter as push-to-talk controls outside form fields
- Copy and correct translations
- Add and remove meeting notes
- Copy the summary
- Download a UTF-8 `.txt` transcript entirely in the browser
- Start another meeting while retaining the setup and glossary

## Realtime integration

The URL room ID is used as both Socket.IO `sessionId` and LiveKit `roomName`.
A stable browser `clientId` is persisted in local storage and is also used as
the LiveKit participant identity. Microphone PCM is sent only after the gateway
emits `session.ready`; transcript events are reduced by `utteranceId`.

## Project structure

```text
src/
├── app/                  # Router and application entry
├── components/
│   ├── landing/          # Landing conversation preview and benefit strip
│   ├── layout/           # Brand and page headers
│   ├── meeting/          # Feed, controls, sidebar, and status components
│   ├── setup/            # Setup form, microphone test, and glossary editor
│   └── ui/               # Shared accessible primitives
├── data/                 # Initial empty meeting state
├── hooks/                # Realtime, clock, clipboard, and PTT orchestration
├── i18n/                 # Typed English and Vietnamese dictionaries
├── lib/                  # Identity, realtime reducers, formatting, and utilities
├── pages/                # Four route-level page components
├── store/                # Typed Zustand meeting and locale stores
├── styles/               # Tailwind theme and global styles
└── types/                # Meeting, realtime contract, and i18n domain types
```
