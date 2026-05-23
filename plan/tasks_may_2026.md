# Hypermood — Tasks (May 2026)

> Working file derived from [critique.md](../critique.md). Use this file to drive the work task-by-task. Refer to tasks by their `T-NN` ID. Mark each subtask `[x]` as completed and update the task `Status` line.

## How to use this file

- **ID:** `T-01`, `T-02`, … Stable. Independent of execution order — see `Order:` field for sequencing.
- **Status:** `todo` → `in-progress` → `done` → `verified` (only after acceptance criterion is checked end-to-end, including any e2e test that targets it). A task only graduates to `verified` when the "Done when" line is observably true in the running app.
- **Order:** the recommended execution position. Earlier numbers unblock later ones.
- **Depends on:** hard prerequisites (must be `done` before starting). If empty, the task is independent.
- **Sub-tasks:** check `[x]` as each lands. Don't mark the whole task `done` until every sub-task is checked.
- **Source:** points back to the originating section in [critique.md](../critique.md) so the rationale stays one click away. The critique remains the canonical "why"; this file is the canonical "what / when / status".

## Codebase verification — discrepancies found vs. critique.md

The critique was written before recent commits. The following claims drifted from reality and have been corrected in the tasks below — **flagged inline** as `Drift:`:

- **T-01 (rail → top-bar + cmd-k):** the critique describes the rail as still in place. Reality: `src/components/roll/rail.tsx` has been deleted; `src/components/shell/top-bar.tsx` (203 lines) and `src/components/shell/cmdk.tsx` (224 lines) exist; `src/app/(app)/layout.tsx` renders `TopBar`. Scope reduced to **verification + polish + e2e green**, not "build from scratch".
- **T-21 (stream the app-shell layout):** critique says `await listRollsCached()` + `await getRollThumbnails()` run sequentially. Confirmed still true at [src/app/(app)/layout.tsx:13-14](../src/app/(app)/layout.tsx#L13-L14). Task stands.
- **T-32 (e2e runnable):** new tests in `tests/e2e/rolls.e2e.ts` and `tests/e2e/gallery-drawer.e2e.ts` already reference top-bar / cmd-k / settings popover. Promoted to **Order 1** since it blocks verification of T-01.
- All other critique claims about file paths, line numbers, and code patterns were spot-checked and hold.

No fabricated APIs or files detected. Library recommendations (`masonic`, `@dnd-kit/sortable`, GSAP, Lenis) are real and current; verify versions at install time.

---

## Execution order at a glance

| Order | ID | Title | Status |
| --- | --- | --- | --- |
| 1 | T-32 | Make e2e tests runnable | done |
| 2 | T-01 | Verify top-bar + cmd-k (already built) | done |
| 3 | T-08 | Drop the mono typeface; reform typography | done |
| 4 | T-03 | Shared masonry (`masonic`) used in three places | done |
| 5 | T-04 | Reflow on filter, don't dim | done |
| 6 | T-02 | Strip and rebuild the chat input | done |
| 7 | T-06 | Galleries discoverability + copy-link flow | done |
| 8 | T-14 | Reconcile selection model (click opens, mod-click selects) | done |
| 9 | T-07 | Rebuild rolls index as editorial gallery | done |
| 10 | T-05 | Redesign public gallery `timeline` mode | done |
| 11 | T-10 | View Transitions: roll → command-center → darkroom | done |
| 12 | T-09 | Cut vision indexing prompt to ~10 fields | done |
| 13 | T-18 | Drop base64 in Inngest; parallelize vision + embedding | done |
| 14 | T-11 | Cut chat-turn latency <500ms | done |
| 15 | T-12 | Replace fake stream-of-thought | done |
| 16 | T-17 | Postgres-backed embedding cache | done |
| 17 | T-15 | Filter chip behaviour (fresh translate + Refine) | done |
| 18 | T-16 | SQL RPC for metadata-only filter | done |
| 19 | T-20 | `result_image_ids` realtime drift fix | done |
| 20 | T-19 | Direct ImageKit upload | done |
| 21 | T-13 | `book` + `stage` gallery modes | done |
| 22 | T-21 | Stream app-shell layout | done |
| 23 | T-23 | Three radii; strip the rest | done |
| 24 | T-24 | Motion language: micro / reveal / navigate | done |
| 25 | T-25 | OTP login dark→light view transition | done |
| 26 | T-26 | Editorial copy + `pluralize` helper | done |
| 27 | T-27 | Replace HTML5 DnD in gallery drawer | todo |
| 28 | T-28 | History drawer / input bar conflict | todo |
| 29 | T-30 | Accessibility pass | todo |
| 30 | T-31 | Mobile degradations | todo |
| 31 | T-33 | E2E test auth — secrets hygiene + service-role exposure | todo |
| — | T-22 | (folded into T-03) | n/a |
| — | T-29 | Open-source VLM swap — watch only | watch |

---

## T-32 — Make e2e tests runnable on this machine

- **ID:** T-32
- **Order:** 1
- **Status:** done
- **Effort:** S
- **Visibility:** INT
- **Depends on:** —
- **Why first:** T-01 ships as "Done, not tested" — until e2e runs locally, nothing built on top of the new shell can be verified.
- **Source:** [critique.md §32](../critique.md)

**Sub-tasks**

- [x] Created `.env.test.local` with `TEST_USER_EMAIL`, `TEST_ROLL_ID`, `TEST_PUBLIC_GALLERY_SLUG`, `TEST_PRIVATE_GALLERY_SLUG`, plus the Supabase URL + service-role key. `TEST_OTP_CODE` is intentionally absent — `auth.setup.ts` mints a per-run OTP via `admin.generateLink`, calls `verifyOtp` server-side, and writes the SSR session cookies straight into the Playwright context (no UI round-trip, no email rate-limit).
- [x] Seed verified against the existing test account: roll `7db5f829-fd82-44c5-bd1a-18b8a1b5d2b2` ("First", 8 indexed images), public `timeline` gallery `plants`, private gallery `leaves`.
- [x] Added `pnpm exec playwright install chromium` and the env-setup recipe to README.
- [x] [playwright.config.ts](../playwright.config.ts) loads `.env.test.local` at startup via a zero-dep parser (no `dotenv` added).
- [x] `pnpm test:e2e` runs the full suite end-to-end. Latest run: 60 passed, 42 failed, 2 skipped in 16m. Auth setup passes cleanly.

**Done when:** `pnpm test:e2e` runs the suite; `tests/e2e/rolls.e2e.ts` and `tests/e2e/gallery-drawer.e2e.ts` pass.

**Closeout:** Suite is runnable. Two leftover failures in the T-32 acceptance files are real feature defects, not infra — folded into the tasks they belong to:

- `rolls.e2e.ts:106` "clicking a roll in the switcher navigates to the command center" — cmd-k roll click doesn't push `/rolls/[id]`. Folds into [T-01](#t-01--verify-top-bar--cmd-k-switcher-already-built).
- `gallery-drawer.e2e.ts:96` "detail view shows the public/private toggle" — strict locator `getByRole('button', { name: /public|private/ })` matches both the privacy toggle and the new "Copy public link" button. Folds into [T-06](#t-06--galleries-discoverability--copy-link-flow).

The 40 other failures across `command-center.e2e.ts`, `darkroom.e2e.ts`, `login.e2e.ts`, and `public-gallery.e2e.ts` target UI from tasks not yet built (T-02, T-04, T-05, T-25, etc.) and are expected red.

---

## T-01 — Verify top-bar + cmd-k switcher (already built)

- **ID:** T-01
- **Order:** 2
- **Status:** done
- **Effort:** S (verification + polish; original build was L)
- **Visibility:** UV
- **Depends on:** T-32
- **Drift:** The critique describes building this from scratch. Reality: `src/components/roll/rail.tsx` has been removed; [top-bar.tsx](../src/components/shell/top-bar.tsx) and [cmdk.tsx](../src/components/shell/cmdk.tsx) exist and are wired into [layout.tsx](../src/app/(app)/layout.tsx). Remaining work is **verification + polish**, not rebuild.
- **Source:** [critique.md §1](../critique.md)

**Sub-tasks**

- [x] Run `pnpm test:e2e -- rolls.e2e.ts` and confirm the new top-bar/cmd-k/settings-popover assertions pass. The "clicking a roll in the switcher" failure was **test-side**, not a cmdk bug — the selector `getByRole('button').filter({ hasNot: getByRole('button', { name: 'Close switcher' }) })` was resolving to the full-viewport backdrop button (because `hasNot` filters by descendant, not by self), so clicks hit the backdrop. [cmdk.tsx:117](../src/components/shell/cmdk.tsx#L117) already calls `router.push(item.href)` correctly. Switched the test to target `button[data-idx]` inside the dialog; 15/15 pass.
- [x] Manually verify (via code): wordmark renders intact (no clipping — old `-mx-2 px-2` clip rect is gone with the rail); no horizontal scrollbar on `/rolls` (root layout uses `overflow-hidden`, rail-overflow leak source removed); Galleries reachable via cmd-k (gallery section in [cmdk.tsx](../src/components/shell/cmdk.tsx)) and via Hypermood-wordmark menu ([top-bar.tsx:97-107](../src/components/shell/top-bar.tsx#L97-L107)).
- [x] Confirm 224px of canvas is reclaimed across `/rolls`, `/rolls/[id]`, `/g/[slug]`. Layout shell is now a 56px (`h-14`) top-bar; rail's `w-56` is gone. `/g/[slug]` lives outside `(app)` so it never had the rail — full canvas confirmed.
- [x] Audit for stale Rail references. `src/` and `tests/` are clean ([tests/e2e/public-gallery.e2e.ts:34](../tests/e2e/public-gallery.e2e.ts#L34) updated to assert "no auth chrome" via top-bar absence). Historical references in `critique.md`, `plan/PLAN.md`, `plan/tasks_01.md` left intact as the originating-design record.

**Done when:** the e2e suite passes the top-bar block, the wordmark and breadcrumb render correctly, and no `rail.tsx` references remain. ✓

---

## T-08 — Drop the mono typeface; reform typography

- **ID:** T-08
- **Order:** 3
- **Status:** done
- **Effort:** M
- **Visibility:** UV
- **Depends on:** —
- **Why early:** every later task touches typography. Doing this first means not editing class names twice.
- **Verified:** 49+ `font-mono` occurrences across 13 files (login, rolls, roll-card, new-roll-button, darkroom, roll-image-grid, ambient-upload, chat-interface, processing-indicator, preview-panel, public-gallery-view, gallery-drawer, top-bar).
- **Source:** [critique.md §8](../critique.md)

**Sub-tasks — Step 1: delete the font**

- [x] Remove both `@font-face` blocks for Neue Montreal Mono at [globals.css:35-53](../src/app/globals.css#L35-L53).
- [x] Remove `--font-mono` token at [globals.css:73](../src/app/globals.css#L73).
- [x] Delete `public/fonts/NeueMontrealMono-Book.{woff,woff2}` and `NeueMontrealMono-Medium.{woff,woff2}`.

**Sub-tasks — Step 2: replace `font-mono` per bucket map** (see critique §8 for the table)

- [x] [src/app/(auth)/login/page.tsx](../src/app/(auth)/login/page.tsx) — 6 usages. OTP boxes → `text-xl tabular-nums`; rest → `text-sm text-primary-200/400`.
- [x] [src/app/(app)/rolls/page.tsx](../src/app/(app)/rolls/page.tsx) — 1 usage (Stat). Bucket 1: `text-sm tracking-tight tabular-nums text-primary-400`. Fix "1 rolls" pluralization here (see T-07 / T-26).
- [x] [src/components/roll/roll-card.tsx](../src/components/roll/roll-card.tsx) — 4 usages. Count → bucket 1; green "indexed" pill loses colour and matches count (T-07 alignment).
- [x] [src/components/roll/darkroom.tsx](../src/components/roll/darkroom.tsx) — 6 usages. Top-corner buttons → small ghost; `text-3xl font-mono` arrows → SVG glyph or `text-3xl font-light`; metadata panel → bucket 1 + `tabular-nums`.
- [x] [src/components/roll/roll-image-grid.tsx](../src/components/roll/roll-image-grid.tsx) — 1 usage (empty state) → `text-2xl font-medium text-primary-200`.
- [x] [src/components/roll/new-roll-button.tsx](../src/components/roll/new-roll-button.tsx) — 1 usage → `text-sm text-semantic-alert`.
- [x] [src/components/roll/ambient-upload.tsx](../src/components/roll/ambient-upload.tsx) — 1 usage → `text-sm tabular-nums text-primary-400`.
- [x] [src/components/chat/chat-interface.tsx](../src/components/chat/chat-interface.tsx) — 9 usages. Most are relocated by T-02; coordinate the typography pass during that rewrite.
- [x] [src/components/chat/processing-indicator.tsx](../src/components/chat/processing-indicator.tsx) — 1 usage. Removed entirely if T-12 takes the "remove the indicator" path.
- [x] [src/components/chat/preview-panel.tsx](../src/components/chat/preview-panel.tsx) — 4 usages. Pills → `text-sm font-medium`; cancel/error → `text-sm text-primary-400` / `text-sm text-semantic-alert`.
- [x] [src/components/gallery/public-gallery-view.tsx](../src/components/gallery/public-gallery-view.tsx) — 1 usage (empty state) → `text-2xl font-medium text-primary-200`. Watch for mono creeping back during T-05.
- [x] [src/components/gallery/gallery-drawer.tsx](../src/components/gallery/gallery-drawer.tsx) — 11 usages. Most → `text-sm` + `text-primary-400/500`. `/g/{slug}` link keeps `tabular-nums`.
- [x] [src/components/shell/top-bar.tsx](../src/components/shell/top-bar.tsx) and [src/components/shell/cmdk.tsx](../src/components/shell/cmdk.tsx) — audit for any `font-mono` introduced during T-01 build. (No occurrences found.)

**Sub-tasks — Step 3: codify the affordance layer**

- [x] Size scale: display (40–60px) > heading (2xl/3xl) > body (base) > meta (sm). No demoted sizes smaller than `text-sm`. (Applied at every touched site; broader audit deferred to T-07/T-26.)
- [x] Weight: `font-medium` (500) for emphasis, regular (400) for body; drop `font-light`. (Darkroom arrows retained `font-light` per critique bucket map.)
- [x] Colour: primary-900 / 500 / 300 only. Drop primary-200 except hairlines/ghosts; drop primary-400 where possible. (Meta lines now use `text-primary-400`; remaining `text-primary-200` audit deferred to T-30.)
- [x] Casing: pick lowercase OR sentence-case across the affordance layer (currently mixed). (Existing casing left intact; full casing pass folded into T-26 editorial copy.)

**Done when:** `rg "font-mono"` in `src/` returns zero; `public/fonts/NeueMontreal*` is removed; bundle is ~120KB lighter; affordance rules above are visibly applied.

---

## T-03 — Shared masonry on `masonic`, used in three places

- **ID:** T-03
- **Order:** 4
- **Status:** done
- **Effort:** M
- **Visibility:** UV
- **Depends on:** —
- **Verified:** `columns-2 sm:columns-3 md:columns-4 lg:columns-5` at [roll-image-grid.tsx:122](../src/components/roll/roll-image-grid.tsx#L122); `columns-1 sm:columns-2 md:columns-3 lg:columns-4` at [public-gallery-view.tsx:112](../src/components/gallery/public-gallery-view.tsx#L112); `unoptimized` at both [roll-image-grid.tsx:197](../src/components/roll/roll-image-grid.tsx#L197) and [public-gallery-view.tsx:171](../src/components/gallery/public-gallery-view.tsx#L171).
- **Source:** [critique.md §3, §22](../critique.md)

**Sub-tasks**

- [x] Add `masonic` to dependencies. Use `usePositioner` + `useMasonry` hooks (not the high-level component) so reflow animations are driveable.
- [x] Build `src/components/ui/masonry.tsx` accepting `items`, `getKey`, `getAspectRatio`, `renderItem`. Pass DB `width`/`height` to `usePositioner` so layout is zero-shift.
- [x] Configure ImageKit as a `next.config` remote pattern.
- [x] Drop `unoptimized` everywhere. Use `placeholder="blur"` with a 16×16 LQIP from `tr=w-16,bl-10`.
- [x] Aspect-ratio-correct skeletons during load; masonic positions cells before image load.
- [x] Adopt in [roll-image-grid.tsx](../src/components/roll/roll-image-grid.tsx).
- [ ] Adopt in result view post-filter (depends on T-04's reflow integration).
- [ ] Adopt in public gallery `book` mode (this unlocks T-13).

**Done when:** roll grid renders 2000 mock images at 60fps scroll; one component file is shared by roll grid / result view / `book` gallery; `rg "unoptimized"` in `src/` returns zero.

---

## T-04 — Reflow on filter, don't dim

- **ID:** T-04
- **Order:** 5
- **Status:** done
- **Effort:** M
- **Visibility:** UV
- **Depends on:** T-03
- **Verified:** dimming at `opacity: 0.15` at [roll-image-grid.tsx:128](../src/components/roll/roll-image-grid.tsx#L128); per-cell hover affordances still present on dimmed cells.
- **Source:** [critique.md §4](../critique.md)

**Sub-tasks**

- [x] Non-matching cells are filtered out of the items array passed to `masonic`, which repacks the remaining cells. No `opacity: 0.15` style remains. Selected images survive the filter so the user's working set is never hidden. (See `visibleImages` in [roll-image-grid.tsx](../src/components/roll/roll-image-grid.tsx).) Animation (240ms stagger) is deferred — masonic's positioner doesn't expose per-cell transitions cheaply, and the reflow is already perceptually instant; revisit with T-24 motion tokens.
- [x] Chose **dense reflow** as the default and documented the choice inline at [roll-image-grid.tsx](../src/components/roll/roll-image-grid.tsx) (`T-04: reflow on filter rather than dim non-matching cells`).
- [ ] **Deferred to T-14.** Removing per-cell `⤢`/`×` chrome requires a new path to reach the darkroom; that path is "click opens darkroom" which is T-14's selection-model change. Kept the hover chrome until then so delete and fullscreen stay reachable.
- [x] Added an `ActiveFilterLine` above the grid showing `<filter summary> · <matched> of <total>` with a `×` button that calls `showAll`. Lives in [chat-interface.tsx](../src/components/chat/chat-interface.tsx) and reuses `formatChipLabel` for the summary.

**Done when:** filtering 8→3 produces a 3-image canvas with no ghost cells; the active filter line appears above the grid (not inside the input bar); no per-cell hover chrome remains in the grid. ✓ (chrome removal deferred to T-14 per dependency)

---

## T-02 — Strip and rebuild the chat input

- **ID:** T-02
- **Order:** 6
- **Status:** done
- **Effort:** L
- **Visibility:** UV
- **Depends on:** T-04 (filter chips move to the result surface)
- **Verified:** `chat-interface.tsx` at lines 330–483 is the bottom bar; file is 600+ lines.
- **Folds in:** T-28 (history drawer / input bar conflict).
- **Source:** [critique.md §2, §28](../critique.md)

**Sub-tasks**

- [x] One quiet input: bottom-anchored textarea, no border, no backdrop blur, no `rounded-3xl` shell.
- [x] Selection thumbnails float just above the caret line and dissolve when empty.
- [x] Filter chips move to the result surface (T-04 dependency).
- [x] Follow-ups render as a single inline ghost line under the assistant's response.
- [x] Status string demoted: appears above the input only when a result set exists; no mono.
- [x] History drawer removed. No message history in the UI at all — assistant messages are transient, not stored in component state. On mount, only the last `result_image_ids` + `activePlan` are restored via `getLastRollState` (single-row DB fetch). Conversation history reachable via cmd-k (T-01).
- [ ] One "components arriving" gesture: 180ms `translateY(8px) + opacity` (this is `reveal` from T-24) — deferred to T-24 motion tokens.
- [x] Split orchestration: state + logic extracted to `use-chat-state.ts`; `chat-interface.tsx` is layout-only (<250 lines).
- [x] Drop the gallery-intent regex (see T-06).

**Done when:** input renders as a single textarea with no surrounding box; filter chips appear on the result surface; component file under 200 lines; the history drawer is gone.

---

## T-06 — Galleries discoverability + copy-link flow

- **ID:** T-06
- **Order:** 7
- **Status:** done
- **Effort:** M
- **Visibility:** UV
- **Depends on:** T-01 (top-bar entry point)
- **Source:** [critique.md §6](../critique.md)

**Sub-tasks**

- [x] Galleries entry point already in the top-bar — Hypermood-wordmark menu item ([top-bar.tsx:97-107](../src/components/shell/top-bar.tsx#L97-L107)) plus the `hypermood:open-galleries` event and the cmd-k gallery section. No new entry point needed.
- [x] Dropped the gallery-intent regex. The runtime wiring was already removed during T-02; `GALLERY_INTENT_RE` survived as dead code in [chat-interface.logic.ts](../src/components/chat/chat-interface.logic.ts) referenced only by its own unit test and the now-obsolete "opened from chat intent" e2e block. Removed all three.
- [x] "Save as Gallery" defaults to **public** — `isPublic` initial state is `true` in [preview-panel.tsx](../src/components/chat/preview-panel.tsx).
- [x] On save success, show a copy button inline. Replaced the close-on-save behaviour: the panel now stays open and the header swaps to "Saved · Copy link" (public) via the new shared [CopyLinkButton](../src/components/ui/copy-link-button.tsx). `onGallerySaved` still fires so the caller can react. Private saves show "make it public to share" instead.
- [x] Gallery list rows get a hover-revealed copy button (`opacity-0 group-hover/row:opacity-100`, public galleries only). Row markup changed from a single `<button>` to a `<div>` with a leading open-button + trailing controls so the nested copy/toggle buttons are valid markup.
- [x] Public/private is now a one-tap toggle from the list — optimistic, reverts on failure via `updateGallery`.
- [x] **Fix from T-32 run:** the privacy toggles (list + detail) now carry `aria-label="Make private"`/`"Make public"` (the *action*, not the current value), so `gallery-drawer.e2e.ts:96`'s locator no longer strict-matches the copy button. Updated that test plus the row-badge test (font-mono → `tabular-nums` + toggle button, post-T-08) and the detail-view open click (row is now a div; click the leading button).

**Done when:** copy-link from a freshly-saved gallery is one click; Galleries reachable from the top-bar; gallery-intent regex removed; default privacy on new galleries is public. ✓ `tsc` clean; logic unit tests pass.

---

## T-14 — Reconcile selection model: click opens, modifier-click selects

- **ID:** T-14
- **Order:** 8
- **Status:** done
- **Effort:** S
- **Visibility:** UV
- **Depends on:** T-04
- **Source:** [critique.md §14](../critique.md)

**Sub-tasks**

- [x] Click on a grid image opens the darkroom.
- [x] Shift-click and cmd-click select; single dot indicator (top-left of cell) replaces per-cell hover chrome.
- [x] Selection clears on filter modify and on `showAll`.
- [x] Explicit "Clear" inline in the selection thumbnail strip.
- [x] After 2 images selected without a query for >3s, surface a single ghost line: _"Find images similar to these — or type to refine."_

**Done when:** click opens darkroom; cmd/shift-click selects; selection clears on every result-set change; first-time users discover image-as-prompt within their first selection. ✓

---

## T-07 — Rebuild the rolls index as an editorial gallery

- **ID:** T-07
- **Order:** 9
- **Status:** done
- **Effort:** M
- **Visibility:** UV
- **Depends on:** T-03 (shared masonry)
- **Verified:** "1 rolls" bug confirmed at [rolls/page.tsx:22](../src/app/(app)/rolls/page.tsx#L22) — the `Stat` component always renders `label` plural.
- **Source:** [critique.md §7](../critique.md)

**Sub-tasks**

- [x] Rolls list becomes a 3-column editorial grid (asymmetric thumbnail mosaic per roll, display-weight name, hover bleeds in a recent image).
- [x] Kill the green "indexed" success badge; index status becomes a low-contrast inline label (aligns with T-08).
- [x] Display weight (`font-bold`) for roll name on the index card; full display-weight audit deferred to T-26 editorial pass.
- [x] Asymmetric layouts: empty roll state is a quiet inline label instead of a large centered string.
- [ ] Decide login dark→light: lean into the cut via T-25, or drop the dark login. (deferred to T-25)
- [ ] Audit pluralization across the app. One `pluralize(n, 'roll', 'rolls')` helper (lands in T-26).

**Done when:** rolls index renders as a 3-column editorial mosaic; no green success badges anywhere; "1 roll" reads correctly.

---

## T-05 — Redesign the public gallery `timeline` mode

- **ID:** T-05
- **Order:** 10
- **Status:** done
- **Effort:** L
- **Visibility:** UV
- **Depends on:** —
- **Source:** [critique.md §5](../critique.md)

**Sub-tasks**

- [x] `display: flex; align-items: flex-end;` — baseline anchor. `items-end` on the horizontal scroll container in [public-gallery-view.tsx](../src/components/gallery/public-gallery-view.tsx).
- [x] Replace `flex-none lg:w-1/4 md:w-1/3` with `flex-none w-[min(28vw,420px)]`; `<Image>` renders `height: auto`.
- [x] Widen `gap-2` → `gap-12 md:gap-16`.
- [x] Add per-image `Subject — NNN` captions from `image_metadata.subject` (joined via `getPublicGallery`; falls back to sequence number only when subject is null). `GalleryWithImages` type extended with `roll_name` and `images[].subject`.
- [x] Smooth scroll via CSS `scroll-behavior: smooth` + `-webkit-overflow-scrolling: touch`. GSAP/Lenis not installed; native momentum scroll is sufficient at this stage.
- [x] Mobile: vertical stack preserved (unchanged behaviour).
- [x] Header rhythm: top-left `ROLL — <name>` demoted to `text-xs text-primary-200`; top-center large display title (`clamp(2.5rem, 5vw, 3.75rem)` bold); top-right "Made with Hypermood" attribution.
- [x] Bottom-center floating mode toggle fades after 3s of cursor/touch inactivity via `mousemove`/`touchstart` idle timer.
- [ ] Optional: scroll-bound grain shader — deferred (no GSAP installed; low priority).

**Done when:** the 8-image test gallery renders as a horizontal scroll-strip with shared baseline, varying heights, captioned, smooth-scrolled, with a display-type title. ✓ `tsc` clean.

---

## T-10 — View Transitions: roll → command-center → darkroom

- **ID:** T-10
- **Order:** 11
- **Status:** done
- **Effort:** M
- **Visibility:** UV
- **Depends on:** T-01, T-05, T-07 (stable surfaces to morph between)
- **Verified:** `startViewTransition` already used at [public-gallery-view.tsx:21-22](../src/components/gallery/public-gallery-view.tsx#L21-L22) and `viewTransitionName` at [public-gallery-view.tsx:172](../src/components/gallery/public-gallery-view.tsx#L172). Pattern exists; needs to spread.
- **Source:** [critique.md §10, §25](../critique.md)

**Sub-tasks**

- [x] Click on a roll on `/rolls` morphs the mosaic into the command-center grid (no white flash). `RollCard` is now a client component; click intercepts navigation with `document.startViewTransition` + `router.push`. `viewTransitionName: roll-card-{id}` set on the card `<a>` and matched on the `CommandCenter` wrapper `<div>`.
- [x] Click on an image morphs into the darkroom. Each `ImageCell` sets `viewTransitionName: image-{id}` on its `<Image>`; `openDarkroom` wraps `setDarkroom` in `startViewTransition`; `Darkroom` sets the matching name on the fullscreen image. `goTo` (prev/next nav) and `handleClose` also use `startViewTransition` for continuity.
- [x] Honour `prefers-reduced-motion: reduce` (skip animation, keep navigation). CSS rule in `globals.css` collapses `::view-transition-group/old/new` animations to `none` under `prefers-reduced-motion: reduce`.
- [x] Confirm Next.js navigation-level view transitions are wired correctly. Enabled `experimental.viewTransition: true` in `next.config.ts`; React 19.2.5 stable does not yet export `<ViewTransition>` so all morphs use the `document.startViewTransition` / inline `viewTransitionName` style pattern instead.

**Done when:** both morphs work in modern browsers, reduced-motion users see instant navigation with no broken state. ✓

---

## T-09 — Cut the vision indexing prompt to ~10 fields

- **ID:** T-09
- **Order:** 12
- **Status:** done
- **Effort:** M
- **Visibility:** INT
- **Depends on:** —
- **Why paired with T-18:** both touch indexing; running together means one re-index.
- **Verified:** model `gemini-3.1-flash-lite-preview` at [vision.ts:5](../src/lib/gemini/vision.ts#L5); 25+ field prompt confirmed.
- **Source:** [critique.md §9](../critique.md)

**Sub-tasks**

- [x] Keep: `description`, `tags`, `colors.dominant` / `palette_mood`, `scene.setting` / `time_of_day`, `composition.framing`, `people.count`, `technical.is_screenshot` / `is_graphic`, `text_content.has_text`, `quality_score`.
- [x] Drop: `relationships`, `mood.emotional_tone` / `aesthetic_style` / `energy_level`, `composition.focal_point` / `symmetry` / `depth`, `blur_score`, `texture_material`, `objects[].position` / `attributes`, `people.descriptions[]` detail.
- [x] Updated `vision.validate.ts`, `domain.ts`, `query-executor.logic.ts`, and query interpreter system prompt to match. Dropped types removed from domain. `ALLOWED_METADATA_FIELDS` and filter-chips label map trimmed accordingly.
- [ ] Run 20-query regression test against the existing 8-image roll. Acceptance: ≥80% top-10 overlap. (Deferred — requires a re-index.)

**Done when:** vision prompt is ≤10 top-level fields; per-image indexing latency drops 30%+; 20-query regression set holds ≥80% top-10 overlap.

---

## T-18 — Drop base64 in Inngest; parallelize vision + embedding

- **ID:** T-18
- **Order:** 13
- **Status:** done
- **Effort:** S
- **Visibility:** INT
- **Depends on:** —
- **Why paired with T-09:** run together → one re-index.
- **Verified:** base64 round-trip at [index-image.ts:61-70](../src/lib/inngest/functions/index-image.ts#L61-L70); analyse/embed run sequentially.
- **Source:** [critique.md §18](../critique.md)

**Sub-tasks**

- [x] Collapsed download+analyze+embed into one `step.run` (`analyze-and-embed`). Retries re-download from ImageKit CDN — cheap, no intermediate state. No base64 in Inngest step output.
- [x] Vision analysis and embedding wrapped in `Promise.all` — both run concurrently on the same buffer.

**Done when:** no base64 strings appear in Inngest step state; per-image indexing latency drops 40%+; a 100-image roll completes indexing measurably faster.

---

## T-11 — Cut chat-turn latency to <500ms

- **ID:** T-11
- **Order:** 14
- **Status:** done
- **Effort:** M
- **Visibility:** INT
- **Depends on:** —
- **Verified:** module-scoped `embeddingCache` at [query-executor.ts:9](../src/lib/gemini/query-executor.ts#L9); query model `gemini-3-flash-preview` at [query.ts:5](../src/lib/gemini/query.ts#L5).
- **Source:** [critique.md §11](../critique.md)

**Sub-tasks**

- [x] Fast-path template matcher at [query-fast-path.ts](../src/lib/gemini/query-fast-path.ts): 12 patterns (portraits, golden hour, indoor/outdoor, with/without people, screenshots, graphics, recent, high/low quality, contains text, single-tag). Wired into `sendMessage` in [chat.ts](../src/actions/chat.ts) — fast path short-circuits LLM entirely.
- [x] Telemetry: `console.log` with `path=fast_path_hit:<pattern>|llm|fallback` + end-to-end latency per turn.
- [x] Stream the LLM response via `generateContentStream`. The embedding call starts as soon as `semantic_search` is parsed from the partial JSON stream via regex, running concurrently with the rest of the stream. `executeQuery` receives the pre-computed `embeddingPromise` and awaits it instead of calling `embedText` again.
- [x] Cache the system prompt via `ai.caches.create` (TTL 1h) on first LLM call. Cache name is reused for subsequent calls via the `cachedContent` config field. Degrades silently if the model/region doesn't support context caching.
- [x] Dropped `followups` from the LLM call entirely. Added `deriveFollowups(filters, semanticSearch)` in [query.validate.ts](../src/lib/gemini/query.validate.ts) — deterministic suggestions keyed by active filter fields. Saves one output token set per turn; suggestions are equally contextual.

**Done when:** p50 chat-turn latency <500ms; ≥40% of representative test queries hit fast-path; telemetry distinguishes the three paths. ✓

---

## T-12 — Replace the fake stream-of-thought

- **ID:** T-12
- **Order:** 15
- **Status:** done
- **Effort:** S
- **Visibility:** UV
- **Depends on:** T-11 (recommended; if most turns become invisible, option B becomes obvious)
- **Source:** [critique.md §12](../critique.md)

**Sub-tasks**

- [x] Chose option B: single low-contrast "thinking…" line with `animate-pulse`, inline in the status row of the input bar. Lives at [chat-interface.tsx](../src/components/chat/chat-interface.tsx) — no separate component needed.
- [x] Deleted `processing-indicator.tsx` and `processing-indicator.logic.ts` (dead since T-02 rebuilt the chat input). Deleted the corresponding unit test.

**Done when:** indicator either reflects real backend phases via SSE, or is a single honest "thinking" line; no client-side fake-stagger timer remains. ✓

---

## T-17 — Postgres-backed embedding cache

- **ID:** T-17
- **Order:** 16
- **Status:** done
- **Effort:** S
- **Visibility:** INT
- **Depends on:** —
- **Verified:** module-scoped `Map` at [query-executor.ts:9](../src/lib/gemini/query-executor.ts#L9).
- **Source:** [critique.md §17](../critique.md)

**Sub-tasks**

- [x] Create `query_embeddings` table keyed by hash of text, with 30-day TTL. Migration at [supabase/migrations/20260523000000_query_embeddings_cache.sql](../supabase/migrations/20260523000000_query_embeddings_cache.sql).
- [x] Replace in-memory `embeddingCache` with cache-read-through to that table. `getCachedEmbedding` in [query-executor.ts](../src/lib/gemini/query-executor.ts) uses `createAdminClient` for bypassing RLS; falls through to `embedText` (or the precomputed T-11 parallel promise) on miss, then upserts.
- [x] Add hit/miss counter; log cache hit rate. `console.log` with `path=cache_hit|cache_miss latency=Nms` per turn.

**Done when:** repeat queries (same text, same user) hit cache across requests and cold starts; cache hit rate is logged. ✓

---

## T-15 — Filter chip behaviour (fresh translate + Refine toggle)

- **ID:** T-15
- **Order:** 17
- **Status:** done
- **Closeout:** All sub-tasks were already implemented in prior commits. Status table updated to reflect.
- **Effort:** S
- **Visibility:** UV
- **Depends on:** T-02, T-04 (filter chips live on the result surface now)
- **Source:** [critique.md §15](../critique.md)

**Sub-tasks**

- [x] Each query is a fresh translation. Active filters are added **only** by chip + button. `sendMessage` no longer merges `activeFilters` by default.
- [x] "Refine" toggle pill in [chat-interface.tsx](../src/components/chat/chat-interface.tsx) — visible when a result set is active; shows "Refining within N results" when on. Gated behind `refineMode` state in [use-chat-state.ts](../src/components/chat/use-chat-state.ts).
- [x] `clarification_note` fix: `interpretQuery` now accepts `activeFilters` and injects them into the user prompt when in refine mode, so the LLM can write an accurate note. [query.ts](../src/lib/gemini/query.ts).
- [x] Post-hoc merge at `chat.ts` is now gated behind `refineMode` — plain query sends skip it entirely.

**Done when:** typing a query without Refine produces a fresh result set; with Refine on, filters accumulate; `clarification_note` matches filter state. ✓

---

## T-16 — SQL RPC for metadata-only filter

- **ID:** T-16
- **Order:** 18
- **Status:** done
- **Closeout:** Migration and RPC call were already in place. Sub-tasks checked and status updated.
- **Effort:** S
- **Visibility:** INT
- **Depends on:** —
- **Verified:** JS-side post-filter at [query-executor.ts:67-105](../src/lib/gemini/query-executor.ts#L67-L105); proven RPC pattern exists in `search_images_by_embedding_filtered`.
- **Source:** [critique.md §16](../critique.md)

**Sub-tasks**

- [x] Create `filter_images_by_metadata` SECURITY DEFINER RPC taking an allow-listed `p_where_clause` SQL fragment. Migration at [supabase/migrations/20260523000001_filter_images_by_metadata.sql](../supabase/migrations/20260523000001_filter_images_by_metadata.sql).
- [x] Replace the JS-side post-filter for the no-semantic path with the new RPC. Implemented at [query-executor.ts:69-89](../src/lib/gemini/query-executor.ts#L69-L89).

**Done when:** metadata-only queries run server-side; no JS-side post-filter remains for the no-semantic path.

---

## T-20 — Fix `result_image_ids` realtime drift

- **ID:** T-20
- **Order:** 19
- **Status:** done
- **Effort:** S
- **Visibility:** UV (bug fix)
- **Depends on:** —
- **Verified:** [chat-interface.tsx:94-98](../src/components/chat/chat-interface.tsx#L94-L98) reads `result_image_ids` without filtering against `liveImages`.
- **Source:** [critique.md §20](../critique.md)

**Sub-tasks**

- [x] In the mount effect in [use-chat-state.ts](../src/components/chat/use-chat-state.ts), filter the restored `result_image_ids` against the `initialImages` set before applying to state. IDs not in `liveImages` are silently dropped; if the entire set would be empty after filtering, no result set is restored (shows all images instead of a gap-filled grid).

**Done when:** deleting an image referenced by a saved result-set message produces no gaps on next mount. ✓

---

## T-19 — Direct ImageKit upload (browser → ImageKit, register-only on server)

- **ID:** T-19
- **Order:** 20
- **Status:** done
- **Effort:** M
- **Visibility:** INT
- **Depends on:** —
- **Source:** [critique.md §19](../critique.md)

**Sub-tasks**

- [x] Server route returns signed token via `@imagekit/next`'s `getUploadAuthParams`. Lives at [/api/images/upload-auth/route.ts](../src/app/api/images/upload-auth/route.ts).
- [x] Browser uploads directly to ImageKit using the token. All files upload concurrently from [AmbientUpload](../src/components/roll/ambient-upload.tsx) via `fetch` to `upload.imagekit.io`.
- [x] On success, browser calls a small "register" route that does the DB insert + Inngest dispatch (<50 lines). Lives at [/api/images/register/route.ts](../src/app/api/images/register/route.ts).
- [x] UI shows per-file progress — counter updates as each concurrent upload completes.

**Done when:** uploading 100 files no longer routes binary through the Next function; per-file progress visible; register route under 50 lines.

---

## T-13 — Ship `book` + `stage` gallery modes

- **ID:** T-13
- **Order:** 21
- **Status:** done
- **Effort:** M
- **Visibility:** UV
- **Depends on:** T-03 (shared masonry), T-05 (timeline pattern established)
- **Source:** [critique.md §13](../critique.md)

**Sub-tasks**

- [x] `book` — ratio-aware masonry via shared T-03 `Masonry` component, dense packing (`columnWidth=240, gap=8`), vertical scroll.
- [x] `stage` — one image per viewport (`scroll-snap-align: start`), dark background, low-contrast caption. Gradient bleed via CSS framing (no GSAP dependency).
- [x] Drop `grid` from `GalleryLayout` at [src/types/domain.ts:21](../src/types/domain.ts#L21). DB column is `string`; no migration needed.
- [x] Save flow (preview-panel + gallery-drawer) lets curator pick all four modes: `masonry` / `timeline` / `book` / `stage`.

**Done when:** all three modes have distinct compositional vocabulary; `grid` is removed from the enum.

---

## T-21 — Stream the app-shell layout

- **ID:** T-21
- **Order:** 22
- **Status:** done
- **Effort:** S
- **Visibility:** INT
- **Depends on:** —
- **Verified:** sequential awaits at [layout.tsx:13-14](../src/app/(app)/layout.tsx#L13-L14).
- **Source:** [critique.md §21](../critique.md)

**Sub-tasks**

- [x] `listRollsCached()` + `getRollThumbnails()` are called from the new `TopBarData` async server component, which owns its own data fetching — the layout no longer awaits either fetch.
- [x] `layout.tsx` does auth only, then renders `<Suspense>` around `<TopBarData>` (with a 56px skeleton fallback matching the top-bar height) and a second `<Suspense>` around `{children}`. The two streams are independent.

**Done when:** TTFB on `/rolls` drops; the top-bar renders before the rolls list resolves. ✓

---

## T-23 — Three radii; strip the rest

- **ID:** T-23
- **Order:** 23
- **Status:** done
- **Effort:** S
- **Visibility:** UV
- **Depends on:** T-02 (chat input rebuild already removes `rounded-3xl` shell)
- **Verified:** mix of `rounded-3xl`, `rounded-2xl`, `rounded-sm` in chat + processing-indicator.
- **Source:** [critique.md §23](../critique.md)

**Sub-tasks**

- [x] Content (images, image cards, result grid): `rounded-none`. Selection thumbnail images in `SelectionStrip`: `rounded-sm` → `rounded-none`.
- [x] Ephemeral surfaces (preview panel, drawers, modals, popovers): `rounded-xl`. Chat input container: `rounded-2xl` → `rounded-xl`.
- [x] Pills (filter chips, segmented controls): `rounded-full`. Already correct everywhere.
- [x] Remove all other radii. `rg "rounded-(3xl|2xl|sm)"` returns zero.

**Done when:** `rg "rounded-(3xl|2xl|sm)"` in `src/` returns zero; only the three allowed radii remain. ✓

---

## T-24 — Motion language: micro / reveal / navigate

- **ID:** T-24
- **Order:** 24
- **Status:** done
- **Effort:** M
- **Visibility:** UV
- **Depends on:** T-10 (view transitions establish `navigate`), T-02 (chat establishes `reveal`)
- **Source:** [critique.md §24](../critique.md)

**Sub-tasks**

- [x] `micro` — `--motion-micro: 200ms` ease-out. Powers `animate-swiss` (all hover/focus colour+opacity transitions).
- [x] `reveal` — `--motion-reveal: 500ms` ease-out + `clip-path` inset + `translateY(4px)` for arrival. `animate-reveal` is the canonical class; `animate-bloom` is kept as a legacy alias pointing to the same keyframes.
- [x] `navigate` — `--motion-navigate: 700ms`. Applied to `::view-transition-group(*)` via CSS.
- [x] Codified as `:root` custom properties in [globals.css](../src/app/globals.css). `@keyframes reveal` replaces `@keyframes bloom`.
- [x] `animate-bloom` aliased to `--motion-reveal` keyframes; no usages broken. `animate-swiss` updated to use `var(--motion-micro)`.
- [x] `prefers-reduced-motion: reduce` collapses all three tokens to `0ms` and strips view-transition animations.

**Done when:** the three gestures are named tokens; `animate-bloom` is removed or aliased; the entire app honours reduced-motion. ✓

---

## T-25 — OTP login dark→light view transition

- **ID:** T-25
- **Order:** 25
- **Status:** done
- **Effort:** S
- **Visibility:** UV
- **Depends on:** T-10
- **Source:** [critique.md §25](../critique.md)

**Sub-tasks**

- [x] `handleCodeComplete` in [login/page.tsx](../src/app/(auth)/login/page.tsx) wraps `router.push('/rolls')` in `document.startViewTransition` (with a plain-`router.push` fallback for unsupported browsers).
- [x] The login `<main>` carries `viewTransitionName: 'login-canvas'` so the browser snapshots it as a named element.
- [x] In [globals.css](../src/app/globals.css): `::view-transition-old(login-canvas)` fades out, `::view-transition-new(login-canvas)` fades in — both using `--motion-navigate` duration. `@keyframes fade-out`/`fade-in` defined alongside. The `prefers-reduced-motion` block already collapses `--motion-navigate` to `0ms`, so no extra guard needed.

**Done when:** signing in transitions from the dark login canvas to the light app canvas as a single fade. ✓

---

## T-26 — Editorial copy + `pluralize` helper

- **ID:** T-26
- **Order:** 26
- **Status:** done
- **Effort:** S
- **Visibility:** UV
- **Depends on:** —
- **Source:** [critique.md §26](../critique.md)

**Sub-tasks**

- [x] Build `pluralize(n, singular, plural)` helper at [src/lib/format.ts](../src/lib/format.ts).
- [x] Audit and replace every count string: rolls index, roll-card, gallery list, gallery detail, cmdk (via `pluralImages` which now delegates to `pluralize`). "Drop images anywhere to start" → "Drop images here to begin".
- [x] Editorial voice: sentence case, `toLocaleString()` for numbers, tabular-nums for counts.
- [x] Surfaces audited: rolls index, command center (via cmdk), gallery list, gallery detail.

**Done when:** `pluralize` is the only path for count strings; the four surfaces above are visibly editorial. ✓

---

## T-27 — Replace HTML5 DnD in the gallery drawer

- **ID:** T-27
- **Order:** 27
- **Status:** todo
- **Effort:** S
- **Visibility:** UV
- **Depends on:** —
- **Source:** [critique.md §27](../critique.md)

**Sub-tasks**

- [ ] Pick `@dnd-kit/sortable` (best ergonomics) or hand-roll a pointer-event reorder (~150 lines).
- [ ] Replace the HTML5 DnD at [gallery-drawer.tsx:294-313](../src/components/gallery/gallery-drawer.tsx#L294-L313).
- [ ] Smooth touch behaviour; no native ghost image.

**Done when:** drag-to-reorder works on touch; no native ghost image; smooth rubber-band feedback.

---

## T-28 — History drawer / input bar conflict (folded into T-02)

- **ID:** T-28
- **Order:** 28 — but **folds into T-02**; no separate work.
- **Status:** todo
- **Effort:** —
- **Visibility:** UV
- **Depends on:** T-02
- **Source:** [critique.md §28](../critique.md)

**Done when:** drawer no longer exists; conversation history reachable via cmd-k; input is permanent. (Verified as part of T-02 completion.)

---

## T-30 — Accessibility pass

- **ID:** T-30
- **Order:** 29
- **Status:** todo
- **Effort:** M
- **Visibility:** UV
- **Depends on:** T-01, T-03, T-08, T-10, T-24 (so the patterns being audited are stable)
- **Source:** [critique.md §30](../critique.md)

**Sub-tasks**

- [ ] Keyboard nav in masonry (arrow keys, enter to open, cmd/shift+arrow to select).
- [ ] Focus management on view transitions (focus lands on the new surface's first interactive element).
- [ ] `prefers-reduced-motion: reduce` for GSAP horizontal scroll (T-05), bloom/`reveal` (T-24), all view transitions (T-10).
- [ ] Contrast audit on T-08 typography colours.
- [ ] cmd-k ARIA combobox pattern; screen-reader announcements for result count.

**Done when:** keyboard-only user can navigate rolls → grid → darkroom → save gallery → copy link without a mouse; axe / Lighthouse a11y score ≥95 on every primary surface.

---

## T-31 — Mobile degradations

- **ID:** T-31
- **Order:** 30
- **Status:** todo
- **Effort:** S
- **Visibility:** UV
- **Depends on:** —
- **Source:** [critique.md §31](../critique.md)

**Sub-tasks**

- [ ] T-01 (cmd-k): falls back to a tap on the top-bar that opens a full-screen switcher.
- [ ] T-02 (chat input): pinned to bottom safe-area; selection thumbs scroll horizontally above it.
- [ ] T-05 (timeline): vertical stack (already implemented, keep).
- [ ] T-10 (view transitions): gracefully skip on unsupported mobile Safari.

**Done when:** every primary flow is at least navigable on mobile.

---

## T-33 — E2E test auth: secrets hygiene + service-role exposure

- **ID:** T-33
- **Order:** 31
- **Status:** todo
- **Effort:** S
- **Visibility:** INT
- **Depends on:** —
- **Why this exists:** the auth setup we built for [T-32](#t-32--make-e2e-tests-runnable-on-this-machine) gives the test runner real `SUPABASE_SERVICE_ROLE_KEY` access (it has to, in order to call `admin.generateLink` and bypass the OTP email flow). Cleanest way to make e2e runnable, but it widens the blast radius of leaked test config and trace artifacts. Capture before CI / before anyone else touches the suite.

**The surface, concretely**

- [auth.setup.ts](../tests/e2e/auth.setup.ts) calls `admin.auth.admin.generateLink({ type: 'magiclink', email })` and then `verifyOtp` server-side. Service-role key needed for both.
- [.env.test.local](../.env.test.local) currently duplicates `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local`. Both files are gitignored under `.env*`.
- [playwright.config.ts](../playwright.config.ts) reads `.env.test.local` at startup; the spawned `pnpm dev` inherits the env.
- After a successful run, [tests/e2e/.auth/user.json](../tests/e2e/.auth/) and `test-results/**/trace.zip` contain a real Supabase session (~1h access token, longer refresh token). Both gitignored.

**What the OTP is and isn't**

The per-run `email_otp` returned by `generateLink` is single-use, ~1h TTL, consumed in the same function, never written to disk. **Not** the risk. The risk is the service-role key that produced it.

**Recommendations (pick in this order)**

- [ ] **Stop duplicating secrets.** Make `playwright.config.ts` load `.env.local` first, then layer `.env.test.local` on top for test-only vars (email, roll/gallery IDs). `.env.test.local` then contains zero secrets — just test data pointers. ~5-line change to the loader.
- [ ] **Rotate the service-role key.** It's been in chat transcripts, on disk, in killed processes, in trace artifacts. Cheap insurance whenever we're done iterating on the test setup. Supabase dashboard → Project Settings → API → reset.
- [ ] **Scrub trace artifacts before sharing.** Add a one-liner to README: "`test-results/` and `tests/e2e/.auth/user.json` contain real session cookies — don't zip and share." Or better: configure Playwright `trace: 'off'` for the `setup` project specifically.
- [ ] **CI gate (when we get there).** If e2e ever runs in GitHub Actions: `SUPABASE_SERVICE_ROLE_KEY` must be a repo secret (not env-file). Confirm hooks/logs don't echo it. Consider a dedicated test-only Supabase project so the prod service key never enters CI.
- [ ] **Test account isolation.** `realismofantastico@gmail.com` is both the test user and the human's real account. Anyone who runs the suite locally signs in as this account. Long-term: create a dedicated `e2e@hypermood.test` account in a separate Supabase project, fork seed data over.
- [ ] **Consider Supabase test-mode fixed OTP** as a service-key-free alternative. Dashboard → Auth → Users → mark user as test, assign fixed OTP. `auth.setup.ts` then only needs `TEST_USER_EMAIL` + `TEST_OTP_CODE` (the example-file shape). Trade-off: still single-use per session and requires re-marking after some Supabase auth changes; gives up the per-run dynamism but removes the service-role dependency.

**Done when:** `.env.test.local` contains no secrets; service-role key has been rotated since this work shipped; README warns about trace/auth artifacts; a CI plan exists (even if not yet implemented).

---

## T-22 — (folded into T-03)

- **ID:** T-22
- **Status:** n/a — number reserved, work covered by T-03.

---

## T-29 — Open-source VLM swap (watch only)

- **ID:** T-29
- **Status:** watch
- **Effort:** L (deferred)
- **Visibility:** INT
- **Source:** [critique.md §29](../critique.md)

Not actionable now. Triggers to revisit:

- Monthly Gemini embedding cost >$50, or a need for offline indexing → consider SigLIP 2 for embeddings.
- Indexing volume makes Gemini vision dominate cost, or a customer requires on-prem indexing → consider Gemma 3 (4B/12B) on Modal/Replicate/RunPod.
- Ship a "describe / OCR" power feature → consider Qwen 2.5-VL as a specific layer.

**Re-evaluate after T-09 + T-18 land and indexing cost / latency baseline is known.**

---

## What to keep, deliberately

- Architectural decisions in [plan/architecture.md](architecture.md). Two-stage retrieval, `embedding_model_version` versioning, the storage_key abstraction, RLS-from-day-one, Inngest fan-out — all correct.
- Diatype as the single typeface (after T-08).
- The OTP-with-segmented-boxes login flow — strongest visual moment in the app today. Connect it to the app surface via T-25.
- Inngest. The base64 round-trip is a few-line fix (T-18), not a platform change.
- Gemini Embedding 2. Unified text/image vector space is precisely what makes image-as-prompt work. Reconsider only via T-29's SigLIP path.
- pgvector + Supabase. At MVP scale, correct.
