# Hypermood — Action Plan

> Brief: target is a high-end conversational/agentic interface — Claude-quiet with motion sauce, Codrops-grade craft, Mobbin-grade restraint. Primary persona: photographers curating shoots and designers building moodboards. North-star magic: (1) speed of conversational filtering, (2) image-as-prompt similarity, (3) shareable curated galleries. Tech stack fixed at Next.js + Supabase; everything else is on the table.

The app is technically solid — multi-tenant from day one, RLS, pgvector with HNSW, Inngest fan-out, two-stage retrieval, real-time. The architectural decisions in `plan/architecture.md` are mature. **The problem is not the engine. The problem is that the engine is wrapped in a generic UI, the indexer pays for fields you'll never use, the most expensive moment of the product (waiting for results) is a fake-animated placeholder instead of the experience, and the share artifact — the public gallery — looks like a CMS.**

This document is a flat, numbered action plan ordered by priority. Refer to any item by its number. Each item carries:

- **Effort:** S (≤1 day) / M (1–3 days) / L (4+ days)
- **Visibility:** user-visible (UV) or internal (INT)
- **Done when:** measurable acceptance criterion

Items 1–9 alone — done well — change the perceived class of the app.

---

## Decisions locked in this pass

- **Mono typeface (Neue Montreal Mono) is dropped entirely.** Single-family typography (Diatype Sans), hierarchy via size/weight/colour. See item 8.
- **Masonry is shared.** One implementation used by the roll grid, the result reflow, and the public gallery's `book` mode. **Library: [`masonic`](https://github.com/jaredLunde/masonic)** (1.4k★, last release April 2025, virtualization via interval tree, MIT). Use the `usePositioner` + `useMasonry` hooks, not the high-level component, so we can drive our own reflow animations. See items 3, 4, 9, 22. (`pint` and `react-masonry-virtualized` rejected: tiny/unmaintained.)
- **`timeline` gallery mode is hand-rolled** — flex-end horizontal strip, ~80 lines, no library. `masonic` is column-balancing, not row-justified, so it can't drive `timeline`. See item 5.

---

## 1. Replace the Rail with a top-bar + cmd-k switcher - Done, not tested

