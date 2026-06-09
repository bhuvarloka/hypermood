# Plan: Align the chat input + LLM layer with generative-UI patterns (AI SDK Elements)

## Context

The user reviewed AI SDK Elements (PromptInput, Suggestions, Attachments, chatbot example), CopilotKit's generative-UI spectrum, and assistant-ui, and wants Hypermood's prompt-input/suggestions surface and the LLM-contact layer aligned with those patterns. Assessment of the current code (`src/components/chat/`, `src/actions/chat.ts`, `src/lib/gemini/`):

- Hypermood already practices **Controlled Generative UI** (server returns structured `interpretedFilter` / `result_image_ids` / `followups`; client renders pre-built components). No move up the spectrum needed.
- What's missing vs. the Elements patterns: an explicit **status state machine** (currently two booleans, no error state in the UI), **compound-component anatomy** for the input (currently one 373-line `chat-interface.tsx` + one 217-line `use-chat-state.ts` with prop drilling), a **typed message-parts model**, and **real streaming** (currently one server-action round-trip; the "thinking…" line is blind).

**Decisions made with the user:**

1. **Scope:** only the chat input + suggestions interface and anything in direct contact with the LLMs. UI components built **in-house** following Elements anatomy — no shadcn/ui, no Elements copy-paste, Hypermood's design language (Diatype, three radii, `--motion-*` tokens) stays.
2. **Streaming: yes** — move the chat turn to a streaming transport that emits typed phases (plan → results → followups).
3. **No conversation thread** — the T-02 "one quiet input, transient assistant output" design stays.
4. **Nothing is executed now.** The deliverable of this plan is a single new file: `plan/tasks_june_2026.md`, a dependency-ordered checklist of small, verifiable, parallelizable-where-possible tasks.

**Non-goals (recorded in the tasks file):** no shadcn/ui, no assistant-ui, no CopilotKit, no visible message thread, no `streamText` (the custom Gemini pipeline — regex fast-path, mid-stream embedding parallelization, context caching — is kept intact), no redesign of the result grid / masonry / galleries.

**Dependency stance for the transport:** adopt the AI SDK **UI message stream protocol** via the `ai` package's stream helpers (`createUIMessageStream` on the server, `readUIMessageStream` or a small custom reader on the client) as the single new dependency, wrapping the existing `@google/genai` pipeline. This is the most faithful "use the Vercel patterns" for the LLM-contact layer without rewriting the pipeline. A zero-dep SSE fallback is noted inside the task if the dependency is rejected at implementation time.

## Implementation

**One step: create `plan/tasks_june_2026.md`** with the content below (same house format as the May file: ID / Status / Order / Effort / Depends on / Sub-tasks / Done when). IDs continue from **T-34** so task IDs stay globally unique across plan files.

### Execution order at a glance (to embed in the file)

| Order | ID   | Title                                                                   | Depends on       | Lane       |
| ----- | ---- | ----------------------------------------------------------------------- | ---------------- | ---------- |
| 1     | T-34 | Chat status state machine (`idle/submitted/streaming/error`)            | —                | A (core)   |
| 2     | T-35 | Typed turn-parts model (`TurnPart` union + pure mappers)                | —                | A (core)   |
| 3     | T-36 | `PromptInput` compound components + context                             | T-34             | B (UI)     |
| 4     | T-37 | `PromptInputAttachments` (selection strip → attachments pattern)        | T-36             | B (UI)     |
| 5     | T-38 | `Suggestions` primitive (followups + idle prompt)                       | T-36             | B (UI)     |
| 6     | T-39 | Recompose `chat-interface.tsx` on the new primitives                    | T-36, T-37, T-38 | B (UI)     |
| 7     | T-40 | Decompose `use-chat-state.ts` into focused hooks                        | T-34             | C (hooks)  |
| 8     | T-41 | Server: phase-split the turn pipeline into part-emitting pure functions | T-35             | D (server) |
| 9     | T-42 | Streaming route handler `/api/chat` (UI message stream protocol)        | T-41             | D (server) |
| 10    | T-43 | Client streaming transport hook; delete the server-action send path     | T-42, T-34, T-40 | D (client) |
| 11    | T-44 | Abort + error affordances (stop button, error part)                     | T-43             | D (client) |
| 12    | T-45 | E2E + telemetry pass for the streamed turn                              | T-39, T-43       | E (verify) |

