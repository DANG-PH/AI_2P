# ViEnMeet coding rules

## Source of truth and scope

1. Treat [`REQUIREMENTS.md`](./REQUIREMENTS.md) as the authoritative product
   specification and acceptance checklist unless the current user request
   explicitly changes it.
2. Treat this file as the implementation policy and [`README.md`](./README.md)
   as a description of the repository's current state.
3. The repository currently implements a vertical slice, not the complete
   locked MVP. Do not describe an unimplemented requirement as complete.
4. Complete P0 requirements before P1 or P2 work. Future architecture,
   recommended integrations, and bonus features are not authorization to add
   them.
5. Keep the documented non-goals out of the MVP unless the user explicitly
   expands the scope.

## Product invariants

1. ViEnMeet is translation-first: the listener's selected language and
   translated transcript take visual priority while the original remains
   available.
2. Model the two primary participants as separate devices with independent
   language and audio channels. Do not design the core flow around one shared
   microphone or require speaker diarization.
3. Preserve room, participant, language, sequence, timing, and draft/final
   metadata at realtime event boundaries.
4. Keep deterministic mock mode available until a real pipeline is explicitly
   requested and reliable. Clearly label simulated media, latency, connection,
   and translation behavior.
5. Never claim local processing, on-premise deployment, encryption, privacy, or
   AI accuracy that is not implemented and verified.
6. Follow the target room-scoped route contract in `REQUIREMENTS.md` when
   extending the journey. Existing `/setup`, `/meeting`, and `/summary` routes
   are transitional prototype routes, not the target information architecture.
7. Use the documented light application shell and reserve the charcoal theme
   for the live video stage. Reuse the design tokens in
   `src/styles/globals.css`.
8. All prominent actions must work. If a non-goal is represented in the UI,
   make its unavailable state explicit rather than presenting a dead control.
9. All interface copy must support English and Vietnamese through the typed
   translation system in `src/i18n`; do not hardcode new visible UI strings in
   components. User-entered content and bilingual meeting records remain domain
   data.
10. Preserve semantic HTML, keyboard access, visible focus, non-color status
    cues, reduced-motion support, and responsive behavior.

## Engineering rules

1. Use TypeScript strictly and never introduce `any` without a documented reason.
2. Prefer small reusable components.
3. Keep page components focused on layout and orchestration.
4. Put mock data in `src/data`.
5. Put shared domain types in `src/types`.
6. Put shared state logic in `src/store`.
7. Do not add backend or external AI calls during the P0 prototype stage. Never
   expose service credentials in browser code.
8. Do not introduce a dependency when the same result can be implemented simply.
9. Do not use excessive animations.
10. Keep UI copy realistic and concise.
11. Do not falsely label simulated features as real AI processing.
12. Run lint and build after meaningful changes.
13. For user-facing layout changes, verify the affected flow at representative
    desktop and mobile widths.
14. Preserve responsive behavior.
15. Do not leave unused code, imports, or placeholder files.
16. Use clear English names for files, variables, and components.
17. Add comments only when explaining non-obvious behavior.

## Behavioral guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
