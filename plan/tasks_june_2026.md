# Hypermood — Tasks (June 2026): Generative-UI alignment via AI SDK Elements

> Goal: rebuild the chat input, suggestions, and every LLM-contact surface on **AI SDK Elements** (https://elements.ai-sdk.dev/) and the AI SDK runtime, so the interface follows the current generative-UI patterns (status-driven prompt input, attachments, suggestions, streamed typed parts) instead of hand-rolled equivalents.

## Decisions (locked)

- **Elements is the dependency.** Components are installed from the Elements registry (they vendor as source into `src/components/ai-elements/`, built on shadcn/ui primitives).
- **AI SDK runtime for LLM contact.** `ai` + `@ai-sdk/react` on the client (`useChat` + UI message stream protocol); the server streams typed data parts from a route handler. The existing Gemini pipeline (regex fast-path, embedding parallelization, context caching, RPCs) is **kept intact** underneath — `streamText` is not adopted; the route hand-builds the stream with `createUIMessageStream`.
- **Streaming is in scope.** A turn streams phases: interpreted plan → result set → followups, with real status between them.
- **No conversation thread.** Assistant output stays transient (result grid is the response); `getLastRollState` restore-on-mount stays. Elements' `Conversation`/`Message` components are not installed.
- **Out of scope:** result grid / masonry, galleries, darkroom, vision indexing, anything not touching the input bar or the LLM round-trip.

## How to use this file

Checklist of concrete tasks **ordered by dependency** — no task depends on a later one. Each task is **small**, has a **Verify** line, and is **independent where possible**: `[P]` = parallelizable with its lane neighbours once its `Depends:` are done; `[S]` = skippable without blocking the chain.

## Execution order at a glance

| Order | ID   | Title                                              | Depends    | Status |
| ----- | ---- | -------------------------------------------------- | ---------- | ------ |
| 1     | E-01 | Install AI SDK runtime packages                    | —          | todo   |
| 2     | E-02 | Init shadcn/ui; map theme tokens to Hypermood      | —          | todo   |
| 3     | E-03 | Install Elements components from the registry      | E-02       | todo   |
| 4     | E-04 | Restyle pass: Elements → Hypermood design language | E-03       | todo   |
| 5     | E-05 | Define typed turn parts (wire schema)              | —          | todo   |
| 6     | E-06 | Phase-split the server turn pipeline               | E-05       | todo   |
| 7     | E-07 | Streaming route handler `/api/chat`                | E-01, E-06 | todo   |
| 8     | E-08 | Client transport: `useChat` wired to the route     | E-07       | todo   |
| 9     | E-09 | Swap input bar to Elements `PromptInput`           | E-04, E-08 | todo   |
| 10    | E-10 | Selection strip → Elements `Attachments`           | E-09       | todo   |
| 11    | E-11 | Followups + idle prompt → Elements `Suggestion`    | E-09       | todo   |
| 12    | E-12 | Status & error surfaces (`Loader`, inline error)   | E-08       | todo   |
| 13    | E-13 | Stop/abort + retry affordances                     | E-09, E-12 | todo   |
| 14    | E-14 | Delete the legacy send path + dead code            | E-09–E-12  | todo   |
| 15    | E-15 | E2E + telemetry + a11y pass on the new surface     | E-14       | todo   |

Parallel lanes after E-01/E-02 land: **UI lane** (E-03 → E-04) and **server lane** (E-05 → E-06 → E-07) can run simultaneously; they join at E-08/E-09.

---

## E-01 — Install AI SDK runtime packages `[P]`

- **Depends:** —
- [ ] `pnpm add ai @ai-sdk/react`
- [ ] Confirm versions are current at install time; pin in `package.json`.
- [ ] No `@ai-sdk/google` yet — the Gemini calls stay on `@google/genai` (the route hand-builds the stream). Add only if a later task adopts AI SDK model calls. `[S]`

**Verify:** `pnpm build` and `pnpm test` pass with the new deps installed and unused.

## E-02 — Init shadcn/ui; map theme tokens to Hypermood `[P]`

- **Depends:** —
- [ ] `pnpm dlx shadcn@latest init` (Tailwind 4 / CSS-variables mode). Elements components require shadcn primitives.
- [ ] Map shadcn theme variables in [globals.css](../src/app/globals.css) to the existing palette: `--background`/`--foreground`/`--muted`/etc. → the `primary-*` zinc scale; `--radius` → `0.75rem` (the `rounded-xl` surface radius); font stack → Diatype.
- [ ] Keep the three-radii rule: audit that generated tokens don't reintroduce `rounded-sm/2xl/3xl` (T-23 invariant: `rg "rounded-(3xl|2xl|sm)"` in `src/` stays zero).
- [ ] Wire shadcn transition durations to `--motion-micro` where the generated CSS hardcodes durations.

**Verify:** a scratch-rendered shadcn `Button` visually matches Hypermood (Diatype, zinc palette, correct radius); `rg "rounded-(3xl|2xl|sm)" src/` returns zero; `tsc` clean.

## E-03 — Install Elements components from the registry

- **Depends:** E-02
- [ ] `pnpm dlx ai-elements@latest add prompt-input suggestion attachments loader` (registry: https://registry.ai-sdk.dev). Components vendor into `src/components/ai-elements/`.
- [ ] Do **not** install `conversation`, `message`, `response`, `reasoning`, `sources` — no-thread decision.
- [ ] Accept the transitive shadcn primitives the CLI pulls (button, textarea, dropdown-menu, tooltip, hover-card as needed) and `lucide-react` icons.
- [ ] Commit the vendored source as-is (one commit) **before** restyling, so E-04's diff is reviewable.

**Verify:** `tsc` clean; each installed component renders in isolation (scratch page or vitest smoke render); vendored files live under `src/components/ai-elements/`.

## E-04 — Restyle pass: Elements → Hypermood design language

- **Depends:** E-03
- [ ] `PromptInput`: strip card chrome to match the T-02 "one quiet input" bar — no heavy border, no backdrop blur; container radius `rounded-xl`; bottom-anchored; iOS safe-area padding preserved (`pb-[max(1.25rem,env(safe-area-inset-bottom))]`).
- [ ] `Suggestion` pills: `rounded-full`, `text-sm`, `primary-500` text, `animate-swiss` hover (micro token).
- [ ] `Attachments` (inline variant): thumbnails `rounded-none` (content rule), remove-on-hover, dissolve via `--motion-micro`.
- [ ] `Loader`: replace with the quiet `animate-pulse` line styling (no spinner chrome).
- [ ] All arrival animations use `animate-reveal`; honour `prefers-reduced-motion` (tokens already collapse to 0ms).
- [ ] Casing/copy pass: sentence case, editorial voice, `pluralize` from [src/lib/format.ts](../src/lib/format.ts) for any counts.

**Verify:** side-by-side with the current input bar shows no design-language regressions (radii, type, motion); reduced-motion shows no animation; `rg "rounded-(3xl|2xl|sm)" src/` still zero.

## E-05 — Define typed turn parts (wire schema) `[P]`

- **Depends:** —
- [ ] New `src/lib/chat/turn-parts.ts`: discriminated union matching AI SDK custom data parts — `data-filter-plan { plan: QueryPlan }`, `data-result-set { imageIds: string[], total: number }`, `data-followups { items: string[] }`, `data-note { text: string }` (clarification_note), plus transient status parts for phases `interpreting | searching | done`.
- [ ] Type the UIMessage generic (`UIMessage<never, TurnDataParts>`) so client and server share one schema.
- [ ] Pure mapper `toTurnParts(result: SendMessageResult): TurnPart[]` + unit test (round-trips every field incl. `interpretedFilter: null` for image-as-prompt).

**Verify:** `pnpm test` green on the new unit test; `tsc` clean; no runtime change.

## E-06 — Phase-split the server turn pipeline

- **Depends:** E-05
- [ ] Refactor `sendMessage` internals in [src/actions/chat.ts](../src/actions/chat.ts) into phase functions, each returning parts: `interpretPhase` (fast-path or LLM → `data-filter-plan`), `executePhase` (RPCs → `data-result-set`), `followupsPhase` (→ `data-followups`).
- [ ] Keep intact: `tryFastPath` short-circuit, refine-mode filter merge, image-as-prompt branch, mid-stream embedding parallelization (`embeddingPromise` handoff), context caching, telemetry log lines.
- [ ] DB persistence of `chat_messages` (user + assistant rows with `result_image_ids`, `interpreted_filter`) unchanged — extracted to a `persistTurn` function callable from either transport.
- [ ] The server action keeps working during this task (it assembles the parts into the old `SendMessageResult` shape via an adapter) so the app never breaks mid-migration.

**Verify:** existing unit/integration tests pass; manual turn in the running app behaves identically; telemetry still distinguishes `fast_path_hit|llm|fallback`.

## E-07 — Streaming route handler `/api/chat`

- **Depends:** E-01, E-06
- [ ] New `src/app/api/chat/route.ts` (POST): Supabase SSR auth (reuse existing helpers), body `{ rollId, text, referenceImageIds?, activeFilters?, refineMode }`.
- [ ] Build the response with `createUIMessageStream` / `toUIMessageStreamResponse` from `ai`: write a transient status part (`interpreting`), await `interpretPhase`, write `data-filter-plan`, status (`searching`), await `executePhase`, write `data-result-set`, then `data-followups` + `data-note`, then finish.
- [ ] Fast-path turns may resolve all phases in one flush — fine; the protocol stays identical.
- [ ] Call `persistTurn` before the stream closes; errors stream as the protocol's error part, never a hung connection.

**Verify:** `curl -N` an LLM-path query → `data-filter-plan` frame observably arrives before `data-result-set`; a fast-path query completes <500ms; `chat_messages` rows identical to the server-action path; aborted request leaves no orphan DB rows.

## E-08 — Client transport: `useChat` wired to the route

- **Depends:** E-07
- [ ] In [use-chat-state.ts](../src/components/chat/use-chat-state.ts): replace the `sendMessage` server-action call with `useChat` from `@ai-sdk/react` (`DefaultChatTransport` → `/api/chat`, typed with the E-05 generic; `prepareSendMessagesRequest` injects `rollId`/`refineMode`/`activeFilters`/`referenceImageIds`).
- [ ] Consume parts incrementally (`onData` / last-message parts): `data-filter-plan` → `activePlan`, `data-result-set` → `resultImageIds` (filtered against `liveImages`, preserving the T-20 drift fix), `data-followups` → `followups`.
- [ ] Replace `sending`/`processing` booleans with `useChat`'s `status` (`submitted | streaming | ready | error`) — single source of truth.
- [ ] No thread: messages array is not rendered; it's transport state only. Mount restore stays on `getLastRollState`.

**Verify:** on a slow LLM query the filter chips appear **before** the grid repacks; refine mode, image-as-prompt, and selection-clear-on-result-change all behave as before; `tsc` clean.

## E-09 — Swap the input bar to Elements `PromptInput`

- **Depends:** E-04, E-08
- [ ] Replace the hand-rolled bottom bar in [chat-interface.tsx](../src/components/chat/chat-interface.tsx) with the restyled `PromptInput` + `PromptInputTextarea` + toolbar + `PromptInputSubmit`.
- [ ] `PromptInputSubmit` driven by `useChat` status (idle → send, submitted/streaming → stop, error → retry icon).
- [ ] Refine toggle moves into the PromptInput toolbar slot; behaviour unchanged (`Refining within N results`).
- [ ] Keyboard parity: Enter submits, Shift+Enter newline; focus management unchanged.
- [ ] `chat-interface.tsx` shrinks to layout/orchestration only (<200 lines).

**Verify:** command-center e2e input block passes (update selectors as needed); visual parity per E-04; `wc -l` on chat-interface.tsx < 200.

## E-10 — Selection strip → Elements `Attachments` `[P with E-11, E-12]`

- **Depends:** E-09
- [ ] Replace `SelectionStrip` with `Attachments` (inline variant): each selected library image is an attachment (`FileUIPart`-shaped: ImageKit thumb URL as preview), remove per item, explicit Clear.
- [ ] Selected-image IDs keep flowing to the turn as `referenceImageIds` (image-as-prompt) via E-08's request prep.
- [ ] Strip dissolves when empty; horizontal scroll on mobile preserved.

**Verify:** select 2 images → thumbnails render in the bar → send → image-as-prompt search runs (no `interpretedFilter`); remove/Clear work; e2e selection block green.

## E-11 — Followups + idle prompt → Elements `Suggestion` `[P with E-10, E-12]`

- **Depends:** E-09
- [ ] Render `followups` through `Suggestions`/`Suggestion` (horizontal scrollable pills under the input); click submits via the E-08 transport.
- [ ] The selection-idle prompt ("Find images similar to these — or type to refine.") becomes a `Suggestion` too — delete the bespoke ghost-line JSX and its timer wiring stays in the hook.
- [ ] Suggestions hidden while `status !== 'ready'`.

**Verify:** followup chips render and submit; idle prompt appears after 2+ selected and 3s, as a suggestion pill; no bespoke ghost-line markup remains (`rg` for the old class/string).

## E-12 — Status & error surfaces `[P with E-10, E-11]`

- **Depends:** E-08
- [ ] Replace the static "thinking…" pulse with the restyled `Loader` showing the **real** streamed phase (`interpreting…` / `searching…`) from transient status parts.
- [ ] Surface `status === 'error'` as a quiet inline line above the input (`text-semantic-alert`) with the error message — currently errors reset silently.
- [ ] `ActiveFilterLine` keeps living on the result surface; only its data source moves to the streamed parts.

**Verify:** phase label visibly changes on an LLM-path turn; forced 500 from the route shows the inline error; no fake/staggered progress anywhere (T-12 honesty rule).

## E-13 — Stop/abort + retry affordances

- **Depends:** E-09, E-12
- [ ] Wire `useChat().stop()` to `PromptInputSubmit`'s stop state; aborting returns status to `ready` with the previous result set untouched.
- [ ] Server: handle `req.signal` abort in the route — stop phase execution, don't persist a half-turn.
- [ ] Error state offers one-click retry (re-submit last input) via the submit button's error icon.

**Verify:** cancel mid-stream → previous grid intact, no console rejection; retry after a forced error re-runs the same text; no orphan `chat_messages` rows after abort.

## E-14 — Delete the legacy send path + dead code

- **Depends:** E-09, E-10, E-11, E-12
- [ ] Remove the `sendMessage` server action's client path (and `rerunWithModifiedFilters` if E-08 routed filter-modify through the transport; otherwise keep and note). `getLastRollState` + `getChatHistory` stay.
- [ ] Delete superseded hand-rolled UI: old input JSX, `SelectionStrip`, bespoke suggestion/ghost-line code, the `animate-pulse` thinking line.
- [ ] `rg` audit: no dual code paths for sending a turn remain.

**Verify:** `rg "sendMessage\(" src/components` returns zero client callsites; `pnpm build` + full unit suite green; app works end-to-end via the stream only.

## E-15 — E2E + telemetry + a11y pass

- **Depends:** E-14
- [ ] Update `tests/e2e/command-center.e2e.ts` selectors for the Elements DOM (prompt input, suggestion pills, attachments, phase label).
- [ ] New e2e: progressive arrival — on an LLM-path query, assert the filter chip is visible before the result grid mutates.
- [ ] New e2e: abort flow (stop button mid-turn leaves previous results).
- [ ] Extend the T-11 telemetry line with `transport=stream` + per-phase timings; confirm fast-path hit-rate logging survived.
- [ ] A11y: keyboard-only turn (focus input → type → submit → suggestions reachable); `prefers-reduced-motion` shows no animation; mobile safe-area + full-width input verified.
- [ ] Bundle check: `next build` output — note the size delta from Elements/shadcn/lucide; tree-shake unused primitives.

**Verify:** chat-related e2e blocks green; telemetry distinguishes fast-path/LLM and per-phase timing; axe/Lighthouse a11y ≥95 on the command center.

---

## Dependency notes

- **Vendored, not boxed in:** Elements installs as source (shadcn registry model) — restyling and future divergence are normal, not forks of a node_module.
- **The Gemini pipeline is load-bearing.** Fast-path, embedding parallelization, and context caching are why turns are fast; E-06/E-07 wrap them, never replace them. Revisit `@ai-sdk/google` only if unifying model calls under the AI SDK becomes worth it later. `[S]`
- **No-thread invariant:** if a future task wants history UI, it goes through cmd-k, not a `Conversation` surface.
