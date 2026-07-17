# CLAUDE.md

## ViEnMeet project instructions

Before changing the project:

1. Read [`AGENTS.md`](./AGENTS.md) for implementation policy.
2. Read the relevant sections of [`REQUIREMENTS.md`](./REQUIREMENTS.md), which
   is the product source of truth and acceptance checklist.
3. Use [`README.md`](./README.md) to understand what the repository currently
   implements; do not confuse current implementation with the complete target
   MVP.

Project constraints:

- Complete locked P0 requirements before P1, P2, future integrations, or
  documented non-goals unless the user explicitly changes scope.
- Preserve the two-participant, separate-device, independent-language-channel
  model.
- Keep prototype behavior deterministic and visibly labeled as simulated.
- Do not add backend or external AI calls during the P0 prototype and never
  expose credentials in frontend code.
- Route all new visible UI copy through the typed English/Vietnamese translation
  system in `src/i18n`.
- Maintain the light application shell, charcoal live stage, accessibility, and
  desktop/mobile behavior specified in the PRD.
- Make prominent controls functional or explicitly unavailable.
- Run `pnpm lint` and `pnpm build` after meaningful changes.

The latest explicit user request takes precedence if it intentionally changes
the documented product scope.

## Behavioral guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

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

## 4. Goal-Driven Execution

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
