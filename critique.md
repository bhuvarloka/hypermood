# Hypermood — Deep Critique

> Brief: target is a high-end conversational/agentic interface — Claude-quiet with motion sauce, Codrops-grade craft, Mobbin-grade restraint. Primary persona: photographers curating shoots and designers building moodboards. North-star magic: (1) speed of conversational filtering, (2) image-as-prompt similarity, (3) shareable curated galleries. Tech stack fixed at Next.js + Supabase; everything else is on the table.

The app is technically solid — multi-tenant from day one, RLS, pgvector with HNSW, Inngest fan-out, two-stage retrieval, real-time. The architectural decisions in `plan/architecture.md` are mature. **The problem is not the engine. The problem is that the engine is wrapped in a generic UI, the indexer pays for fields you'll never use, and the most expensive moment of the product (waiting for results) is presented as a static "Searching…" placeholder instead of as the experience.**

This critique is organised by priority. Each item references concrete files. Don't try to do everything — the top of P0 alone will reset the perceived quality of the product.

---

## P0 — The things that decide whether this feels magical or generic

### 1. The chat input is a Slack-shaped lozenge stuffed with five concerns — replace it with an "invisible" surface

**File:** [src/components/chat/chat-interface.tsx:330-483](src/components/chat/chat-interface.tsx#L330-L483)

The bottom bar currently piles into one rounded white container:

- selection thumbnail strip
- active filter chips
- follow-up suggestions chips
- "starter" suggestions chips
- the textarea
- status counter ("8 of 12") + "show all" + "preview"
- history toggle
- send button

That's four font sizes, two type families, three pill styles, and one floating box. It's the antithesis of the references you sent (Claude, Gemini, Codrops). Claude's input is a single calm rectangle on a wide black canvas; everything else _appears when summoned_. Right now your bar is always loud, always demanding to be parsed.

**What to change**

- **One quiet input.** A single bottom-anchored textarea on the white canvas. No border. No backdrop blur. No rounded-3xl shell. Caret-led — typography is the only chrome.
- **Surfaces become ambient and ephemeral.** Selection thumbs float just above the caret line and dissolve when empty. Filter chips live on the _result_ surface, not next to the input. Follow-ups appear as a single inline ghost line _under_ the assistant's response, not as a chip rack glued to the bar.
- **Status disappears entirely** when there is no result set. When there is one, it becomes a subtle line above the input ("8 of 12 · `show all` · `preview`") — mono, low contrast, demoted.
- **The "history" drawer is wrong.** Chat history is the conversation; it shouldn't live behind a tiny mono toggle. Either (a) commit to the canonical chat-app pattern — messages stack above the input, image grid is what they reference — or (b) commit to the _spatial_ pattern — the canvas is permanent, conversation is ephemeral, history is a slide-over invoked by a global cmd-k. Right now it's neither: messages are saved but only visible behind a hidden drawer. Pick one.

The "invisible UI" you described means **components don't pre-occupy the canvas; they animate in when the system has something to say**. Adopt a single gesture for that — a 180ms `translateY(8px) + opacity` bloom — and use it consistently for filter chips, follow-ups, and the preview panel.

**Suggested:** rebuild the chat surface from scratch. Aim for ~150 lines, not 600. The current file is doing layout, history orchestration, selection state, darkroom routing, preview routing, gallery-intent regex, and event listening — split it.

---

### 2. The "stream of thought" is theatre — make it real, or remove it

**Files:** [src/components/chat/processing-indicator.tsx](src/components/chat/processing-indicator.tsx), [src/components/chat/processing-indicator.logic.ts](src/components/chat/processing-indicator.logic.ts)

The indicator says "Interpreting query…" → "Searching N images…" on a 100ms client-side timer regardless of what the backend is doing. Users notice this within two queries. It's the visual equivalent of a fake progress bar — and the apps you cited (Claude, Gemini) earned their credibility by being _honest_ about latency.

**What to change**

- Drive the indicator from real backend events. The pipeline naturally has phases: NL→plan, embed query, vector search, post-filter, fetch rows. Stream them via Server-Sent Events from a route handler, or surface phase markers via Supabase Realtime if you keep the action-based path. Each phase becomes a line that _replaces_ the previous, not a stagger of cosmetic strings.
- Better: **don't show stages at all**. A single low-contrast line — "thinking" — with a typographic cursor. Cleaner, harder to date, doesn't lie.
- The processing indicator's bubble shape (`rounded-2xl border border-primary-100`) clashes with everything else. If you keep it, kill the bubble.

The whole reason ProcessingIndicator exists in the codebase is the visible 1-3s latency on `interpretQuery`. Fix the latency (P1, item 6) and most of the indicator becomes unnecessary.

---

### 3. The vision indexing prompt extracts 25+ fields you don't query — it's slow and expensive for what you use

**File:** [src/lib/gemini/vision.ts:11-103](src/lib/gemini/vision.ts#L11-L103)

You're asking Gemini 3.1 Flash-Lite to produce, per image:

- `objects[]` with prominence/position/attributes (an array)
- `people` with descriptions, age range, gender presentation, clothing, expression, activity (an array)
- `relationships` (array of natural-language strings)
- `colors.dominant` hex codes (array)
- `colors.palette_mood`, `colors.dominant_color_name`
- `scene.environment`, `scene.setting`, `scene.time_of_day`, `scene.weather`
- `mood.emotional_tone`, `mood.energy_level`, `mood.aesthetic_style`
- `composition.framing`, `composition.focal_point`, `composition.symmetry`, `composition.depth`
- `technical.blur_score`, `technical.exposure`, `technical.noise_level`, `technical.is_screenshot`, `technical.is_graphic`, `technical.orientation`
- `quality_score`
- `texture_material[]`
- `text_content.has_text`, `text_strings[]`, `text_role`
- `description` (paragraph)
- `tags` (15-25 freeform)

Several of these are **subjective and unreliable** (`emotional_tone`, `aesthetic_style`, `quality_score`, `mood.energy_level`). Several are **never used** by the suggestion generator or query interpreter in any high-leverage way. And the prompt's length itself meaningfully drives both latency and token cost.

For the photographer/moodboard persona, the _load-bearing_ fields are:

- `description` (the embedding is what matters; the description is what an LLM reranker reads)
- `tags`
- `colors.dominant` / `palette_mood`
- `scene.setting` / `time_of_day`
- `composition.framing`
- `people.count`
- `technical.is_screenshot` / `is_graphic` (so screenshots get filtered out of "find me a portrait")
- `text_content.has_text`

That's 8 groups, not 25. Drop:

- `relationships` (LLM hallucinates these and they rarely match user vocabulary)
- `mood.emotional_tone` / `aesthetic_style` / `energy_level` (the embedding captures vibe better than a label)
- `composition.focal_point` / `symmetry` / `depth` (subjective; rarely query target)
- `quality_score` (the _one_ useful technical signal — keep it but stop trusting `blur_score` separately; one number)
- `texture_material` (overlap with tags)
- `objects[].position` / `attributes` (over-fitted; tags cover it)
- `people.descriptions[]` detail (keep `count` only — names/ages/clothing are noise for the personas)

**Expected impact**

- Prompt size drops ~60-70%.
- Per-image vision call ~30-40% faster and ~50% cheaper.
- JSON parse failures drop (smaller schema = lower hallucination rate on edge images).
- Zero loss for the named personas, because the embedding carries the vibe.

If you ever ship the "fashion" or "scientific" domain layers from the plan, those become _additional_ schemas appended to the row, not part of the base — already supported by `image_metadata.metadata` JSONB.

---

### 4. The query interpreter is a 1.5s tax on every chat turn — it doesn't need to be

**Files:** [src/lib/gemini/query.ts:10-90](src/lib/gemini/query.ts#L10-L90), [src/actions/chat.ts:25-92](src/actions/chat.ts#L25-L92)

Every user message goes through `interpretQuery` → Gemini 3 Flash → structured plan. The system prompt is a 2.5K-token essay listing every metadata field. The plan is then executed and saved.

Two problems:

1. **The system prompt is reloaded on every call.** No prompt caching. With Gemini's caching the same fixed system prompt could be cached server-side and reduce per-call cost and latency dramatically.
2. **It's called for queries that don't need an LLM.** "show me the portraits", "find golden hour", "all images" — these are template-detectable in <1ms.

**What to change**

- **Add a fast-path template matcher.** Match a small set of intents (≈12 patterns: portraits, golden hour, indoor, outdoor, with/without people, screenshots, recent, brightest/darkest, contains text, single tag mention). If the query matches, build the plan locally and skip the LLM. Falls back to LLM otherwise. The patterns are tiny — they live next to `lib/gemini/query.ts`.
- **Stream the LLM response.** When the LLM _is_ invoked, use `generateContentStream` and start the embedding call the moment `semantic_search` is parsed — don't wait for the full plan. The vector search can begin while the JSON tail (filters, followups) is still arriving.
- **Cache the prompt.** Use Gemini's explicit context caching for the system prompt (it's static; cache once on boot).
- **Drop `followups` from the same call.** They're a different concern — generating them blocks the result. Either (a) generate follow-ups _after_ sending results to the user (parallel call, arriving 200ms later), or (b) generate them deterministically from the active filter (e.g. if `scene.setting=outdoor` is active, suggest "Narrow to golden hour" / "Without people").

After this change, the typical chat turn becomes: <100ms (template hit) or ~400ms (streaming LLM + parallel embedding) instead of 1.5-2s.

---

### 5. The image grid is the product — currently a CSS-columns wall with no virtualization

**File:** [src/components/roll/roll-image-grid.tsx](src/components/roll/roll-image-grid.tsx)

For your personas (curating real shoots: 200-2000 images per roll), the grid is _the_ surface. Today:

- `<Image unoptimized>` everywhere — Next.js image optimization disabled, so you serve full ImageKit transforms with no pre-fetch, no blur placeholder, no LQIP.
- `columns-2 sm:columns-3 md:columns-4 lg:columns-5` — fixed CSS multicolumn, so a 1000-image roll mounts 1000 DOM nodes. This will be a janky scroll within the first real test.
- No skeleton on first load — the canvas just pops.
- Result-set dimming uses `opacity: 0.15` — the dimmed images still load, still occupy space, still take pointer events. Beautiful for 50 images, terrible for 1000.
- Hover-revealed delete `×` (top-right) on every image — destructive action one mouse-flick away from the click that opens the darkroom. Delete should be in the darkroom, not the grid.

**What to change**

- **Adopt a virtualized masonry.** `react-virtuoso` masonry, `@tanstack/react-virtual` with column packing, or roll your own with `IntersectionObserver` (the codebase is small enough that a 200-line implementation is appropriate). At 2000 images, only the visible 30-50 are mounted.
- **Use proper Next/Image.** Drop `unoptimized`. Configure ImageKit as a remote pattern. Use `placeholder="blur"` with a 16×16 LQIP that ImageKit can generate via `tr=w-16,bl-10`. The blur-up makes the grid feel ten times more polished.
- **Result-dimming should remove non-result images from layout, not opacity-fade them.** Current behaviour wastes space and creates noisy negative space. Animate height/opacity together. The "Codrops feeling" comes from layouts that _reflow_ in response to filtering, not just dim.
- **Move delete out of the grid.** Right-click for context menu, or dedicated multi-select mode. The accidental-delete risk on a curation tool is unacceptable.
- **Aspect-ratio-correct skeletons.** You already store `width`/`height` from EXIF — use it to render correctly-shaped skeleton boxes during load. No layout shift.

---

### 6. Typography and visual identity feel SaaS-generic — the screenshot proves it

The Rolls page screenshot you shared:

- "Hypermood" sits as plain weight-medium label in the top-left of a sidebar with a roll list. Indistinguishable from a hundred CRM tools.
- "Rolls" h1 + "1 rolls" stat (note the broken pluralization right there: `roll.image_count === 1 ? 'image' : 'images'` exists for images but `${rolls.length} rolls` does not — see [src/app/(app)/rolls/page.tsx:21-22](<src/app/(app)/rolls/page.tsx#L21-L22>)).
- A roll row that's a 64px 2×2 mosaic + name in `text-3xl font-medium` + a green "8 indexed" badge. The green is the only colour — and it's the wrong colour to anchor a curation app on.
- Generous whitespace, but no compositional intent. Nothing leads the eye.

You've already chosen great fonts (Diatype + Neue Montreal Mono). The font choices aren't the problem — the _deployment_ is. There's no display moment. No image leak through the layout. No editorial rhythm. References like the Codrops "telescope-zoom" or "draggable-grid" and the "for the planet" screenshot you sent feel ambitious because they let images escape grid cells.

**What to change**

- **Make the rolls list a rolls _gallery_**, not a list of rows. A 3- or 4-column editorial grid where each roll is a large, asymmetric thumbnail mosaic with the name set in a display weight, image count in mono. Hover bleeds in a recent image, large.
- **Kill the green success badge.** Index status should be a low-contrast mono line ("indexed", in primary-400). Reserve colour for one thing only — the live action / link semantic — and use it sparingly.
- **Display type for hero moments.** Diatype Bold (or pair with one display serif — _not_ an extra family, but its italic at scale) for the roll name on the detail screen, the gallery title on the public page, and login. Mono everywhere else for chrome.
- **Asymmetric layouts.** The current pages are all centered or rail+main. Compose more deliberately. The chat canvas should leak: e.g. the empty roll state (`text-4xl font-medium` "First" centered) is wasting an opportunity — a single full-bleed reference image could _be_ the empty state.
- **Login is currently a hard cut from primary-950 to white-everywhere.** Either keep the dark on the marketing/login surface and let the app fade in from dark to light, or drop the dark login entirely. The current jolt is unintentional.

The Codrops references you cited are united by one thing: **motion is composed, not just present**. Static frames already look great; movement reveals structure. Adopt one signature transition (a slow scale + clip-path reveal on enter, or a `view-transitions` API ID-based morph between roll → command-center → image-detail) and use it consistently. You already use `document.startViewTransition` in `public-gallery-view.tsx` — extend that pattern across the whole app.

---

### 7. The Rail is the worst-felt surface in the app, and the screenshot proves it

**File:** [src/components/roll/rail.tsx:29-70](src/components/roll/rail.tsx#L29-L70)

What's actually wrong, looking at the latest screenshot:

- **The hover preview leaks across the rail's right edge.** `RollRollItem` renders the micro-preview as `absolute left-full top-0 pl-2`. When the rail has `overflow-y-auto` + the mosaic floats out of the nav's bounding box, you get the partial-image cropping visible in the screenshot — and worse, a horizontal scrollbar appears at the bottom of the rail because the floated mosaic widens the overflow container. This is a layout bug, not just a design issue.
- **"Hypermood" wordmark gets clipped** — the screenshot shows "lypermood" because the active row's hover state adds left padding/margin (`-mx-2 px-2`) that pushes the rail content right of its own clipping rect. The visual identity is literally being chewed off on its primary surface.
- **Information hierarchy is upside down.** Top-to-bottom: wordmark (text-base, demoted), roll list (text-lg, plain), Galleries (font-mono, primary-200 = ghost), user (mono email + avatar). The most prominent item is the rolls list, which is correct, but it's typed in a way that makes it look like a settings menu, not the entry point to the work.
- **"Galleries" lives at the bottom in a faded ghost weight.** It's the _output_ of the entire product — the magic moment #3 you ranked. It should not be a primary-200 mono link buried under the user avatar.
- **The user block at the bottom — N avatar + truncated email + sign-out icon — is engineering-debug chrome.** Photographers/designers don't want to be reminded of their account state in their canvas. Move it.
- **No active-state distinction beyond `font-medium`.** The screenshot shows the active "First" row barely distinguishable from non-active rows. Active state should be unmissable.
- **The micro-preview is a 2×2 mosaic at 80×80px.** This is the only image content in the rail, and it's smaller than a favicon. If you're going to show preview, show it at the scale that earns its space.
- **The rail occupies 224px (`w-56`) on every screen at every moment.** On a 1440px laptop that's 16% of the canvas — permanently — for navigation between (in your test) one roll. The opportunity cost is enormous: it's 224px of image grid you're not showing.

**What to change — three options, pick one and commit:**

**Option A — Drop the persistent rail entirely (recommended).**

- Top-bar with: wordmark left, breadcrumb center (`First › Outdoor shots`), `cmd-k` switcher right.
- `cmd-k` is the rolls + galleries switcher. Type-to-filter, recent-first, image thumbs inline. This is the Linear/Arc/Raycast pattern and it's right for an image-curation app where the canvas matters more than the chrome.
- User/sign-out lives in a settings popover off the wordmark.
- Reclaims 224px of horizontal canvas. The empty roll's "Drop images anywhere" empty state finally gets to be a hero moment.

**Option B — Make the rail editorial, not navigational.**

- Keep `w-56` but redesign as an editorial sidebar: large display-type roll names, no list rules, recent image leaking under each roll name as a low-opacity background. No "Galleries" item — galleries live in `cmd-k` or in a tab on the rolls index.
- Move user identity entirely off the rail (top-right popover).
- The hover preview becomes a _full-height_ overlay on the right of the rail, large, editorial — a floating moodboard preview, not a thumbnail mosaic.

**Option C — Collapsible / icon rail.**

- Default state: 56px wide, icons only. Hover expands to 240px. Auto-collapses when interacting with the canvas.
- The compromise — keeps persistent navigation but stops eating canvas. Less ambitious than A or B.

**Whichever you pick, immediately fix:**

- The horizontal scrollbar (the floating preview's `absolute left-full` is escaping the nav's overflow rect).
- The wordmark clipping (the active row's negative-margin trick).
- Kill the `font-mono primary-200` on Galleries — it's buried.

**My recommendation:** Option A. The cmd-k pattern is the right metaphor for a power-user creative tool, it's exactly the "invisible UI" feeling you described (chrome that appears when summoned), and it pairs perfectly with the View Transitions navigation in P0 #8 — `cmd-k` to a roll then the grid morphs in.

---

### 8. The roll → command-center → darkroom transition is three hard cuts — it should be one continuous gesture

**Files:** [src/app/(app)/rolls/page.tsx](<src/app/(app)/rolls/page.tsx>), [src/app/(app)/rolls/[rollId]/page.tsx](<src/app/(app)/rolls/[rollId]/page.tsx>), [src/components/roll/darkroom.tsx](src/components/roll/darkroom.tsx)

Today: click a roll → page navigation → command center loads from scratch → click an image → fixed overlay covers the screen.

The Codrops "telescope-zoom" demo you cited is exactly the right reference. The roll's mosaic should _zoom into_ the command-center grid; the clicked image should _zoom into_ the darkroom. The infrastructure for this is already in place (`viewTransitionName` on gallery images) — apply it to the roll → grid → darkroom path.

This is the single most "magical" change you can make for moderate effort. View Transitions API is supported, you're already using it on the public gallery, and Next 16 supports it natively at navigation.

---

### 9. Inside the roll, post-filter — the screenshot is a forensic record of everything that's wrong

**Files:** [src/components/chat/chat-interface.tsx](src/components/chat/chat-interface.tsx), [src/components/roll/roll-image-grid.tsx:121-148](src/components/roll/roll-image-grid.tsx#L121-L148), [src/components/gallery/gallery-drawer.tsx](src/components/gallery/gallery-drawer.tsx)

The "people" filtered roll screenshot you sent is the single most useful piece of evidence in this critique. Read it cell by cell:

**The result view is broken as a composition, not just unstyled.**

- Result-set dimming is `opacity: 0.15` ([roll-image-grid.tsx:128](src/components/roll/roll-image-grid.tsx#L128)). The dimmed images still occupy their full grid slot. So a 3-image filter produces a layout that is **97% empty space + 5 ghosts of dimmed-out cells + 3 actual photos scattered across a 1500px-wide canvas**. The screenshot proves it: the eye lands on a green smear, a pink smear, a butterfly, and a leaf — _not_ on the three relevant images. The product is fighting itself.
- Every cell carries hover affordances (`⤢` and `×`) that fade to translucent grey on the dimmed cells. Visual noise on content that's supposed to be receding. Worst case: the user accidentally hits the `×` on a ghost-dimmed image and deletes it from the _roll_, not from the result.
- The "people" filter chip in the input bar is the only signal that filtering happened. There's no result-side affordance ("3 of 8 · people · clear"). Status is hidden in mono-grey at the bottom-left of the input (`3 of 8 show all preview`), 800px away from the eye.
- Aspect-ratio chaos. `columns-2 sm:columns-3 md:columns-4 lg:columns-5` + `break-inside-avoid` plus arbitrary image dimensions = sparse, asymmetric, _accidental_ whitespace. Not editorial whitespace, not Codrops-grade negative space — just gaps where ghosts used to be.

**What to change in the result view:**

- **Reflow on filter, don't dim.** When the result set narrows, animate the non-matching cells out (`opacity 0 → height 0`, 240ms staggered) and pack the matching cells into a tighter grid. That's the whole magic moment — filter-as-zoom, not filter-as-fade. The Codrops "draggable-grid" / "telescope-zoom" demos you sent are exactly this.
- **One alternate option (keep the spatial-context approach):** show only matches but at _larger_ sizes — let three matched images fill the canvas in 3 columns, big and editorial. The non-matches don't show at all. Pressing `show all` reflows back to the dense 5-column grid. The filter literally zooms you in.
- **Move all per-cell chrome out of hover and into the darkroom.** Click opens. The grid is content, period. No `⤢`, no `×`, no overlays.
- **Promote the active filter to the canvas.** Above the result grid: a single line — "people · 3 of 8" with a clickable `×`. Mono, primary-400. The filter is a _property of the view_, not chrome on the input bar. Removing it from the bar also clears the input bar of one of the five concerns flagged in P0 #1.

**"How do I get to the galleries?" — your literal question, and it's a real bug.**

The Galleries entry point is a `font-mono text-primary-200` button in the bottom-left of the rail ([rail.tsx:55-60](src/components/roll/rail.tsx#L55-L60)) — _which_ is the hardcoded UI ghost-grey colour. It's literally faded out by design. Add to that:

- It's at the bottom of the sidebar, below the user/sign-out block on some viewport heights.
- The chat has a hidden gallery-intent regex ([chat-interface.tsx:166-169](src/components/chat/chat-interface.tsx#L166-L169)) that _redirects_ messages mentioning "gallery" to open the drawer. So the user types "show me my galleries" and the regex hijacks it. Magic, except undiscoverable, and indistinguishable from a bug if you didn't write it.
- There's also a `/galleries` route, plus the drawer, plus per-gallery deep links. Three navigation paths to the same surface, no signposted entry.

**What to change:**

- Galleries gets a real, prominent entry point. In Option A from the Rail rewrite (P0 #7), it's a top-bar item — `Rolls / Galleries`. In Option B/C it's at the _top_ of the rail, not the bottom, in display weight.
- Drop the hidden gallery-intent regex. Hidden behaviour the user can't discover or disable is anti-magic.
- The drawer (right slide-over) is a fine secondary affordance for mid-flow access ("save selection as gallery → open just-saved gallery"). Keep it for that, but stop treating it as the main way in.

**"How to copy links?" — also a real bug.**

The CopyButton lives inside the gallery _detail_ view inside the gallery drawer ([gallery-drawer.tsx:216-234](src/components/gallery/gallery-drawer.tsx#L216-L234)) and _only renders when the gallery is public_ ([gallery-drawer.tsx:374-386](src/components/gallery/gallery-drawer.tsx#L374-L386)). Three layers of nesting. From a fresh canvas the path to a copyable link is:

1. find Galleries (already buried, see above)
2. open drawer
3. click into a gallery's detail
4. scan for the public/private toggle
5. realise it's private, toggle to public
6. _now_ the copy button appears
7. click copy

Seven steps from "I want to share this set of images" to a link in your clipboard. For an app whose third-ranked magic moment is _shareable galleries_, this is the most expensive UX failure in the project.

**What to change:**

- The "Save as Gallery" flow in the preview panel ([preview-panel.tsx:179-267](src/components/chat/preview-panel.tsx#L179-L267)) should default to public. The toggle is fine; the default is wrong for the use case (people who curate moodboards almost always want to share).
- On gallery save success, the assistant's "Gallery saved → /g/[slug]" message ([chat-interface.tsx:268-284](src/components/chat/chat-interface.tsx#L268-L284)) should _include the copy button inline_. One click from save to clipboard.
- In the gallery list view (drawer or page), each row gets a hover-revealed copy button — no need to drill into detail.
- Public/private should be a one-tap toggle from the _list_, not an inline edit in the detail view.

**About the mono typeface — the third explicit complaint:**

You're right; it's wrong for this product. Neue Montreal Mono is a fine typeface but the _application_ is the failure:

- It's used for _every_ secondary string: counts ("3 of 8"), labels ("show all", "preview", "history"), the email block, the user-roll badges, "back", "private", page numbers, gallery slugs, the empty state, the filter pills' bracket characters. Mono everywhere = mono nowhere; it stops registering as a meaningful texture and reads as default-engineering-output.
- It's set at `text-base` and `text-sm` against `font-medium` Diatype headings — too small a contrast, not enough hierarchy.
- It's the single colour anchor in the rail (primary-200 = ghost grey), the result counter, the chip × symbols, the gallery slugs. Every "demoted" string is mono+grey. The eye learns to ignore it. So when a _real_ affordance is mono+grey (Galleries, copy link), the eye ignores that too.

**Decision: remove the mono typeface from the app entirely.**

You've decided to drop mono. That's the right call for this product — the references you keep coming back to (Claude, Mobbin, the Codrops demos) all run on a single sans family with hierarchy expressed through size, weight, and colour. Mono carried no meaning here other than "demoted thing"; once everything demoted is mono, mono no longer means anything. Going single-family will tighten the visual identity in one stroke.

**The full removal plan:**

1. **Delete the font.**
   - In [src/app/globals.css](src/app/globals.css): drop both `@font-face` blocks for Neue Montreal Mono ([globals.css:35-53](src/app/globals.css#L35-L53)).
   - Drop the `--font-mono` token from `@theme` ([globals.css:73](src/app/globals.css#L73)).
   - Delete the actual font files from `public/fonts/`: `NeueMontrealMono-Book.woff2`, `NeueMontrealMono-Book.woff`, `NeueMontrealMono-Medium.woff2`, `NeueMontrealMono-Medium.woff`. ~80-200KB of bytes leave the bundle, fewer requests on first paint.

2. **Replace every `font-mono` usage with a Diatype Sans hierarchy class.** There are 49 occurrences across 15 files. Don't blanket-find-replace — each usage falls into one of three buckets, and the replacement differs per bucket. Here's the rule:

   | Bucket | Current pattern | Replace with | Examples |
   | --- | --- | --- | --- |
   | **System data / numerics** | `text-base font-mono` on counts, dimensions, dates, slugs | `text-sm tracking-tight tabular-nums text-primary-400` | `8 images · 8 indexed`, `1920 × 1080`, `/g/abc123`, `3 of 8` |
   | **Labels / inline actions** | `text-sm font-mono text-primary-200/300/400` on `show all`, `preview`, `history`, `back`, `private`, `masonry`, `timeline` | `text-sm font-medium text-primary-500 hover:text-primary-900` | every demoted button label |
   | **Empty / status text** | `text-base font-mono` or `text-lg font-mono` on `Loading…`, `No galleries yet`, `Drop images anywhere to start`, `Verifying…`, error text | `text-base text-primary-400` (smaller for inline status) or `text-2xl font-medium text-primary-200` (larger for empty-state hero text) | every standalone status string |

   **Tabular-nums is the one mono-like property worth keeping.** When numbers stand next to each other (counts, dimensions, durations), proportional digits jitter as values change. Adding `tabular-nums` to the data bucket above keeps that monospaced-numeric stability without using a mono font.

3. **Per-file replacement map.** This is what to actually edit:

   - [src/app/globals.css](src/app/globals.css) — remove `@font-face` blocks (lines 35-53) and the `--font-mono` token (line 73).
   - [src/app/(auth)/login/page.tsx](src/app/(auth)/login/page.tsx) — 6 mono usages (OTP boxes, error/status copy). The OTP boxes (`text-xl font-mono` at line 74) should keep `tabular-nums` so digits don't jitter as the user types; everything else becomes `text-sm text-primary-200/400`.
   - [src/app/(app)/rolls/page.tsx](src/app/(app)/rolls/page.tsx) — 1 usage (the `Stat` component for "1 rolls / 8 images / 8 indexed"). This is the bucket-1 case: `text-sm tracking-tight tabular-nums text-primary-400`. Also fix the "1 rolls" pluralization while you're there.
   - [src/components/roll/roll-card.tsx](src/components/roll/roll-card.tsx) — 4 usages (image count + status badges). Bucket 1 for the count; the green "indexed" pill should drop the colour entirely (P0 #6) and become same-class as the count.
   - [src/components/roll/rail.tsx](src/components/roll/rail.tsx) — 2 usages ("Galleries" button, user email). These both go away as part of the Rail rewrite (P0 #7) — Galleries moves to the top-bar / cmd-k, the email moves to a settings popover. No replacement needed; just delete with the rail.
   - [src/components/roll/darkroom.tsx](src/components/roll/darkroom.tsx) — 6 usages (close/toggle buttons, edge arrows, metadata panel). Top-corner buttons become small ghost buttons (`text-base text-primary-200/400`). The `text-3xl font-mono` arrow becomes either an SVG glyph or `text-3xl font-light` Diatype. The bottom metadata panel — currently a mono row of "1920 × 1080", quality score, scene, tags — becomes bucket-1 with `tabular-nums`.
   - [src/components/roll/roll-image-grid.tsx](src/components/roll/roll-image-grid.tsx) — 1 usage (empty state "No images yet"). Becomes the empty-state hero: `text-2xl font-medium text-primary-200`.
   - [src/components/roll/new-roll-button.tsx](src/components/roll/new-roll-button.tsx) — 1 usage (error text). `text-sm text-semantic-alert`.
   - [src/components/roll/ambient-upload.tsx](src/components/roll/ambient-upload.tsx) — 1 usage (upload progress "Uploading & Indexing…"). `text-sm tabular-nums text-primary-400`.
   - [src/components/chat/chat-interface.tsx](src/components/chat/chat-interface.tsx) — 9 usages (status counter, show-all/preview/history toggles, history label, selection-strip count, empty roll caption). The biggest cluster. As part of P0 #1 (chat input rebuild), most of these are being relocated anyway — handle the typography pass while you're rewriting the file.
   - [src/components/chat/processing-indicator.tsx](src/components/chat/processing-indicator.tsx) — 1 usage. Removed entirely if you take P0 #2's "remove the indicator" path; otherwise `text-sm text-primary-400`.
   - [src/components/chat/preview-panel.tsx](src/components/chat/preview-panel.tsx) — 4 usages (cancel ×, layout/visibility pills, error text). Pills become Diatype `text-sm font-medium`; cancel and error become `text-sm text-primary-400` / `text-sm text-semantic-alert`.
   - [src/components/gallery/public-gallery-view.tsx](src/components/gallery/public-gallery-view.tsx) — 1 usage (empty state). Hero empty: `text-2xl font-medium text-primary-200`. _Also_ see P0 #10C — the public gallery header gets a full typography pass (display-type title, demoted attribution); make sure mono doesn't sneak back in there.
   - [src/components/gallery/gallery-drawer.tsx](src/components/gallery/gallery-drawer.tsx) — 11 usages (back button, list/loading copy, image counts, layout/public-private pills, copy button, slug link). Biggest concentration of bucket-2 (labels) and bucket-3 (status) — most become `text-sm` Diatype with `text-primary-400/500`. The slug link (`/g/{slug}`) is the one place I'd argue for keeping `tabular-nums` since slugs read like ids.

4. **Reform the affordance layer.** The mono-grey was the only signal differentiating "label" from "value." Once gone, you need to re-ground hierarchy via:
   - **Size:** display (40-60px) > heading (text-2xl/3xl) > body (text-base) > meta (text-sm). No "demoted" sizes smaller than `text-sm`.
   - **Weight:** `font-medium` (500) for emphasis, regular (400) for body, no `font-light`. Avoid stacking weight + size + colour for the same demotion — pick one axis.
   - **Colour:** primary-900 for primary text, primary-500 for secondary, primary-300 for tertiary/placeholder. Drop primary-200 except for hairlines and ghost states. Drop primary-400 if you can — too many greys is the same problem as too much mono.
   - **Casing:** lowercase mono labels ("show all", "preview", "history", "back", "private") read as engineering output. In Diatype, you can either keep them lowercase (Linear / Things-style, feels intentional with sans) or sentence-case them ("Show all", "Preview", "History"). Pick one and apply consistently — _not_ a mix.

5. **The OTP digit input is the one tricky case** ([login/page.tsx:74](src/app/(auth)/login/page.tsx#L74)). 6 boxes with single digits, currently `text-xl font-mono` so the `0` and `1` align in the same width. In Diatype, `tabular-nums` solves this: `text-xl tabular-nums`. Single-character per box means the difference is negligible visually, but `tabular-nums` keeps the box-width math predictable.

**What you gain immediately:**

- Single visual voice. Claude/Linear/Mobbin coherence.
- Lighter font stack — one family, two weights = ~120KB saved.
- One fewer thing to maintain in `globals.css`.
- The Rail's "Galleries" button stops being ghost-greyed-out by typography (compounds with the P0 #7 rail rewrite).

**What you lose, deliberately:**

- The "data terminal" texture. Some products lean into mono for character (Linear, Vercel CLI, GitHub Actions logs). Hypermood doesn't need that — it's a curation tool, not a developer tool. The references you sent (Claude, Codrops, Mobbin) all use sans-only typography.

The mono complaint was the same complaint as the green badge, the same complaint as the floating bar — **the design was _consistent_ in the wrong way**. Removing mono is the single highest-leverage typography move you can make.

---

### 10. The public gallery is the front face of the product — and it's underwhelming

**Files:** [src/components/gallery/public-gallery-view.tsx](src/components/gallery/public-gallery-view.tsx), [src/app/g/[slug]/page.tsx](src/app/g/[slug]/page.tsx)

This is the _one_ page non-users see — the marketing surface, the share moment, the artifact that gets posted to Twitter/Are.na/portfolios. Right now it's a generic `columns-1..4` masonry on a sticky white header with "Hypermood" set in `text-base font-medium tracking-tight` and a `view-mode` toggle that only appears for timeline galleries. It's a good _engineering_ delivery and a _weak_ design output — the gallery looks like a CMS-rendered list of photos, not a curated work.

The Codrops references you sent are exactly the right benchmark. Each one earns its space differently:

- **biazo / codrops-animate-shaders-with-gsap (index4.html):** centered display-type header, a single-row strip of images sharing a horizontal **baseline**, captioned `Mirth — 007`, `Lucid — 008`, `Astra — 010`. Image with equal _widths_; _heights_ vary naturally with each image's aspect ratio (a 4:5 portrait sits taller, a 16:9 landscape sits shorter, but both rest on the same baseline). Horizontal scroll moves through the sequence; vertical position stays anchored. The screenshot you sent is exactly this layout. Genre: **horizontal timeline** — this is what your `timeline` mode should be.
- **joffreysp / draggable-grid:** rigid asymmetric grid where the user can grab any cell and drag the whole composition around — physics-y but structured. Genre: spatial moodboard.
- **clementgrellier / gradientslider:** horizontal scroll-bound strip where each image fills viewport, gradient transition between cells, scroll = curated narrative. Genre: presentation / sequence.
- **joffreysp / telescope-zoom:** scattered images at varying scales across a wide canvas; scroll _zooms in_ on the focal frame. Genre: zoom-narrative.

These aren't five layouts — they're **five compositional vocabularies**. Right now Hypermood ships _one_ (a 4-column CSS multicolumn that calls itself "masonry" but isn't) plus a half-baked `timeline` mode that horizontally scrolls equal-width frames. Neither rises to the references.

**What to change**

**A. Replace the current `MasonryGrid` with a real ratio-aware masonry.**
[public-gallery-view.tsx:110-118](src/components/gallery/public-gallery-view.tsx#L110-L118) uses `columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-16` — CSS multicolumn. The browser packs column-by-column, so the visual reading order is _wrong_ (eye reads left-to-right, columns flow top-to-bottom-then-next). Fix with one of:

- **bricks.js / `andreasbm/masonry-layout` style** — a JS layout pass that places each image where it fits best by aspect ratio, left-to-right then down. The CodePen you linked is exactly this. Maintains true reading order and tighter packing.
- Or **a flexbox-based row-packed grid** ("justified gallery" / "Flickr-style"): images are scaled to fill each row to a target row height, with no cropping. Best when images vary widely in aspect ratio (which photographer rolls do). Libraries: `react-justified-layout` (the algorithm Flickr uses), or implement directly — it's ~40 lines.

The data is there: every image has `width` and `height` from EXIF. Use it.

**B. Ship multiple gallery _modes_ as a creator choice on save, not a single fixed layout.**
The `gallery_layout` enum already supports `'masonry' | 'timeline' | 'grid'` ([src/types/domain.ts:21](src/types/domain.ts#L21)). Keep `timeline` (it's the right name for the chronological-strip metaphor and an important mode), redesign it, and add new modes:

1. **`timeline` (the flagship — horizontal scroll-strip, baseline-aligned).** This is exactly the Codrops `index4.html` / `demo4` reference. Images sit on a shared **horizontal baseline**, with comparable widths but **heights varying naturally** by aspect ratio — a portrait image sits taller, a landscape sits shorter, both anchored to the same bottom line. Horizontal scroll moves through them. Captions sit just under the baseline (`Vapor — 002`, `Halo — 003`, `Pulse — 006`, `Orion — 005` — exactly your screenshot). Display-type gallery title pinned top-center, a `Scroll to see the effect` hint mid-canvas on first paint. Mode-toggle bottom-center floating pill.

   Implementation specifics ([biazo/codrops-animate-shaders-with-gsap demo4](https://github.com/biazo/codrops-animate-shaders-with-gsap/tree/main/src/js/demo4)):
   - `display: flex; align-items: flex-end;` — flex-end gives the baseline anchor.
   - Each image is given a target _width_ (e.g. `width: 28vw` or `width: 380px`); height is derived from the image's natural aspect ratio (`height: auto` and the rendered height naturally varies). This is what the Codrops demo does and what your screenshot shows. The variation is in _height_, not width — the rhythm comes from the silhouette along the top edge.
   - Horizontal scroll is the _default_ gesture; bind it via GSAP's `ScrollTrigger` with `scrub: true` so wheel/trackpad scroll moves the strip horizontally with momentum (the demo's signature feel).
   - Optional: scroll-bound grain/shader effect on each image as it crosses the viewport center (the GSAP+three.js trick the Codrops demo demonstrates) — ambitious but on-brand.
   - Mobile: degrade to vertical stack (current implementation already does this, keep it).

   **What to fix on the existing `TimelineStrip` ([public-gallery-view.tsx:120-142](src/components/gallery/public-gallery-view.tsx#L120-L142)):**
   - Replace `items-center` with `items-end` so images share a bottom baseline instead of a centerline.
   - Replace `flex-none lg:w-1/4 md:w-1/3` width hints with a target width per image (e.g. `flex-none w-[28vw] max-w-[420px]`) and let `<Image>` render at `height: auto` — heights then differ across images by aspect ratio, which is the "rhythm along the top" you can see in the Codrops screenshot.
   - Widen the gap (`gap-2` → `gap-12 md:gap-16`) so the silhouette reads.
   - Add per-image captions: `Subject — NNN` (auto-numbered, mono, demoted, just under each image).
   - Add momentum scroll via Lenis or GSAP ScrollSmoother. Native horizontal-overflow feels mechanical; smooth scroll is the difference between "list of images" and "curated cinematic strip."

2. **`book` — true ratio-aware masonry, dense packing.** The classic editorial publication mode. Vertical scroll. Implementation: bricks.js / `andreasbm/masonry-layout` style or row-justified packing (see Section A). Shared component with the in-app roll grid.

3. **`stage` — one image per viewport, gradient-bleed transitions.** The `gradientslider` reference. Vertical scroll-snap, each image fills viewport, gradient bleed between adjacent frames. For narrative sequences (story, before/after, progression). Less moodboard, more presentation.

4. **`telescope` — scattered images at varying scales, scroll zooms in.** The `joffreysp/telescope-zoom` reference. The most ambitious; ship later. Curators will use this for "hero images" — one or two anchor frames the rest orbit.

5. **Optional: drop `grid` from the enum.** No one chooses a uniform grid for a moodboard. If you keep it, treat it as `book` with a fixed cell size — but the masonry covers this case better.

The existing `timeline` is _not_ badly conceived — it's the right metaphor and the right gesture. It just isn't _composed_. Once images sit on a shared baseline with naturally varying heights, with auto-captions, smooth horizontal scroll and a display title, it becomes the flagship.

**C. Strip the chrome.**
[public-gallery-view.tsx:31-69](src/components/gallery/public-gallery-view.tsx#L31-L69) — the sticky header has Hypermood (left), gallery name (center), mode toggle (right) all at the same weight. The Codrops reference puts `#GSAP #THREE.JS #WEBGL` tag-set top-left, large display-type title centered, course CTA top-right at small weight. Adopt this exact rhythm:

- Top-left: gallery tags or a small "VARIATION — 01.02.03.04" / "ROLL — First / Outdoor shots" line. Mono. Demoted.
- Top-center: gallery title. **Display weight, large** (think 40-60px on desktop). This is the editorial moment.
- Top-right: tiny "Made with Hypermood" attribution that links to your home. Lower than the title's weight by an order of magnitude.
- Mode toggle: not in the header — bottom-center floating segmented control like the "Article / All Demos / GitHub" pattern in the second screenshot you sent. Appears on scroll, fades on idle.

**D. Each image gets a caption.**
The Codrops reference has `Mirth — 007`, `Lucid — 008`, `Astra — 010`, `Veil — 011`, `Dream — 012` — short noun + dotted index. This is what makes a curated work _feel_ curated.

You already have rich metadata. The `subject` field from the vision indexer is a "one noun phrase stating what this image is fundamentally about" — that's literally a caption. Render it under each image in the gallery, mono, demoted, plus an auto-incrementing index. The user can override per-image in the gallery editor (out of scope for now; the auto-caption is enough).

**E. Editorial typography on the gallery page.**
The gallery title currently sets `text-xl font-medium`. That's a body weight. Use a _display_ weight — ideally Diatype's heaviest variant or pair Diatype with a single display serif (e.g. PP Editorial New, Tobias, GT Sectra) for the title only. The Codrops `ANIMATING SHADERS WITH GSAP` is set in a heavy condensed sans — your gallery title deserves equivalent presence.

**F. Scroll-driven motion as the signature.**
You already use `document.startViewTransition` for mode switches. Take it further:

- Header parallax-collapses as the user scrolls into the strip.
- Each image has a scroll-bound subtle scale or grain shader (matching the `animate-shaders-with-gsap` reference's character).
- Crossfade or gradient-bleed between images in `stage` mode.

**G. Reference links — keep these in the codebase for future consultation:**

- [biazo/codrops-animate-shaders-with-gsap (index4.html)](https://github.com/biazo/codrops-animate-shaders-with-gsap/blob/main/index4.html) — the canonical reference for the `timeline` mode (horizontal scroll, baseline-aligned, comparable widths with naturally varying heights, captioned)
- [biazo demo4 source](https://github.com/biazo/codrops-animate-shaders-with-gsap/tree/main/src/js/demo4) — implementation details for the GSAP+ScrollTrigger horizontal-scroll setup
- [andreasbm/masonry-layout](https://github.com/andreasbm/masonry-layout) — true ratio-aware masonry reference (vs. CSS multicolumn) for `book` mode
- [andreasbm CodePen — masonry demo](https://codepen.io/andreasbm/pen/gOOdqVy) — minimal working example of the masonry algorithm
- [clementgrellier/gradientslider](https://github.com/clementgrellier/gradientslider) — horizontal scroll-bound strip with gradient transitions for `stage` mode
- [joffreysp/telescope-zoom](https://github.com/joffreysp/telescope-zoom) — scroll-zoom reference for the future `telescope` mode
- [joffreysp/draggable-grid](https://github.com/joffreysp/draggable-grid) — spatial moodboard reference for a future `freeform` mode (and the repack motion that informs reflow-on-filter in P0 #9)

**H. Roll grid should also be a true masonry.**
The same critique applies to the in-app roll grid ([roll-image-grid.tsx:122](src/components/roll/roll-image-grid.tsx#L122)): `columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 p-4`. Same multicolumn problem — wrong reading order, loose packing, especially noticeable when the user filters down to 3-15 results. Adopt the same ratio-aware masonry algorithm as the gallery's `book` mode. The roll grid and the public gallery's `book` mode then share an implementation. Ship one masonry component, use it twice.

Two things this changes:

1. The result-set reflow (P0 #9) becomes layout-driven, not opacity-driven. When you remove non-matching cells, the masonry repacks — which is exactly the Codrops `draggable-grid` repack motion.
2. The roll empty state, the result view, and the public gallery share the same compositional vocabulary. Coherence ladders up to identity.

---

## P1 — Real, but second priority

### 11. The selection model is a state-machine bug waiting to happen

**File:** [src/components/chat/chat-interface.tsx:195-209](src/components/chat/chat-interface.tsx#L195-L209), [roll-image-grid.tsx:122-148](src/components/roll/roll-image-grid.tsx#L122-L148)

A click on an image _toggles selection_ — there is no separate "open" gesture. Open is a hover button (`⤢`). This is unintuitive: in every photo app a click on an image _opens_ it. Users will discover by accident that clicking selects, then have no muscle memory.

Compounded by:

- The selection clears on `showAll` but not on filter modify
- Selected image is implicitly the input for the next message, but the placeholder text only changes when there's >0 selected
- Selection survives across messages, which is correct, but there's no visible "unlock" except clicking each thumb

**What to change**

- **Click opens the image** (it's the dominant intent for photographers).
- **Shift-click or cmd-click selects** (familiar from Finder/Lightroom).
- **Or: long-press / hover-select with a single dot indicator.** A small circle in the top-left that fills on hover and persists when clicked (Apple Photos pattern).
- **Add a single selection-clearing affordance.** The selection strip should have an explicit "Clear" inline.

### 12. Image-as-prompt is invisible to first-time users

The flow is hidden: select images → type → press send → get similar images. Without onboarding, no one will discover this — and it's your #2 magic moment. Currently the only signal is the placeholder text changing to "Find images similar to these…" once you've selected.

**What to change**

- After 2 images are selected without a query for >3s, surface a single ghost-line under the canvas: _"Find images similar to these — or type to refine."_
- Or: when a selection exists, the suggestion chips become _image-prompt_-specific ("Similar but darker", "Similar but with people", "Similar — close-ups only").

### 13. The `embeddingCache` is a red herring on serverless

**File:** [src/lib/gemini/query-executor.ts:9](src/lib/gemini/query-executor.ts#L9)

```ts
const embeddingCache = new Map<string, number[]>();
```

This is module-scoped. On Vercel/Cloudflare it lives for the duration of one warm Lambda — which on a low-traffic app is essentially never. It works in dev and is invisible in prod.

**Replace with** Postgres-backed cache: a `query_embeddings` table keyed by hash of the text, with a 30-day TTL. You're paying for the embedding once; cache it for real. (Or use `@vercel/kv` / Upstash Redis — but the Postgres path is simpler given your stack.)

### 14. The Inngest pipeline base64-encodes every image

**File:** [src/lib/inngest/functions/index-image.ts:61-70](src/lib/inngest/functions/index-image.ts#L61-L70)

```ts
const imageBuffer = await step.run("download-image", async () => {
  // ... fetch, then:
  return Buffer.from(arrayBuffer).toString("base64");
});
const buffer = Buffer.from(imageBuffer, "base64");
```

`step.run` persists return values into Inngest's step state. A 5MB image becomes a ~6.7MB base64 string in step storage, then is re-decoded. For a 1000-image roll that's ~6.7GB of step-state writes for nothing.

**Fix:** keep the buffer in-memory across steps. The retries argument for using `step.run` (so a retry doesn't re-download) is real but cheap — the download is a CDN GET. Either:

- Drop the wrapping `step.run` for download and analyze in one step.
- Or: pass only the storage key between steps and re-fetch from ImageKit cache (CDN-cached, free).

### 15. Vision + embedding are two sequential Gemini calls per image — run them in parallel

**File:** [src/lib/inngest/functions/index-image.ts:72-107](src/lib/inngest/functions/index-image.ts#L72-L107)

`analyzeImage` finishes, _then_ `embedImage` starts. They have no dependency on each other — both consume the buffer. Run in parallel via `Promise.all`. Cuts per-image indexing latency ~40%.

See item #16 below for whether to keep Gemini at all on the indexing side, or swap parts for open-source VLMs (Gemma 3, Qwen 2.5-VL, SigLIP).

### 16. Open-source VLMs — what's actually worth swapping in, what isn't

You sent links to the Gemma vision collection, Gemma 3 on DeepMind, and the Labellerr roundup of Qwen 2.5-VL et al. The honest answer is: **don't replace Gemini at the indexing layer yet, but keep three specific options in your back pocket.**

Why not now:

- **Gemini 3.1 Flash-Lite is already cheap** — at MVP scale (≤1000 images/roll, single user, cost-sensitive but not zero) you're talking pennies per roll. Self-hosting any open VLM (GPU rental, container ops, batching, model loading) costs more in time and infra than the Gemini bill until you're at thousands of users or millions of images.
- **You'd lose `gemini-embedding-2-preview`'s unified text/image space** — the property that makes magic moment #2 (image-as-prompt) elegant. Centroid blending of text + image vectors only works because they live in the same space. None of the Gemma/Qwen models give you that out of the box; you'd need a separate aligned image+text encoder (CLIP/SigLIP) for embeddings _and_ a second model for metadata extraction. Two models, two failure modes, more complexity.
- **The win you'd most want — faster, cheaper indexing — is better captured by P0 #3 (cut the prompt) and P1 #15 (parallel calls).** Those changes don't add infra and probably get you 50%+ of the latency/cost reduction self-hosting would.

When to revisit, and with what:

1. **SigLIP 2 for embeddings (most interesting near-term).**
   Google's SigLIP family is the open-source alternative to CLIP and outperforms it on zero-shot retrieval. SigLIP 2 ships in multiple sizes; the smaller variants run on CPU and produce 768/1152-dim image+text embeddings in a shared space — exactly what you need to keep image-as-prompt working. Replace `embedImage` + `embedText` with SigLIP and your embedding cost goes to ~zero. You keep Gemini for vision _metadata_ extraction only.
   **Tradeoff:** all 8 indexed images in your test roll need re-embedding (planned migration path already documented in ADR-003). Quality vs. Gemini Embedding 2 is competitive on natural images; on screenshots/UI/graphics it's untested.
   **Trigger to revisit:** when monthly Gemini embedding cost exceeds ~$50, or when you want offline indexing.

2. **Gemma 3 (4B/12B vision variants) for metadata extraction.**
   Open-weight, multimodal, runs on a single consumer GPU with quantization. Could replace Gemini 3.1 Flash-Lite for the structured-JSON metadata call. Quality on the kind of structured extraction you're doing (scene/colors/tags) is acceptable; you'd lose some nuance on the `description` field which is the embedding-relevant one.
   **Tradeoff:** you now operate a GPU. Modal/Replicate/RunPod can wrap this in a serverless-style API for ~$0.0002–$0.001 per call, often cheaper than Gemini at scale.
   **Trigger to revisit:** indexing volume per month makes Gemini vision cost dominate, OR a user explicitly requires on-prem/private indexing (a real ask for some photographer/designer customers — moodboards include unreleased client work).

3. **Qwen 2.5-VL — only if you ship a "describe / OCR" power feature.**
   The Labellerr roundup is right that Qwen 2.5-VL is currently the strongest open VLM on dense OCR and document understanding. If you ever build a feature like "find images containing this exact text" or want robust receipts/screenshots metadata, Qwen is the right choice for that _specific_ layer — not as a base-layer replacement.

**Recommendation:**

- Now: do nothing on the model layer. Cut the prompt (P0 #3), parallelize calls (P1 #13). That's the cheapest, biggest win.
- Next 3 months: prototype SigLIP 2 as a parallel embedding path. Run it shadow-mode on new uploads and measure retrieval quality vs. Gemini Embedding 2 on your real rolls. If quality holds, flip it on for new rolls (keep `embedding_model_version` as already designed) and stop paying for embeddings.
- Later, if needed: move metadata extraction to Gemma 3 on Modal/Replicate when economics demand it.

The Hugging Face Gemmaverse vision collection link you sent is mostly fine-tunes of Gemma — none change this calculus. The "best open VLM" charts cycle every 3 months; lock to a class (open multimodal embeddings, open structured-output VLM) not a specific model name.

---

### 17. Uploads route through Next.js, not directly to ImageKit

**File:** [src/app/api/images/upload/route.ts](src/app/api/images/upload/route.ts), [src/lib/imagekit/upload.ts](src/lib/imagekit/upload.ts)

The current path: browser → Next route → ImageKit → response → DB row → Inngest event. The Next.js server is a relay for binary data it doesn't process.

ImageKit supports **client-side direct upload** with a short-lived signed token. The flow becomes: server returns signed token → browser uploads directly to ImageKit → on success, browser calls a tiny "register" route that does the DB insert + Inngest dispatch. Benefits:

- Removes ~200KB-5MB per file from your function bandwidth (Vercel charges for this).
- Parallel uploads from the client are no longer bottlenecked through the function.
- Faster feedback — the UI sees per-file progress directly.
- Eliminates the function timeout risk on large batches.

`@imagekit/next` already has the `getUploadAuthParams` helper exported on the server side — half of this is built.

### 18. The query-executor metadata path filters in JS at scale ceiling

**File:** [src/lib/gemini/query-executor.ts:67-105](src/lib/gemini/query-executor.ts#L67-L105)

When there's no `semantic_search`, the executor over-fetches up to 500 indexed images and filters in JS. The comment acknowledges this is a hack ("PostgREST cannot apply raw JSONB WHERE clauses via the JS client"). It's correct that PostgREST is awkward here — but you already have `search_images_by_embedding_filtered` which proves you can pass a `p_where_clause` SQL fragment to a SECURITY DEFINER RPC. Make a `filter_images_by_metadata` RPC that takes the same allow-listed clause and runs it natively.

The current path is fine for 1000 images. It will fall over at 5K. Worth fixing before you hit it.

### 19. Filter chips behave inconsistently

**File:** [src/actions/chat.ts:67-72](src/actions/chat.ts#L67-L72)

`mergedFilters = deduplicateFilters([...(activeFilters ?? []), ...plan.filters])` — this preserves filters across queries. But the LLM prompt explicitly says (rule 12): "Translate ONLY the current query into filters. Do not carry over". So the _LLM_ doesn't know about active filters, but the _server_ merges them post-hoc. This means:

- "show me indoor shots" → `[setting=indoor]`
- then "show me golden hour" → LLM returns `[time_of_day=golden hour]`, server merges → `[setting=indoor, time_of_day=golden hour]`

This is sometimes what users want and sometimes not. There's no way to express "fresh start" except clicking "show all". And `clarification_note` from the LLM is generated in ignorance of the active filters, so it can read incoherently next to the merged result.

**Recommended:** be explicit. Each query is a fresh translation. Active filters are _only_ added by chip + button. Add a "Refine" toggle that explicitly says "Filter further within these N results" — this is the spatial-product gesture for accumulation, and it's missing.

---

## P2 — Polish, but each one earns its keep

### 20. Inconsistent component shapes

The design philosophy in `plan/architecture.md` says `rounded-none` on images, `rounded-2xl` on floating chat. The reality has `rounded-3xl`, `rounded-2xl`, `rounded-xl`, `rounded-full`, `rounded-sm`, `rounded-none` distributed without rule. Pick two: `rounded-none` for content, one radius for ephemeral surfaces. Strip the others.

### 21. The `animate-bloom` keyframe is the only motion language

A 150ms scale-from-0.95 is fine for hover popovers but it's used for everything from filter chips to the preview panel to selection thumbs to Darkroom arrows. Codrops-grade craft means _different gestures for different scales_: micro hover (200ms ease-out colour), reveal (500ms ease-out + clip-path), navigation (700ms view-transition). One animation everywhere = no animation language.

### 22. No skeletons / suspense on app shell

`app/(app)/layout.tsx` does `await listRollsCached()` + `await getRollThumbnails()` _sequentially_ before rendering. First navigation to `/rolls` hits both DB calls before the user sees anything. Run them in parallel via `Promise.all`, and stream the layout via Suspense boundaries so the rail and the main render independently.

### 23. The OTP login looks great, but the dark/light context switch is jarring

**File:** [src/app/(auth)/login/page.tsx](<src/app/(auth)/login/page.tsx>).
The login is the strongest screen visually. Then you land in the white app and it feels like a different product. Either lean into it (a brief dark intro frame on first sign-in that fades to white as the rolls load — view-transition territory), or unify the chrome.

### 24. The pluralization and copy are ad-hoc

"1 rolls" on the rolls page, "8 images · 8 indexed" stat reads engineering, the "Drop images anywhere to start" empty state reads correct but can be elevated. Pick one editorial voice. For the moodboard / photographer audience, lean editorial — "First roll" not "Rolls", "Eight images, all indexed" not "8 images · 8 indexed".

### 25. `result_image_ids` survives realtime drift

**File:** [src/components/chat/chat-interface.tsx:97-105](src/components/chat/chat-interface.tsx#L97-L105).
On mount, the last assistant message's `result_image_ids` becomes the active result set. But if any of those images have since been deleted (Realtime might have already removed them), they appear as gaps in the dimming logic. Filter `result_image_ids` against `liveImages` before applying.

### 26. Drag-to-reorder in the gallery drawer uses HTML5 DnD

**File:** [src/components/gallery/gallery-drawer.tsx:294-313](src/components/gallery/gallery-drawer.tsx#L294-L313).
HTML5 DnD is poor on touch and has visual quirks (ghost image, no rubber-band). For a curation app this should feel like Lightroom. Use `@dnd-kit/sortable` or write a pointer-event reorder. Small surface, big quality jump.

### 27. The history drawer animation conflicts with the input bar

The drawer slides from `bottom-0` and _covers_ the floating bar, so to send another message the user closes the drawer first. Either drawer pushes the input up, or input persists above the drawer, or the drawer is a side-sheet. Currently it's neither.

---

## What to do next, in order

1. **Replace the Rail with a top-bar + cmd-k switcher** (P0 #7, Option A). Reclaim 224px of canvas, fix the wordmark clipping and horizontal-scroll bug, give Galleries a real entry point.
2. **Strip and rebuild the chat input** (P0 #1). One quiet textarea. Move filters to the result surface, follow-ups to the assistant message, status to a low-contrast above-input line. Drop the bubble shell.
3. **Build the real masonry component, use it twice** (P0 #5 + P0 #10H). Ratio-aware (or row-justified) packing. Use it for the roll grid _and_ the gallery `book` mode. This unlocks reflow-on-filter (P0 #9) for free and is the foundation for all gallery modes.
4. **Reflow on filter, don't dim** (P0 #9). The result view is the heart of the app and it's currently 97% empty space + ghosts. Once the masonry exists, the matched cells repack and the non-matches dissolve out.
5. **Redesign the public gallery `timeline` mode** (P0 #10A–F). Codrops `index4.html` / `demo4` reference: horizontal scroll, baseline-aligned, comparable widths with naturally varying heights, smooth-scroll, auto-captioned (`Subject — NNN`) from the `subject` field. Display-type title pinned top-center. This is the front face of the product — the share artifact.
6. **Fix Galleries discoverability and copy-link flow** (P0 #9). Inline copy on save-success, default-public, drop the hidden gallery-intent regex.
7. **Rebuild the rolls index page as an editorial gallery** (P0 #6). 3-column asymmetric mosaic, display type, no green badge.
8. **Reform the typography rules** (P0 #6 + P0 #9). Mono = system data only (numbers, ids, dimensions). Demote labels via Diatype Sans size/weight, not by switching family.
9. **Make the index → command-center → darkroom transition continuous via View Transitions** (P0 #8).
10. **Cut the vision prompt to ~10 fields and run vision + embedding in parallel** (P0 #3, P1 #15). Re-index the test rolls. Measure latency drop.
11. **Add the fast-path query template + stream the LLM call** (P0 #4). Most chat turns become invisible.
12. **Replace the fake stream-of-thought** (P0 #2). Either real phase events or a single "thinking" line.
13. **Virtualize the masonry + drop `unoptimized` Images + LQIP blur** (P0 #5).
14. **Kill the embeddingCache and replace with Postgres-backed query embedding cache** (P1 #13).
15. **Move uploads to client-direct ImageKit** (P1 #17).
16. **Ship the second and third gallery modes** (P0 #10B): `book` (true masonry, shares code with the roll grid) and `stage` (gradientslider-style one-image-per-viewport with gradient bleeds). `telescope` mode is a later moonshot.

Items 1–6 alone — done well — change the perceived class of the app. Everything else is real, but those are the ones the user will feel first.

---

## What to keep, deliberately

- The architectural decisions in `plan/architecture.md` — they're sound. Two-stage retrieval, `embedding_model_version` versioning, the storage_key abstraction, RLS-from-day-one — all correct.
- The Diatype + Neue Montreal Mono pairing.
- The OTP-with-segmented-boxes login flow — it's the strongest visual moment in the app today.
- Inngest. Don't move job queues mid-flight unless you discover a hard limitation. The base64 round-trip is a real waste but it's a 30-line fix, not a platform change.
- Gemini Embedding 2. The unified text/image vector space is precisely what makes the magic moment #2 (image-as-prompt) work.
- pgvector + Supabase. At your scale (≤1000 images/roll, single user/few users), this is correct.