**Effort: L · UV** · **Files:** [src/components/roll/rail.tsx:29-70](src/components/roll/rail.tsx#L29-L70)

The Rail is the worst-felt surface in the app and the screenshot proves it:

- The hover preview leaks across the rail's right edge. `RollRollItem` renders the micro-preview as `absolute left-full top-0 pl-2`. With `overflow-y-auto` on the rail, the floated mosaic widens the overflow container — that's where the partial-image cropping and horizontal scrollbar come from. **Layout bug, not a design issue.**
- The "Hypermood" wordmark gets clipped to "lypermood" — the active row's `-mx-2 px-2` negative-margin trick pushes content past the rail's clipping rect.
- Information hierarchy is upside-down. Galleries — the _output_ of the entire product, magic moment #3 — sits at the bottom in `font-mono text-primary-200` (literally ghost-grey by design).
- The user/sign-out block is engineering-debug chrome on the canvas.
- No active-state distinction beyond `font-medium`.
- The micro-preview is 80×80px — smaller than a favicon.
- The rail eats `w-56` (224px) permanently — 16% of a 1440px laptop canvas — for navigation between, in current state, one roll.

**Action: drop the persistent rail.** Top-bar with: wordmark left, breadcrumb center (`First › Outdoor shots`), `cmd-k` switcher right. `cmd-k` is the rolls + galleries switcher — type-to-filter, recent-first, image thumbs inline. User/sign-out lives in a settings popover off the wordmark. This is the Linear / Arc / Raycast pattern and it is right for an image-curation app where canvas matters more than chrome. Pairs with item 10 (View Transitions navigation).

**Done when:** wordmark renders intact, no horizontal scrollbar anywhere on `/rolls`, the canvas reclaims 224px on every page, Galleries is one keystroke away (`cmd-k`).

**Cost note:** highest-cost option of the three considered (vs. editorial sidebar / collapsible icon rail), but the only one that delivers the "invisible UI" feeling and unblocks item 10's view-transitions story.

---

## 2. Strip and rebuild the chat input

**Effort: L · UV** · **Files:** [src/components/chat/chat-interface.tsx:330-483](src/components/chat/chat-interface.tsx#L330-L483)

Today the bottom bar piles into one rounded white container: selection thumbnail strip + active filter chips (word "label" on the labels - redundant) + follow-up suggestions + starter suggestions + textarea + status counter ("8 of 12") + show-all + preview + history toggle + send. Four font sizes, two type families, three pill styles, one floating box. The antithesis of the references (Claude, Gemini, Codrops). Claude's input is a single calm rectangle on a wide black canvas; everything else _appears when summoned_.

**Reference shapes to match:**

- **The composer vocabulary you've been collecting** (single rounded rectangle, placeholder in regular weight, a row of small ghost-icon affordances on the bottom-left, an optional mode/model pill, single send button bottom-right). Zero filter chips, zero status counters, zero follow-ups inside the composer — everything else _has somewhere else to live_. Translated to the white canvas: `+` (attach / image-as-prompt), and as little else as is honest about what the input actually does. Resist adding affordances that don't have a real action behind them.
- **[Skiper UI — skiper81](https://skiper-ui.com/v1/skiper81)** (light theme): expandable composer with framer-motion'd entrance, mode toggles, model pill, file/image upload preview docked into the input, smooth grow as content arrives. The motion language is the value here — clip-path/height transitions on the composer expanding, not a separate floating panel. Pair with item 24's `reveal` gesture so the entire app speaks one motion vocabulary.

**Action:**

- **One quiet input.** Single bottom-anchored textarea on the white canvas. No border. No backdrop blur. No `rounded-3xl` shell. Caret-led — typography is the only chrome.
- **Surfaces become ambient and ephemeral.** Selection thumbs float just above the caret line and dissolve when empty. Filter chips live on the _result_ surface (see item 4), not next to the input. Follow-ups appear as a single inline ghost line _under_ the assistant's response.
- **Status disappears entirely** when there is no result set. When there is one, it becomes a subtle line above the input ("8 of 12 · show all · preview"), demoted via size/colour, no mono.
- **Resolve the history drawer.** It is currently neither a chat-app pattern (messages stack above input) nor a spatial pattern (canvas permanent, conversation ephemeral). Pick: messages stack above the input, image grid is what they reference. The cmd-k from item 1 then doubles as the conversation history switcher.
- **One animation language for "components arriving."** A 180ms `translateY(8px) + opacity` bloom, used consistently for filter chips, follow-ups, preview panel.

Rebuild the chat surface from scratch. Aim for ~150 lines, not 600. The current file does layout, history orchestration, selection state, darkroom routing, preview routing, gallery-intent regex, and event listening — split it.

**Done when:** input renders as a single textarea with no surrounding box; filter chips appear on the result surface, not the input bar; component file under 200 lines.

---

## 3. Build the shared masonry once, use it three places

**Effort: M · UV** · **Files:** [src/components/roll/roll-image-grid.tsx](src/components/roll/roll-image-grid.tsx), [src/components/gallery/public-gallery-view.tsx:110-118](src/components/gallery/public-gallery-view.tsx#L110-L118)

The current grids use `columns-2 sm:columns-3 md:columns-4 lg:columns-5` — CSS multicolumn. The browser packs column-by-column, so visual reading order is wrong (eye reads left-to-right, columns flow top-to-bottom-then-next). Plus: a 1000-image roll mounts 1000 DOM nodes — guaranteed jank in any real test. Plus: `<Image unoptimized>` everywhere, so Next.js image optimization is disabled.

**Action: build one `<Masonry>` component on top of `masonic`'s `usePositioner` + `useMasonry` hooks.** Use it in three places:

1. The in-app roll grid.
2. The result view post-filter (item 4 depends on this).
3. The public gallery `book` mode (item 6).

**Implementation specifics:**

- Image dimensions are already in the DB (`width`, `height` from EXIF). Pass them to `usePositioner` so layout is computed without measurement passes — no layout shift.
- Drop `unoptimized`. Configure ImageKit as a remote pattern in `next.config`. Use `placeholder="blur"` with a 16×16 LQIP from `tr=w-16,bl-10`. Blur-up makes the grid feel ten times more polished.
- Aspect-ratio-correct skeletons during load — masonic positions the cells before images load, so skeletons sit in the right slots.
- Virtualization is built-in (interval tree, O(log n) cell lookup). At 2000 images, only the visible 30–50 mount.

**Done when:** roll grid renders 2000 mock images at 60fps scroll; result view, roll grid, and `book` gallery share one component file; no `unoptimized` flag remains in the codebase.

---

## 4. Reflow on filter, don't dim

**Effort: M · UV** · **Files:** [src/components/roll/roll-image-grid.tsx:121-148](src/components/roll/roll-image-grid.tsx#L121-L148), [src/components/chat/chat-interface.tsx](src/components/chat/chat-interface.tsx)

The "people" filtered roll screenshot is the single most useful piece of evidence in this critique. Read it cell by cell:

- Result-set dimming is `opacity: 0.15` ([roll-image-grid.tsx:128](src/components/roll/roll-image-grid.tsx#L128)). Dimmed images still occupy their full grid slot. A 3-image filter against an 8-image roll produces five-sixths of the canvas in dimmed ghosts — the eye lands on smears, not on the three relevant images. The product fights itself.
- Every cell still carries hover affordances (`⤢`, `×`) on dimmed cells. Worst case: accidental delete on a ghost-dimmed image removes it from the _roll_, not from the result.
- The "people" filter chip in the input bar is the only signal that filtering happened. No result-side affordance like "3 of 8 · people · clear."
- Aspect-ratio chaos with `break-inside-avoid` produces accidental whitespace, not editorial whitespace.

**Action:**

- **Reflow on filter.** When the result set narrows, animate non-matching cells out (`opacity 0 → height 0`, 240ms staggered) and the masonic positioner repacks the matching cells. Filter-as-zoom, not filter-as-fade — the Codrops `draggable-grid` / `telescope-zoom` motion. This is what item 3 unlocks.
- **One alternate option (keep spatial context):** show only matches at _larger_ sizes — three matched images fill the canvas in 3 columns, big and editorial. `show all` reflows back to dense grid.
- **Move all per-cell chrome out of hover and into the darkroom.** Click opens. Grid is content, period. No `⤢`, no `×`. (See item 14 for selection model.)
- **Promote the active filter to the canvas.** Above the result grid: a single line — "people · 3 of 8" with a clickable `×`. The filter is a property of the _view_, not chrome on the input bar — this also clears one of the five concerns from item 2.

**Done when:** filtering 8→3 results in a 3-image canvas with no ghost cells; the active filter is visible above the grid, not on the input bar; per-cell hover chrome is removed from the grid.

---

## 5. Redesign the public gallery `timeline` mode

**Effort: L · UV** · **Files:** [src/components/gallery/public-gallery-view.tsx](src/components/gallery/public-gallery-view.tsx), [src/app/g/[slug]/page.tsx](src/app/g/[slug]/page.tsx)

The public gallery is the _one_ page non-users see — the marketing surface, the share moment, the artifact that gets posted to Twitter / Are.na / portfolios. Today it is a `columns-1..4` masonry on a sticky white header with "Hypermood" set in `text-base font-medium tracking-tight`. Good engineering delivery, weak design output — looks like a CMS-rendered list of photos, not a curated work.

The benchmark: [biazo/codrops-animate-shaders-with-gsap (index4.html)](https://github.com/biazo/codrops-animate-shaders-with-gsap/blob/main/index4.html) — centered display-type header, single-row strip of images sharing a horizontal **baseline**, captioned `Mirth — 007`, `Lucid — 008`, `Astra — 010`. Equal _widths_; _heights_ vary naturally with each image's aspect ratio. The screenshot you sent is exactly this layout.

**Action: rebuild `timeline` as the flagship.** Hand-rolled, ~80 lines, no library:

- `display: flex; align-items: flex-end;` — flex-end gives the baseline anchor.
- Each image gets a target _width_ (`flex-none w-[28vw] max-w-[420px]`); height derived from aspect ratio (`height: auto`). The rhythm comes from the silhouette along the _top_ edge.
- Bind horizontal scroll via GSAP `ScrollTrigger` with `scrub: true` so wheel/trackpad moves the strip with momentum. Or Lenis for smooth scroll. Native horizontal overflow feels mechanical.
- Per-image captions: `Subject — NNN` (auto-numbered) from the existing `subject` field in `image_metadata`. Demoted, just under each image.
- Mobile: degrade to vertical stack (current implementation already does this, keep it).
- Optional: scroll-bound grain shader on each image as it crosses viewport center (the GSAP+three.js trick from the Codrops demo) — ambitious, on-brand.

**Header rhythm (adopt the Codrops pattern):**

- Top-left: `ROLL — First / Outdoor shots`. Demoted.
- Top-center: gallery title in **display weight, large** (40–60px desktop). The editorial moment.
- Top-right: tiny "Made with Hypermood" attribution.
- Mode toggle: bottom-center floating segmented control. Appears on scroll, fades on idle.

**Existing `TimelineStrip` ([public-gallery-view.tsx:120-142](src/components/gallery/public-gallery-view.tsx#L120-L142)) — what to fix specifically:**

- Replace `items-center` with `items-end`.
- Replace `flex-none lg:w-1/4 md:w-1/3` with `flex-none w-[28vw] max-w-[420px]`; let `<Image>` render at `height: auto`.
- Widen `gap-2` → `gap-12 md:gap-16` so the silhouette reads.
- Add per-image `Subject — NNN` captions.
- Add momentum scroll.

**Done when:** the existing 8-image test gallery renders as a horizontal scroll-strip with images on a shared baseline, varying heights, captioned, smooth-scrolled, with a display-type title.

---

## 6. Fix Galleries discoverability and copy-link flow

**Effort: M · UV** · **Files:** [src/components/roll/rail.tsx:55-60](src/components/roll/rail.tsx#L55-L60), [src/components/chat/chat-interface.tsx:166-169](src/components/chat/chat-interface.tsx#L166-L169), [src/components/gallery/gallery-drawer.tsx:216-234](src/components/gallery/gallery-drawer.tsx#L216-L234)

Two real bugs hiding inside design issues.

**"How do I get to the galleries?"** The Galleries entry point is a `font-mono text-primary-200` button at the bottom of the rail — literally faded out by design. Add to that:

- It sits below the user/sign-out block on some viewport heights.
- The chat has a hidden gallery-intent regex ([chat-interface.tsx:166-169](src/components/chat/chat-interface.tsx#L166-L169)) that _redirects_ messages mentioning "gallery" to open the drawer. Magic, except undiscoverable, and indistinguishable from a bug if you didn't write it.
- There's a `/galleries` route, plus the drawer, plus per-gallery deep links — three navigation paths to the same surface, no signposted entry.

**"How to copy links?"** The CopyButton lives inside the gallery _detail_ view inside the gallery drawer ([gallery-drawer.tsx:216-234](src/components/gallery/gallery-drawer.tsx#L216-L234)) and _only renders when the gallery is public_ ([gallery-drawer.tsx:374-386](src/components/gallery/gallery-drawer.tsx#L374-L386)). Path from "I want to share this set of images" to a link in your clipboard:

1. Find Galleries (already buried).
2. Open drawer.
3. Click into a gallery's detail.
4. Scan for the public/private toggle.
5. Realise it's private, toggle to public.
6. _Now_ the copy button appears.
7. Click copy.

**Seven steps for the third-ranked magic moment.** This is the most expensive UX failure in the project.

**Action:**

- Galleries gets a real, prominent entry point — top-bar item (`Rolls / Galleries`) per item 1.
- **Drop the hidden gallery-intent regex.** Hidden behaviour the user can't discover or disable is anti-magic.
- The "Save as Gallery" flow in the preview panel ([preview-panel.tsx:179-267](src/components/chat/preview-panel.tsx#L179-L267)) **defaults to public.** Toggle is fine; default is wrong for the use case.
- On gallery save success, the assistant's "Gallery saved → /g/[slug]" message ([chat-interface.tsx:268-284](src/components/chat/chat-interface.tsx#L268-L284)) **includes the copy button inline.** One click from save to clipboard.
- In the gallery list view (drawer or page), each row gets a hover-revealed copy button. No need to drill in.
- Public/private becomes a one-tap toggle from the _list_, not an inline edit in the detail view.
- The drawer remains a fine secondary affordance for mid-flow access ("save selection as gallery → open just-saved gallery"). Stop treating it as the main way in.

**Done when:** copy-link from a freshly-saved gallery is one click; Galleries has a top-bar entry point; the regex is removed; default privacy on new galleries is public.

---

## 7. Rebuild the rolls index page as an editorial gallery

**Effort: M · UV** · **Files:** [src/app/(app)/rolls/page.tsx](<src/app/(app)/rolls/page.tsx>), [src/components/roll/roll-card.tsx](src/components/roll/roll-card.tsx)

The Rolls page screenshot is forensic evidence. "Hypermood" sits as plain weight-medium label in the top-left of a sidebar with a roll list — indistinguishable from a hundred CRM tools. "Rolls" h1 + "1 rolls" stat (note the broken pluralization right there: `roll.image_count === 1 ? 'image' : 'images'` exists for images but `${rolls.length} rolls` does not — see [src/app/(app)/rolls/page.tsx:21-22](<src/app/(app)/rolls/page.tsx#L21-L22>)). A roll row that's a 64px 2×2 mosaic + name in `text-3xl font-medium` + a green "8 indexed" badge. Generous whitespace, no compositional intent.

The font choices aren't the problem. The _deployment_ is.

**Action:**

- **Make the rolls list a rolls _gallery_.** 3- or 4-column editorial grid where each roll is a large, asymmetric thumbnail mosaic with the name set in a display weight. Hover bleeds in a recent image, large.
- **Kill the green success badge.** Index status becomes a low-contrast line ("indexed"). Reserve colour for one thing only — live action / link semantic — and use it sparingly.
- **Display type for hero moments.** Diatype Bold for the roll name on the detail screen, gallery title on the public page, login. (See item 8 for the typography rules.)
- **Asymmetric layouts.** Current pages are all centered or rail+main. The empty roll state (`text-4xl font-medium` "First" centered) is wasting an opportunity — a single full-bleed reference image could _be_ the empty state.
- **Login dark→light cut.** Either keep the dark on the marketing/login surface and let the app fade in dark→light via view transitions (item 10), or drop the dark login. Current jolt is unintentional. (See item 25 for the lighter-touch alternative.)
- **Audit pluralization across the app.** "1 rolls" is one symptom. Build one `pluralize(n, 'roll', 'rolls')` helper and grep for `${.+?}.+?(s)\b` patterns.

**Done when:** the rolls index renders as a 3-column editorial mosaic; no green success badges remain in the app; "1 roll" reads correctly.

---

## 8. Drop the mono typeface entirely; reform typography

**Effort: M · UV** · **Files:** [src/app/globals.css:35-53](src/app/globals.css#L35-L53), [src/app/globals.css:73](src/app/globals.css#L73), 15 components

The mono complaint is the same complaint as the green badge, the same complaint as the floating bar — **the design was _consistent_ in the wrong way.** Mono is used for _every_ secondary string: counts, labels, email, badges, "back", "private", page numbers, gallery slugs, chip × symbols, the empty state. Mono everywhere = mono nowhere; it stops registering as a meaningful texture and reads as default-engineering-output. Then when a _real_ affordance is mono+grey (Galleries, copy-link), the eye ignores that too.

The references that shape this product (Claude, Mobbin, Codrops demos) all run on a single sans family with hierarchy expressed through size, weight, and colour. Going single-family will tighten the visual identity in one stroke. **Decision (locked): remove mono entirely.**

**Step 1 — Delete the font:**

- [src/app/globals.css](src/app/globals.css): drop both `@font-face` blocks for Neue Montreal Mono ([globals.css:35-53](src/app/globals.css#L35-L53)).
- Drop the `--font-mono` token from `@theme` ([globals.css:73](src/app/globals.css#L73)).
- Delete `public/fonts/NeueMontrealMono-Book.{woff,woff2}` and `NeueMontrealMono-Medium.{woff,woff2}`. ~80–200KB saved, fewer requests on first paint.

**Step 2 — Replace every `font-mono` with one of three Diatype hierarchy classes:**

| Bucket                      | Current                                                                                                                    | Replace with                                                                            | Examples                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **System data / numerics**  | `text-base font-mono` on counts, dimensions, dates, slugs                                                                  | `text-sm tracking-tight tabular-nums text-primary-400`                                  | `8 images · 8 indexed`, `1920 × 1080`, `/g/abc123`, `3 of 8` |
| **Labels / inline actions** | `text-sm font-mono text-primary-200/300/400` on `show all`, `preview`, `history`, `back`, `private`, `masonry`, `timeline` | `text-sm font-medium text-primary-500 hover:text-primary-900`                           | every demoted button label                                   |
| **Empty / status text**     | `text-base/lg font-mono` on `Loading…`, `No galleries yet`, `Drop images anywhere to start`                                | `text-base text-primary-400` (inline) or `text-2xl font-medium text-primary-200` (hero) | every standalone status string                               |

**`tabular-nums` is the one mono-like property worth keeping** — keeps numerics stable without using a mono font.

**Step 3 — Per-file map (49 occurrences across 15 files):**

- [src/app/globals.css](src/app/globals.css) — remove font-faces (35–53) and `--font-mono` (73).
- [src/app/(auth)/login/page.tsx](<src/app/(auth)/login/page.tsx>) — 6 usages. OTP boxes ([line 74](<src/app/(auth)/login/page.tsx#L74>)) become `text-xl tabular-nums` so digits don't jitter; rest become `text-sm text-primary-200/400`.
- [src/app/(app)/rolls/page.tsx](<src/app/(app)/rolls/page.tsx>) — 1 usage (Stat). Bucket 1: `text-sm tracking-tight tabular-nums text-primary-400`. Fix "1 rolls" pluralization while there (see item 7).
- [src/components/roll/roll-card.tsx](src/components/roll/roll-card.tsx) — 4 usages. Count → bucket 1; green "indexed" pill drops colour entirely (item 7) and matches count.
- [src/components/roll/rail.tsx](src/components/roll/rail.tsx) — 2 usages. Both go away as part of item 1; just delete with the rail.
- [src/components/roll/darkroom.tsx](src/components/roll/darkroom.tsx) — 6 usages. Top-corner buttons → small ghost (`text-base text-primary-200/400`). `text-3xl font-mono` arrows → SVG glyph or `text-3xl font-light`. Bottom metadata panel → bucket 1 with `tabular-nums`.
- [src/components/roll/roll-image-grid.tsx](src/components/roll/roll-image-grid.tsx) — 1 usage (empty state). Hero: `text-2xl font-medium text-primary-200`.
- [src/components/roll/new-roll-button.tsx](src/components/roll/new-roll-button.tsx) — 1 usage. `text-sm text-semantic-alert`.
- [src/components/roll/ambient-upload.tsx](src/components/roll/ambient-upload.tsx) — 1 usage. `text-sm tabular-nums text-primary-400`.
- [src/components/chat/chat-interface.tsx](src/components/chat/chat-interface.tsx) — 9 usages. Biggest cluster; most are relocated by item 2 — handle the typography pass while rewriting the file.
- [src/components/chat/processing-indicator.tsx](src/components/chat/processing-indicator.tsx) — 1 usage. Removed entirely if item 12 takes the "remove the indicator" path; otherwise `text-sm text-primary-400`.
- [src/components/chat/preview-panel.tsx](src/components/chat/preview-panel.tsx) — 4 usages. Pills → Diatype `text-sm font-medium`; cancel/error → `text-sm text-primary-400` / `text-sm text-semantic-alert`.
- [src/components/gallery/public-gallery-view.tsx](src/components/gallery/public-gallery-view.tsx) — 1 usage. Hero empty: `text-2xl font-medium text-primary-200`. Make sure mono doesn't sneak back in during item 5.
- [src/components/gallery/gallery-drawer.tsx](src/components/gallery/gallery-drawer.tsx) — 11 usages. Most → Diatype `text-sm` with `text-primary-400/500`. The `/g/{slug}` link keeps `tabular-nums` since slugs read like ids.

**Step 4 — Reform the affordance layer:**

- **Size:** display (40–60px) > heading (text-2xl/3xl) > body (text-base) > meta (text-sm). No demoted sizes smaller than `text-sm`.
- **Weight:** `font-medium` (500) for emphasis, regular (400) for body, no `font-light`. Don't stack weight + size + colour for the same demotion — pick one axis.
- **Colour:** primary-900 for primary text, primary-500 for secondary, primary-300 for tertiary/placeholder. Drop primary-200 except for hairlines and ghost states. Drop primary-400 if you can — too many greys is the same problem as too much mono.
- **Casing:** lowercase labels ("show all", "preview", "back") read as engineering output in mono; in Diatype either keep lowercase (Linear / Things-style, intentional with sans) or sentence-case ("Show all", "Preview", "Back"). Pick one.

**Done when:** zero `font-mono` occurrences in the codebase; the font files are gone from `public/fonts/`; bundle is ~120KB lighter; the affordance layer is governed by size/weight/colour rules above.

---

## 9. Cut the vision indexing prompt to ~10 fields

**Effort: M · INT** · **File:** [src/lib/gemini/vision.ts:11-103](src/lib/gemini/vision.ts#L11-L103)

You're asking Gemini 3.1 Flash-Lite for 25+ fields per image, several **subjective and unreliable** (`emotional_tone`, `aesthetic_style`, `quality_score`, `mood.energy_level`), several **never used** in any high-leverage way. Prompt length itself drives latency and token cost.

For the photographer / moodboard persona, the _load-bearing_ fields are: `description` (the embedding is what matters; the description is what an LLM reranker reads), `tags`, `colors.dominant` / `palette_mood`, `scene.setting` / `time_of_day`, `composition.framing`, `people.count`, `technical.is_screenshot` / `is_graphic` (so screenshots get filtered out of "find me a portrait"), `text_content.has_text`. Plus `quality_score` (the one useful technical signal).

**Drop:**

- `relationships` (LLM hallucinates; rarely matches user vocabulary).
- `mood.emotional_tone` / `aesthetic_style` / `energy_level` (the embedding captures vibe better than a label).
- `composition.focal_point` / `symmetry` / `depth` (subjective; rarely query target).
- `blur_score` separately — keep `quality_score` only; one number for technical quality.
- `texture_material` (overlap with tags).
- `objects[].position` / `attributes` (over-fitted; tags cover it).
- `people.descriptions[]` detail (keep `count` only — names/ages/clothing are noise for the personas).

**Expected impact:**

- Prompt size drops ~60–70%.
- Per-image vision call ~30–40% faster, ~50% cheaper.
- JSON parse failures drop (smaller schema = lower hallucination rate on edge images).
- Negligible loss for the named personas, because the embedding carries the vibe — but run a regression test: pick 20 representative queries against the existing 8-image roll, capture top-10 results, re-index with the trimmed prompt, compare top-10 overlap. Acceptance: ≥80% overlap.

If you ever ship "fashion" or "scientific" domain layers from the plan, those become _additional_ schemas appended to the row, not part of the base — already supported by `image_metadata.metadata` JSONB.

**Done when:** vision prompt is ≤10 top-level fields; per-image indexing latency drops 30%+; 20-query regression set holds ≥80% top-10 overlap.

---

## 10. Make roll → command-center → darkroom continuous via View Transitions

**Effort: M · UV** · **Files:** [src/app/(app)/rolls/page.tsx](<src/app/(app)/rolls/page.tsx>), [src/app/(app)/rolls/[rollId]/page.tsx](<src/app/(app)/rolls/[rollId]/page.tsx>), [src/components/roll/darkroom.tsx](src/components/roll/darkroom.tsx)

Today: click a roll → page navigation → command center loads from scratch → click an image → fixed overlay covers the screen. Three hard cuts.

The Codrops `telescope-zoom` reference is exactly right. The roll's mosaic should _zoom into_ the command-center grid; the clicked image should _zoom into_ the darkroom. The infrastructure is in place — `viewTransitionName` is already used on gallery images, and `document.startViewTransition` is already used in `public-gallery-view.tsx`. Apply the pattern across the whole app.

This is the single most "magical" change for moderate effort. View Transitions API is supported in modern browsers; Next 16 supports it natively at navigation.

**Done when:** clicking a roll on `/rolls` morphs the mosaic into the command-center grid (no white flash); clicking an image morphs it into the darkroom; both work with `prefers-reduced-motion: reduce` (skip animation, keep navigation).

---

## 11. Cut chat-turn latency to <500ms (fast-path + streaming + caching)

**Effort: M · INT** · **Files:** [src/lib/gemini/query.ts:10-90](src/lib/gemini/query.ts#L10-L90), [src/actions/chat.ts:25-92](src/actions/chat.ts#L25-L92)

Every user message goes through `interpretQuery` → Gemini 3 Flash → structured plan. The system prompt is a 2.5K-token essay listing every metadata field. The plan is then executed and saved. ~1.5–2s per turn.

Two problems:

1. **The system prompt reloads on every call.** No prompt caching.
2. **It's called for queries that don't need an LLM.** "show me the portraits", "find golden hour", "all images" — template-detectable in <1ms.

**Action:**

- **Add a fast-path template matcher.** Match ~12 patterns: portraits, golden hour, indoor, outdoor, with/without people, screenshots, recent, brightest/darkest, contains text, single-tag mention. If the query matches, build the plan locally and skip the LLM. Falls back to LLM otherwise. Patterns live next to `lib/gemini/query.ts`.
- **Stream the LLM response.** When the LLM _is_ invoked, use `generateContentStream`. Start the embedding call the moment `semantic_search` is parsed — don't wait for the full plan. Vector search begins while the JSON tail is still arriving.
- **Cache the prompt.** Use Gemini's explicit context caching for the system prompt (it's static; cache once on boot).
- **Drop `followups` from the same call.** Either generate them _after_ sending results to the user (parallel call, arriving 200ms later), or generate them deterministically from the active filter (e.g. if `scene.setting=outdoor` is active, suggest "Narrow to golden hour" / "Without people").

**Telemetry:** log the path taken per turn (`fast_path_hit` / `llm_streamed` / `fallback`) plus end-to-end latency. Without this, "most chat turns are invisible" is unverifiable.

**Done when:** p50 chat-turn latency <500ms; ≥40% of representative test queries hit fast-path (no LLM call); telemetry distinguishes the three paths.

---

## 12. Replace the fake stream-of-thought

**Effort: S · UV** · **Files:** [src/components/chat/processing-indicator.tsx](src/components/chat/processing-indicator.tsx), [src/components/chat/processing-indicator.logic.ts](src/components/chat/processing-indicator.logic.ts)

The indicator cycles "Interpreting query…" → "Searching N images…" on a 100ms client-side timer regardless of what the backend is doing. Users notice this within two queries. Visual equivalent of a fake progress bar — and the apps you cited (Claude, Gemini) earned credibility by being _honest_ about latency.

**Action — pick one:**

- **A. Real phase events.** The pipeline naturally has phases: NL→plan, embed query, vector search, post-filter, fetch rows. Stream them via SSE from a route handler. Each phase becomes a line that _replaces_ the previous, not a stagger of cosmetic strings.
- **B. Single low-contrast "thinking" line with a typographic cursor.** Cleaner, harder to date, doesn't lie. **Recommended once item 11 lands** — most turns become invisible and the indicator becomes vestigial.

Either way: kill the bubble shape (`rounded-2xl border border-primary-100`) — it clashes with the rest of the surface.

**Done when:** the indicator either reflects real backend phases via SSE, or is a single honest "thinking" line; no client-side fake-stagger timer remains.

---

## 13. Ship the second and third gallery modes (`book`, `stage`)

**Effort: M · UV** · **File:** [src/components/gallery/public-gallery-view.tsx](src/components/gallery/public-gallery-view.tsx)

The `gallery_layout` enum already supports `'masonry' | 'timeline' | 'grid'` ([src/types/domain.ts:21](src/types/domain.ts#L21)). After items 3 and 5 land, you have two of the four target modes. Add:

- **`book` — true ratio-aware masonry, dense packing, vertical scroll.** The classic editorial publication mode. Shares the `masonic`-based component from item 3.
- **`stage` — one image per viewport, gradient-bleed transitions.** Reference: [clementgrellier/gradientslider](https://github.com/clementgrellier/gradientslider). Vertical scroll-snap, each image fills viewport, gradient bleed between adjacent frames. For narrative sequences (story, before/after, progression).

**Drop `grid` from the enum.** No one chooses a uniform grid for a moodboard.

**Future: `telescope` — scattered images at varying scales, scroll zooms in.** Reference: [joffreysp/telescope-zoom](https://github.com/joffreysp/telescope-zoom). Most ambitious; ship later.

**Done when:** save flow lets the curator pick `timeline` / `book` / `stage`; each mode has a distinct compositional vocabulary; `grid` is removed from the enum.

---

## 14. Reconcile the selection model: click opens, modifier-click selects

**Effort: S · UV** · **Files:** [src/components/chat/chat-interface.tsx:195-209](src/components/chat/chat-interface.tsx#L195-L209), [src/components/roll/roll-image-grid.tsx:122-148](src/components/roll/roll-image-grid.tsx#L122-L148)

Today a click on an image _toggles selection_ — there is no separate "open" gesture. Open is a hover button (`⤢`). This is unintuitive: in every photo app a click on an image _opens_ it. Item 4 already prescribed "click opens"; this item makes that the explicit, single source of truth and defines selection.

**Action:**

- **Click opens the image** in the darkroom.
- **Shift-click or cmd-click selects** (familiar from Finder / Lightroom). The single dot indicator (top-left of the cell, fills on selection) replaces the per-cell hover chrome.
- **Selection clears on filter modify** _and_ on `showAll`. Today it only clears on `showAll`.
- **Add an explicit "Clear" inline** in the selection thumbnail strip.
- **Image-as-prompt discoverability.** After 2 images selected without a query for >3s, surface a single ghost-line under the canvas: _"Find images similar to these — or type to refine."_ Or: when a selection exists, suggestion chips become image-prompt-specific ("Similar but darker", "Similar but with people").

**Done when:** click on grid image opens darkroom; cmd/shift-click selects; selection clears on every result-set change; a first-time user discovers image-as-prompt within their first selection.

---

## 15. Make filter chip behaviour explicit (fresh translate + Refine toggle)

**Effort: S · UV** · **File:** [src/actions/chat.ts:67-72](src/actions/chat.ts#L67-L72)

`mergedFilters = deduplicateFilters([...(activeFilters ?? []), ...plan.filters])` preserves filters across queries. But the LLM prompt explicitly says (rule 12) "Translate ONLY the current query into filters. Do not carry over." So the _LLM_ doesn't know about active filters; the _server_ merges them post-hoc. This means:

- "show me indoor shots" → `[setting=indoor]`
- then "show me golden hour" → LLM returns `[time_of_day=golden hour]`, server merges → `[setting=indoor, time_of_day=golden hour]`

Sometimes what users want, sometimes not. No way to express "fresh start" except clicking "show all". And `clarification_note` is generated in ignorance of the active filters, so it can read incoherently next to the merged result.

**Action:** be explicit. Each query is a fresh translation. Active filters are _only_ added by chip + button. Add a "Refine" toggle that explicitly says "Filter further within these N results" — the spatial-product gesture for accumulation, currently missing.

**Done when:** typing a query without "Refine" toggled produces a fresh result set; with Refine on, filters accumulate; the LLM's `clarification_note` matches the actual filter state.

---

## 16. Replace the JS-side metadata filter with a SQL RPC

**Effort: S · INT** · **File:** [src/lib/gemini/query-executor.ts:67-105](src/lib/gemini/query-executor.ts#L67-L105)

When there's no `semantic_search`, the executor over-fetches up to 500 indexed images and filters in JS. The comment acknowledges this is a hack ("PostgREST cannot apply raw JSONB WHERE clauses via the JS client"). It's correct that PostgREST is awkward here — but `search_images_by_embedding_filtered` proves you can pass a `p_where_clause` SQL fragment to a SECURITY DEFINER RPC. Make a `filter_images_by_metadata` RPC that takes the same allow-listed clause and runs it natively.

Current path is fine for 1000 images. Falls over at 5K. Worth fixing before you hit it.

**Done when:** metadata-only queries run server-side; no JS-side post-filter remains for the no-semantic path.

---

## 17. Replace the `embeddingCache` with a Postgres-backed cache

**Effort: S · INT** · **File:** [src/lib/gemini/query-executor.ts:9](src/lib/gemini/query-executor.ts#L9)

```ts
const embeddingCache = new Map<string, number[]>();
```

This is module-scoped. On Vercel/Cloudflare it survives within a single warm Lambda — hit rate is unpredictable, untracked, and effectively zero across cold starts on a low-traffic app.

**Action:** Postgres-backed cache. A `query_embeddings` table keyed by hash of the text, with a 30-day TTL. Pay for the embedding once; cache it for real. (Alternatives: `@vercel/kv` / Upstash Redis, but the Postgres path is simpler given the stack.) Add a hit/miss counter so cache effectiveness is visible.

**Done when:** repeat queries (same text, same user) hit cache across requests and across cold starts; cache hit rate is logged.

---

## 18. Stop base64-encoding images between Inngest steps; parallelize vision + embedding

**Effort: S · INT** · **File:** [src/lib/inngest/functions/index-image.ts:61-107](src/lib/inngest/functions/index-image.ts#L61-L107)

```ts
const imageBuffer = await step.run("download-image", async () => {
  // ... fetch, then:
  return Buffer.from(arrayBuffer).toString("base64");
});
const buffer = Buffer.from(imageBuffer, "base64");
```

`step.run` persists return values into Inngest's step state. A 5MB image becomes a ~6.7MB base64 string in step storage, then is re-decoded. For a 1000-image roll that's ~6.7GB of step-state writes for nothing.

Plus: `analyzeImage` finishes, _then_ `embedImage` starts. They have no dependency on each other — both consume the buffer. Run them in parallel.

**Action:**

- Either drop the wrapping `step.run` for download and combine download + analyze + embed in one step (retries re-download from CDN cache — cheap), **or** pass only the storage key between steps and re-fetch from ImageKit cache.
- Wrap vision and embedding in `Promise.all` — cuts per-image indexing latency ~40%.

**Tradeoff to acknowledge:** collapsing the step boundary means a retry after a successful download re-downloads. The download is a CDN GET and ImageKit caches aggressively; the cost is negligible. The alternative (storage-key-only) keeps step boundaries but requires confirming ImageKit's transform cache hit rate is reliable enough.

**Done when:** no base64 strings appear in Inngest step state; per-image indexing latency drops 40%+; a 100-image roll completes indexing in measurably less time.

---

## 19. Move uploads to direct ImageKit (client → ImageKit, register-only on the server)

**Effort: M · INT** · **Files:** [src/app/api/images/upload/route.ts](src/app/api/images/upload/route.ts), [src/lib/imagekit/upload.ts](src/lib/imagekit/upload.ts)

Current path: browser → Next route → ImageKit → response → DB row → Inngest event. The Next.js server is a relay for binary data it doesn't process.

ImageKit supports **client-side direct upload** with a short-lived signed token. Flow becomes: server returns signed token → browser uploads directly to ImageKit → on success, browser calls a tiny "register" route that does the DB insert + Inngest dispatch.

Benefits:

- Removes ~200KB–5MB per file from function bandwidth (Vercel charges for this).
- Parallel uploads no longer bottlenecked through the function.
- Faster feedback — UI sees per-file progress directly.
- Eliminates function timeout risk on large batches.

`@imagekit/next` already has the `getUploadAuthParams` helper exported on the server side — half of this is built.

**Done when:** uploading 100 files no longer routes binary through the Next function; UI shows per-file progress; the "register" route is <50 lines.

---

## 20. Promote: `result_image_ids` realtime drift

**Effort: S · UV** · **File:** [src/components/chat/chat-interface.tsx:97-105](src/components/chat/chat-interface.tsx#L97-L105)

(Promoted from P2 — this is an outright bug, not polish.) On mount, the last assistant message's `result_image_ids` becomes the active result set. If any of those images have since been deleted, they appear as gaps in the dimming logic.

**Action:** filter `result_image_ids` against `liveImages` before applying.

**Done when:** deleting an image referenced by a saved result-set message produces no gaps on next mount.

---

## 21. Stream the app-shell layout

**Effort: S · INT** · **File:** `app/(app)/layout.tsx`

Today does `await listRollsCached()` + `await getRollThumbnails()` _sequentially_ before rendering. First navigation to `/rolls` hits both DB calls before the user sees anything.

**Action:** run them in parallel via `Promise.all`, and stream the layout via Suspense boundaries so the rail (or top-bar from item 1) and the main render independently.

**Done when:** TTFB on `/rolls` drops; the top-bar renders before the rolls list resolves.

---

## 22. Virtualize + LQIP blur + drop `unoptimized` (folded into item 3)

This was originally a separate item but is fully covered by item 3's masonry build. Listed here so the number reservation is explicit.

**Done when:** see item 3.

---

## 23. Inconsistent component shapes — pick three, strip the rest

**Effort: S · UV** · Codebase-wide

`plan/architecture.md` says `rounded-none` on images, `rounded-2xl` on floating chat. Reality has `rounded-3xl`, `rounded-2xl`, `rounded-xl`, `rounded-full`, `rounded-sm`, `rounded-none` distributed without rule.

**Rule (apply globally):**

- **Content** (images, image cards, the result grid): `rounded-none`.
- **Ephemeral surfaces** (preview panel, drawers, modals, popovers): `rounded-xl`.
- **Pills** (filter chips, segmented controls): `rounded-full`.
- **Anything else: delete.**

**Done when:** grep `rounded-(3xl|2xl|sm)` returns zero results; the three allowed radii are the only ones in the codebase.

---

## 24. Build a real motion language (three gestures, not one)

**Effort: M · UV** · Codebase-wide

The `animate-bloom` keyframe (150ms scale-from-0.95) is fine for hover popovers but it's used for everything from filter chips to the preview panel to selection thumbs to Darkroom arrows. Codrops-grade craft means _different gestures for different scales_.

**Three named gestures:**

- **`micro`** — 200ms ease-out colour/opacity for hover and focus. Buttons, links, chip hovers.
- **`reveal`** — 500ms ease-out + clip-path for components arriving on the canvas. Filter chips, follow-ups, preview panel, selection strip. (This replaces `animate-bloom` for arrival.)
- **`navigate`** — 700ms View Transitions for cross-surface morphs. Roll → command-center → darkroom (item 10).

Codify them in `globals.css` as `--motion-micro`, `--motion-reveal`, `--motion-navigate`. Apply consistently. Respect `prefers-reduced-motion: reduce` — collapse all three to instant.

**Done when:** the three gestures are named tokens; `animate-bloom` is removed or aliased to `--motion-reveal`; the entire app honours `prefers-reduced-motion`.

---

## 25. Resolve the OTP login dark→light jolt

**Effort: S · UV** · **File:** [src/app/(auth)/login/page.tsx](<src/app/(auth)/login/page.tsx>)

The login is the strongest screen visually (OTP segmented boxes, dark canvas). Then you land in the white app and it feels like a different product. **Decision:** lean into it. Use the View Transitions infrastructure from item 10 to fade dark→light as the rolls load. The first-sign-in experience becomes a single composed gesture, not a hard cut.

(Alternative: drop the dark login. Not recommended — the OTP frame is a real visual asset; keep it and connect the two surfaces via motion.)

**Done when:** signing in transitions from the dark login canvas to the light app canvas as a single fade, with the OTP form dissolving as the rolls grid arrives.

---

## 26. Editorial copy pass

**Effort: S · UV** · Codebase-wide

"1 rolls" on the rolls page, "8 images · 8 indexed" reads engineering, "Drop images anywhere to start" is correct but flat. For the moodboard / photographer audience, lean editorial — "First roll", "Eight images, all indexed", "Drop images here to begin".

Build one `pluralize(n, 'roll', 'rolls')` helper and audit every count string. Pick one editorial voice (sentence case, full words for small numbers, mono-style abbreviations only for slugs/dimensions/timestamps).

**Done when:** the pluralization helper is the only path for count strings; copy pass complete on rolls index, command center, gallery list, public gallery header.

---

## 27. Replace HTML5 DnD in the gallery drawer

**Effort: S · UV** · **File:** [src/components/gallery/gallery-drawer.tsx:294-313](src/components/gallery/gallery-drawer.tsx#L294-L313)

HTML5 DnD is poor on touch and has visual quirks (ghost image, no rubber-band). For a curation app this should feel like Lightroom.

**Action:** `@dnd-kit/sortable` (best ergonomics) or hand-rolled pointer-event reorder (~150 lines). Small surface, big quality jump.

**Done when:** drag-to-reorder works on touch; no native ghost image; smooth rubber-band feedback.

---

## 28. Resolve the history drawer / input bar conflict

**Effort: S · UV** · Tied to item 2.

The drawer slides from `bottom-0` and _covers_ the floating bar — to send another message the user has to close the drawer first. Currently neither pushes-up nor side-sheets.

**Action:** drops out as part of item 2's chat rebuild. The decision (per item 2): messages stack above the input — the drawer goes away. Conversation history moves into the cmd-k surface from item 1.

**Done when:** the drawer no longer exists; conversation history is reachable via cmd-k; the input is permanent.

---

## 29. Open-source VLM swap — keep watching, don't act yet

**Effort: L · INT (deferred)** · Reference

You sent links to Gemma vision, Gemma 3 on DeepMind, and the Labellerr roundup of Qwen 2.5-VL. Honest answer: **don't replace Gemini at the indexing layer yet, but keep three options in your back pocket.**

Why not now:

- **Gemini 3.1 Flash-Lite is already cheap** at MVP scale. Self-hosting costs more in time and infra than the Gemini bill until you're at thousands of users / millions of images.
- **You'd lose `gemini-embedding-2-preview`'s unified text/image space** — the property that makes magic moment #2 (image-as-prompt) elegant.
- **The win you'd most want — faster, cheaper indexing — is captured by items 9 and 18.** Those don't add infra and probably get you 50%+ of the latency/cost reduction self-hosting would.

When to revisit:

1. **SigLIP 2 for embeddings (most interesting).** Open-source CLIP successor; smaller variants run on CPU; produces 768/1152-dim image+text embeddings in a shared space. Keep Gemini for vision metadata only. **Trigger:** monthly Gemini embedding cost >$50, or a need for offline indexing. All existing rows need re-embedding (planned migration via `embedding_model_version`).
2. **Gemma 3 (4B/12B) for metadata extraction.** Open-weight, runs on a single consumer GPU. Modal / Replicate / RunPod wrap this in serverless API for ~$0.0002–$0.001 per call. **Trigger:** indexing volume makes Gemini vision dominate cost, or a customer requires on-prem indexing (real ask for some photographer/designer customers — moodboards include unreleased client work).
3. **Qwen 2.5-VL — only if you ship a "describe / OCR" power feature.** Strongest open VLM on dense OCR. Use as a _specific_ layer, not a base-layer replacement.

The "best open VLM" charts cycle every 3 months. Lock to a class (open multimodal embeddings, open structured-output VLM), not a model name.

**Done when:** N/A — this is a watch item. Re-evaluate when item 9 + item 18 land and indexing cost / latency baseline is known.

---

## 30. Accessibility pass

**Effort: M · UV**

Not a single item in the original critique mentioned a11y. A curation app with view-transitions, dimming, hover-only chrome, masonry, and a planned cmd-k pattern has serious obligations:

- **Keyboard nav in masonry.** Arrow keys move focus between cells; enter opens darkroom; cmd/shift+arrow for selection.
- **Focus management on view transitions** (item 10). Focus must land on the new surface's first interactive element.
- **`prefers-reduced-motion: reduce`** for the GSAP horizontal scroll (item 5), the bloom gesture (item 24), all view transitions (item 10).
- **Contrast audit** on the new typography rules from item 8 — primary-200 / 300 / 400 / 500 against white must clear WCAG AA at the sizes used.
- **cmd-k accessibility** — proper ARIA combobox pattern, screen-reader announcements for result count.

**Done when:** keyboard-only user can navigate rolls → grid → darkroom → save gallery → copy link without a mouse; axe / Lighthouse a11y score ≥95 on every primary surface.

---

## 31. Mobile is out of scope for this pass — note the degradations

**Effort: S · UV**

Items 1, 2, 5, 10 all imply desktop. Make the degradations explicit so they don't surprise a mobile user:

- **Item 1 (cmd-k):** falls back to a top-bar tap that opens a full-screen switcher.
- **Item 2 (chat input):** input pinned to the bottom safe-area; selection thumbs scroll horizontally above it.
- **Item 5 (timeline):** vertical stack (current behaviour, keep).
- **Item 10 (view transitions):** mobile Safari support is partial — gracefully skip on unsupported browsers.

**Done when:** every primary flow is at least _navigable_ on mobile, even if the editorial layouts are desktop-first.

---

## What to keep, deliberately

- The architectural decisions in `plan/architecture.md`. Two-stage retrieval, `embedding_model_version` versioning, the storage_key abstraction, RLS-from-day-one, Inngest fan-out — all correct.
- **Diatype** (Atlas Grotesk style) as the single typeface. Mono is dropped (item 8); Diatype carries the entire identity via size/weight/colour.
- The OTP-with-segmented-boxes login flow — strongest visual moment in the app today. (Connect it to the app surface via item 25.)
- **Inngest.** Don't move job queues mid-flight. The base64 round-trip is a real waste but it's a few-line fix (item 18), not a platform change.
- **Gemini Embedding 2.** Unified text/image vector space is precisely what makes magic moment #2 (image-as-prompt) work. Reconsider only via item 29's SigLIP path.
- **pgvector + Supabase.** At scale (≤1000 images/roll, single user / few users), correct.

---

## Execution order (highest leverage first)

Items 1–9 change the _perceived class_ of the app. Everything else is real, but the user feels these first. Within that range, the order below minimizes rework — earlier items unblock later ones.

1. **Item 8** (drop mono) — cheapest, cleanest one-shot. Touches every other item's typography work; do it first so you're not editing class names twice.
2. **Item 3** (shared masonry) — unblocks items 4, 13, and removes the multicolumn quirk affecting item 7.
3. **Item 1** (top-bar + cmd-k) — reclaims canvas for everything below; fixes the wordmark bug; sets up item 6's Galleries entry point.
4. **Item 4** (reflow on filter) — depends on item 3.
5. **Item 2** (chat input rebuild) — relocates filter chips (depends on item 4) and follow-ups; folds in item 28.
6. **Item 6** (Galleries discoverability + copy) — depends on item 1's top-bar.
7. **Item 14** (selection model) — small but user-visible; do it once item 4's "click opens" is in place.
8. **Item 7** (rolls index editorial) — depends on item 3's masonry.
9. **Item 5** (public gallery `timeline`) — the share artifact; biggest external visibility lift.
10. **Item 10** (view transitions) — depends on items 1, 5, 7 having stable surfaces to morph between.
11. **Item 9** (vision prompt cut) + **Item 18** (Inngest base64 + parallel) — backend perf pair; run together so the re-indexing happens once.
12. **Item 11** (chat latency) + **Item 12** (stream-of-thought) + **Item 17** (embedding cache) — chat-loop perf cluster.
13. **Item 15** (filter chip behaviour), **Item 16** (SQL RPC), **Item 20** (realtime drift) — small server-side fixes.
14. **Item 19** (direct ImageKit upload) — independent; schedule when convenient.
15. **Item 13** (book + stage gallery modes) — depends on items 3 and 5.
16. **Item 21** (streamed shell), **Item 23** (radii), **Item 24** (motion language), **Item 25** (login transition), **Item 26** (copy), **Item 27** (DnD), **Item 28** (history drawer — folds into item 2) — polish cluster.
17. **Item 30** (a11y) and **Item 31** (mobile notes) — run as a final pass over everything.
18. **Item 29** (open VLMs) — watch only.

---

## 32. Make e2e tests runnable on this machine

**Effort: S · INT** · **Files:** `.env.test.local` (create), `tests/e2e/auth.setup.ts`

E2E tests are currently unrunnable locally — `playwright test` fails at the `auth.setup.ts` step because `.env.test.local` doesn't exist and no Supabase test account is configured. Action 1's rewrites (top-bar / cmd-k / settings popover) are typechecked and unit-tested but unverified end-to-end.

**Action — provide:**

- **`.env.test.local`** (gitignored; copy from `.env.test.local.example`) with:
  - `TEST_USER_EMAIL` — a dedicated test account on the Supabase project
  - `TEST_OTP_CODE` — a fixed OTP. Either (a) configure Supabase to accept a known test code for that email, or (b) extend `auth.setup.ts` to use the `SUPABASE_SERVICE_ROLE_KEY` admin path (already mentioned in the file's docstring) and skip the OTP entirely
  - `TEST_ROLL_ID` — UUID of a roll with ≥5 indexed images on the test account
  - `TEST_PUBLIC_GALLERY_SLUG` — slug of a public, `timeline`-layout gallery on the test account
- **Seed the test account** with at least one roll containing several indexed images and one public gallery, so `gallery-drawer.e2e.ts` and `public-gallery.e2e.ts` find data.
- **Playwright browser** is now installed locally (`~/Library/Caches/ms-playwright/chromium_headless_shell-1217/`); add `pnpm exec playwright install chromium` to the README's setup steps so new contributors don't hit the same wall.

**Done when:** `pnpm test:e2e` runs the suite end-to-end with no setup failures; the rewritten tests in `tests/e2e/rolls.e2e.ts` (top-bar wordmark, breadcrumb, cmd-k open via `⌘K` and trigger button, settings popover with email + Sign out, Galleries via popover) and `tests/e2e/gallery-drawer.e2e.ts` (drawer opens via Hypermood → Galleries menuitem) all pass.