Lanes A, B, C are parallelizable after their stated dependencies; lane D is the strict sequence; T-35 and T-41 can proceed in parallel with all of lane B.

### Task specs (to embed in the file — full text below is the deliverable's body)

**T-34 — Chat status state machine.** Replace `sending`/`processing` booleans in [use-chat-state.ts](src/components/chat/use-chat-state.ts) with a single `status: 'idle' | 'submitted' | 'streaming' | 'error'` (AI SDK `ChatStatus` vocabulary; `streaming` unused until T-43 but defined now). Pure transition function in a `.logic.ts` file + unit tests. Surface the currently-swallowed error state as a quiet inline line (matches T-12's honesty rule). _Done when:_ no `sending`/`processing` booleans remain; unit tests cover every transition; a failed `sendMessage` shows an inline error instead of silently resetting.

**T-35 — Typed turn-parts model.** New `src/components/chat/turn-parts.ts` (or `src/types/`): discriminated union `TurnPart = { type: 'status', phase } | { type: 'filter-plan', plan } | { type: 'result-set', imageIds, total } | { type: 'followups', items } | { type: 'note', text } | { type: 'error', message }` — shaped like AI SDK UIMessage data parts (`data-*` naming on the wire). Pure mapper `toTurnParts(result: SendMessageResult): TurnPart[]` + unit tests. No transport or UI change yet. _Done when:_ mapper round-trips every field of `SendMessageResult`; `tsc` clean; tests pass.

**T-36 — PromptInput compound components.** New `src/components/prompt-input/` mirroring Elements anatomy in Hypermood's design language: `PromptInput` (form root + React context provider holding input value, status, submit), `PromptInputTextarea` (auto-resize, Enter submits / Shift+Enter newline), `PromptInputToolbar` (slot for refine toggle), `PromptInputSubmit` (status-driven: idle → send, submitted/streaming → stop affordance placeholder, error → retry). Context hook `usePromptInput()` replaces prop drilling. Presentational only — no server calls. _Done when:_ components render in isolation with mocked context; no visual regression vs. the current input (same quiet, borderless bottom bar); keyboard behavior identical.

**T-37 — Attachments pattern for the selection strip.** Rebuild `SelectionStrip` (currently inline in [chat-interface.tsx:324-372](src/components/chat/chat-interface.tsx#L324-L372)) as `PromptInputAttachments` / `PromptInputAttachment` following the Elements attachments pattern: selected images are the attachments (image-as-prompt references), inline variant, per-item remove on hover, explicit Clear, dissolves when empty, `usePromptInputAttachments()` context hook. _Done when:_ selection add/remove/clear flows work unchanged; strip is its own component with zero props drilled from the page; dissolve animation uses `--motion-micro`.

**T-38 — Suggestions primitive.** New `Suggestions` / `Suggestion` (horizontal, scrollable, pill-style per the existing `rounded-full` rule) rendering: LLM/derived followups, and the selection-idle prompt ("Find images similar to these…") as a suggestion rather than a bespoke ghost line. Click = submit through `usePromptInput()`. _Done when:_ followup chips and idle prompt both render through the one primitive; bespoke ghost-line JSX is deleted; suggestions hidden while `status !== 'idle'`.

**T-39 — Recompose `chat-interface.tsx`.** Rewrite the bottom bar as composition: `<PromptInput><PromptInputAttachments/><PromptInputTextarea/><PromptInputToolbar>…refine…</PromptInputToolbar><PromptInputSubmit/></PromptInput><Suggestions/>`. `chat-interface.tsx` becomes layout-only. _Done when:_ file < 200 lines; no chat-input JSX outside `src/components/prompt-input/`; behavior parity confirmed by the existing command-center e2e block.

**T-40 — Decompose `use-chat-state.ts`.** Split into `use-turn.ts` (turn lifecycle + server calls + status machine), `use-selection.ts` (selection set + idle-prompt timer), `use-darkroom.ts` (lightbox + focus restore). Pure derivations move to `.logic.ts`. Each hook owns its own teardown. _Done when:_ no hook file > 100 lines; timers/listeners live in the hook that owns the feature; unit tests for the extracted pure logic pass.

**T-41 — Phase-split the server pipeline.** Refactor `sendMessage` internals ([chat.ts](src/actions/chat.ts)) into pure-ish phase functions each returning `TurnPart`s: `interpretPhase` (fast-path or LLM → `filter-plan` part), `executePhase` (RPCs → `result-set` part), `followupsPhase` (→ `followups` part). The server action still assembles the parts into one response (no streaming yet) — client renders from parts via the T-35 mapper's inverse. DB persistence (`chat_messages`) unchanged. _Done when:_ server action returns `TurnPart[]`; fast-path, refine mode, image-as-prompt, and embedding parallelization all still pass existing integration tests.

**T-42 — Streaming route handler.** New `src/app/api/chat/route.ts`: POST, auth via existing Supabase SSR helpers, runs the T-41 phases and **streams each part as it resolves** using the AI SDK UI message stream protocol (`ai` package, `createUIMessageStream` + custom data parts; **not** `streamText` — the Gemini pipeline is invoked as-is). Emits `status` parts between phases (`interpreting` → `searching` → done). Persists user/assistant messages exactly as today. Fallback noted: hand-rolled SSE with the same part frames if the `ai` dependency is rejected. _Done when:_ `curl -N` against the route shows the plan frame arriving before the result frame on an LLM-path query; fast-path queries still complete in one flush; messages persist identically.

**T-43 — Client streaming transport.** New `use-turn-transport.ts` consuming the stream (`readUIMessageStream` or a ~40-line reader), feeding parts into the T-34 status machine: `submitted` on POST, `streaming` on first frame, parts applied incrementally (filter chips appear before the grid repacks; followups last), `idle`/`error` on close. Replace the "thinking…" pulse with the real phase label from `status` parts. Delete the server-action send path once parity is confirmed (`getLastRollState` restore stays a server action — it's not LLM contact). _Done when:_ a slow LLM query visibly shows plan chips before results arrive; `rg "sendMessage"` shows no client callsites of the old action; restore-on-mount unchanged.

**T-44 — Abort + error affordances.** Wire `AbortController` through the transport; `PromptInputSubmit` shows the Elements-style stop state while `submitted/streaming` and cancels on click; aborted turns return to `idle` with state intact; `error` parts render the T-34 inline error with a retry suggestion. _Done when:_ mid-stream cancel leaves the previous result set untouched; a forced 500 shows the inline error + retry; no unhandled rejection in console.

**T-45 — E2E + telemetry for the streamed turn.** Update `command-center.e2e.ts` for the new DOM (compound input, suggestions primitive, phase label); add one e2e asserting progressive arrival (plan chip visible before grid mutation on an LLM-path query); extend the T-11 telemetry log line with `transport=stream` + per-phase timings; verify `prefers-reduced-motion` and mobile safe-area behavior survived the recomposition. _Done when:_ e2e suite green on the chat blocks; telemetry distinguishes fast-path/LLM/stream phases.

### Files touched (summary)

- New: `src/components/prompt-input/*` (5–6 files), `src/components/chat/turn-parts.ts`, `src/components/chat/use-turn.ts`, `use-selection.ts`, `use-darkroom.ts`, `use-turn-transport.ts`, `src/app/api/chat/route.ts`, `plan/tasks_june_2026.md`
- Modified: `src/components/chat/chat-interface.tsx` (shrinks), `src/actions/chat.ts` (phase split; send path eventually removed), `src/lib/gemini/query.ts` (phase boundaries only), `tests/e2e/command-center.e2e.ts`, unit tests
- Dependency: `ai` (stream protocol helpers only) — added at T-42, not before
- Existing utilities reused: `formatChipLabel` (filter-chips.logic.ts), `deriveFollowups` (query.validate.ts), `tryFastPath`, motion tokens in `globals.css`, Supabase SSR auth helpers

## Verification

This plan's only execution step is writing `plan/tasks_june_2026.md` — verify by reading the file: every task has ID/Status/Order/Effort/Depends-on/Sub-tasks/Done-when; the dependency table is topologically ordered (no task depends on a later one); lanes A/B/C/D parallelization is stated. The per-task "Done when" lines above define how each task is verified when implemented (unit tests, `curl -N` stream check, e2e blocks, `rg` audits).
