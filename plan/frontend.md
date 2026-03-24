# Hypermood — Frontend Specification (v2)

## Design Philosophy

The photography and the chat are kings. Everything else disappears.

A pristine canvas anchored by Swiss design principles and warm, subtle tones. The UI is generally invisible—a hidden structure waiting to be summoned. It balances the intuitive, conversational simplicity of Gemini and Claude with the stark, editorial clarity of Antigravity. It is emphatically *not* a conventional 2020 SaaS dashboard.

One single exception: the login screen is a void—fully dark—a deliberate threshold marking entry into the system.

---

## Design System (Tailwind CSS)

Hand-built components only. Tailwind utilities throughout. Custom CSS strictly reserved for complex masonry layouts and tailored micro-animations.

### Colors: Warmth & Restraint

Colors are an exercise in restraint. The core palette shifts from harsh, pure grays to a subtly warm, elegant grayscale (akin to warm zinc). Semantic colors are allowed but must be incredibly punctual, used strictly when communication requires it (e.g., success, error, or selection).

```ts
// tailwind.config.ts — warm minimalism
colors: {
  primary: {
    DEFAULT: '#18181A', // Zinc-900
    50:  '#FAFAFA', // Zinc-50
    100: '#F4F4F5',
    200: '#E4E4E7',
    800: '#27272A',
    900: '#18181A',
    950: '#09090B', // Login void
  },
  neutral: {
    DEFAULT: '#FFFFFF', // Canvas
  },
  semantic: {
    info: '#3B82F6',    // Punctual blue for selections/links
    success: '#10B981', // Elegant green for indexing completion
    alert: '#EF4444',   // For destructive actions
  }
}
```

**How to use shades intelligently:**
- **The Canvas:** Overwhelmingly, text is warm black (`primary-900`) on a pure white (`neutral-DEFAULT`) or warm off-white (`primary-50`) canvas.
- **No Muted Text:** We establish hierarchy through typographic size and weight natively, not by diluting the text color to gray. 
- **States & Hover:** Shades like `primary-100` are used intelligently for button hover states. Semantic colors appear purely as transient states (a success badge, an active selection ring) and never as overarching backgrounds.

### Typography

Swiss design dictates our typographic rhythm: precision, legibility, and confidence. An absolute rejection of tiny, legibility-straining body copy.

**Fonts:**
- **Sans:** `"Dyatype Sans"` — highly careful use of sizes.
- **Mono:** `"Neue Montreal Mono"` — technical readouts: timestamps, counts, scores, tags etc.

```ts
fontFamily: {
  sans: ['"Dyatype Sans"', 'Helvetica Neue', 'system-ui', 'sans-serif'],
  mono: ['"Neue Montreal Mono"', 'monospace'],
}
```

**Scale — no extreme variations, just punctual shifts:**
| Class                                | When                                    |
| ------------------------------------ | --------------------------------------- |
| `text-5xl tracking-tight`            | Login screen hero title                 |
| `text-3xl font-medium`               | Roll names, definitive headers          |
| `text-xl font-medium`                | Section headings, panel titles          |
| `text-lg`                            | Body copy, chat messages. *Never smaller.* |
| `text-base font-medium`              | Button labels, active elements          |
| `text-base font-mono`                | Timestamps, metadata, technical labels  |

### Spacing & Layout

Content needs air to breathe. Generous negative space acts as the invisible framework holding the app together. Page padding feels expansive. Grids are fluid but strictly aligned.

### Surfaces & Borders

**Sharp edges with punctual softness.**
- **Default:** `rounded-none`. The app is sharp. Images and layout panels have crisp, hard edges echoing physical photography prints.
- **Punctual Curves:** `rounded-xl` or `rounded-2xl` are selectively applied to floating UI components generated *within* the chat, or the chat input box itself. These fluid elements stand out gently against the sharp photographic grid.
- **Depth:** No drop shadows. Depth is achieved via pure background shifts (e.g., pure white over `primary-50`).

### Motion & Animation

Animations must feel intentional, magical, and highly punctual. They never exist just to occupy time or add unnecessary flair.
- **Custom Utility Classes:** To keep the codebase clean and physics consistent, define custom classes in your `globals.css` instead of dumping utility strings everywhere:
  - `.animate-bloom`: For generative UI elements appearing in the chat (fast `opacity-0 scale-95` to `opacity-100 scale-100` transition over `150ms ease-out`).
  - `.animate-swiss`: For standard hover state micro-interactions (`transition-all duration-200 ease-out`).
- **Engineered Easing:** Avoid bouncy, rubber-band physics. Motion should feel Swiss—engineered, exacting, and razor-sharp.
- **Micro-interactions:** Applied strictly to moments of discovery (like the rail's micro-preview fading in) or state changes (button hovers). Everything else is instant.

---

## Architecture & Screens

### 1. The Rail (Not a Menu, A Portal)

Taking cues from Gemini, the sidebar is not a traditional dashboard menu—it is your direct access to Rolls.
- **Behavior:** It sits silently on the left.
- **Hover Reveal:** When hovering over a Roll name in the rail, a micro-preview pops up: 4 mini-mini thumbnails (a 2x2 grid) showing a glimpse of the roll before you click.
- **Aesthetic:** Unobtrusive, flush with the canvas. Typography is `text-lg`.

### 2. The Command Center (Chat Above Grid)

This is the core of the engine. The Chat and the Grid are two distinct entities that work symbiotically in a vertical stack on the roll view screen.

**The Chat (The Engine, Top):**
- A dedicated conversational interface that lives directly *above* the grid of images.
- Clean, large typography (`text-lg`).
- The input box is a single, centered, punctually-rounded (`rounded-2xl`) element resting prominently at the top, driving the grid below.

#### Suggestions (Solving the Blank Canvas)

The chat input must never feel cold. Contextual suggestions guide the user into their first interaction and keep the conversation flowing after each result.

**Initial suggestions (empty chat, no query yet):**
- 3-4 suggestion chips appear beneath the chat input when no conversation exists. Displayed as ghost-style pills (`rounded-xl`, `text-base`, `border border-primary-200`, `hover:bg-primary-100`), laid out horizontally, centered beneath the input.
- **After indexing completes:** suggestions are *generated from the actual roll metadata*. The system scans the indexed metadata (top tags, scene types, people count distribution, quality range) and produces contextual starters. Examples: `"Show me all outdoor golden hour shots"`, `"Find the group photos"`, `"Best quality images"`. This is a lightweight server-side computation on metadata stats, not an LLM call.
- **Before indexing completes (or for very small rolls):** static universal suggestions: `"Show me the best shots"`, `"Find all portraits"`, `"What's in this roll?"`.
- Clicking a suggestion pre-fills the chat input and auto-sends it.

**Follow-up suggestions (after each query result):**
- After every assistant response that returns results, 2-3 follow-up suggestion chips appear beneath the response in the chat. Same pill styling.
- Follow-ups are contextual to the current result set. Generated by the query interpreter (Gemini Flash) as part of its response — the system prompt asks for `suggested_followups: string[]` alongside the query plan.
- Examples based on context: `"Narrow to close-ups only"`, `"Exclude blurry ones"`, `"Show only warm tones"`, `"Save as gallery"`.
- Follow-ups reference what just happened — they are not generic. If the result set is mostly outdoor scenes, a follow-up might be `"Split by time of day"`. If many results have people, it might be `"Without people"`.
- Clicking a follow-up sends it as the next message. The conversation continues.

#### Stream of Thought (Processing Indicator)

When a query is processing, the chat shows a subtle, mono-font processing sequence that reveals what the system is doing — not a spinner, not a progress bar.

- Appears as a temporary assistant message in `text-base font-mono text-primary-200`.
- Lines appear one by one with `.animate-bloom`:
  - `Interpreting query...`
  - `Searching 1,000 images...`
  - `Found 47 matches`
- Once results are ready, the processing message is replaced by the real assistant response. The transition is instant — processing lines fade, real response blooms in.
- For image-as-prompt queries: `Computing visual similarity...` → `Blending with text prompt...` → `Found 50 matches`.
- Keeps the user informed without interrupting the Swiss-minimal aesthetic. Feels like watching a terminal — purposeful, precise.

#### Actionable Interpreted Filters

The interpreted filter (collapsed by default on each assistant response) is not just diagnostic — it's a direct manipulation tool.

- When expanded, the filter renders as a row of editable chips. Each chip represents one filter condition (e.g., `scene: outdoor`, `blur_score < 0.3`, `tags: portrait`).
- **Click × on a chip** → removes that filter → query re-runs automatically → grid updates.
- **Click + to add a filter** → opens a small inline input where the user can type a new condition (or pick from metadata fields). The system re-runs the query with the added filter.
- This lets users start with natural language ("outdoor portraits, no blurry ones") and then surgically fine-tune with direct manipulation — remove `outdoor` to see indoor portraits too, or add `composition: close-up`.
- Chips use `text-base font-mono`, `bg-primary-100 rounded-lg px-3 py-1`, × button on hover.

**The Grid (The Output, Bottom):**
- Fluid masonry layout flowing strictly beneath the chat interface. Images are edge-to-edge relative to their cells. `gap-1`.
- **Click** on any image toggles its selection state — no mode switch, no button to enter "select mode." Selection is always available.
- **Hover** on any image reveals contextual tools (Fullscreen icon to open Image Detail) with zero layout shift. These tools appear as small overlaid icons with `.animate-bloom`.

#### Image-as-Prompt Selection Flow

Selection is the gateway to the most powerful feature in the app. It must be frictionless — one gesture, no modes, no menus.

**Selecting:**
- Clicking an image in the grid toggles selection. Selected images receive `ring-2 ring-semantic-info ring-offset-2`. Click again to deselect.
- A **selection strip** appears inside the chat input area, directly above the text field, the moment the first image is selected. It uses `.animate-bloom` on appear. The strip contains:
  - Small square thumbnails of selected images (`w-5 h-5`, `rounded-none`), scrollable horizontally if many are selected. Each thumbnail has a small × to deselect on hover.
  - A count line directly beneath the thumbnails, above the text input: `"16 selected"` in `text-base font-mono`.
- When no images are selected, the strip is invisible. The chat input looks exactly as it always does.

**Querying:**
- The user types a text prompt alongside the selections (e.g., "find 50 more with this same vibe") and sends. Both the selected image references and the text are submitted together to the image-as-prompt pipeline.
- The system returns results. The grid responds:

**Grid State After Results:**
- **Result images:** Full `opacity-100`. These are the matches.
- **Reference images (the user's selections):** Keep their `ring-2 ring-semantic-info` selection ring at full opacity. They remain visually distinct as "input."
- **All other images:** Dim to `opacity-15`. They become ghosts — present for spatial memory, but the eye skips over them entirely. The grid does not reflow. No images disappear. No layout shift.
- **Result count** appears near the chat as `"50 results from 1,000"` in `text-base font-mono`.
- The user can refine with another chat message ("narrow to 20", "exclude the ones with people"). The grid updates — some previously bright images dim, or vice versa. The conversation builds on itself.
- **Clearing:** Typing "show all" in chat, or a small ghost-style reset button near the result count, restores all images to `opacity-100` and clears selections. Back to the full roll.

#### Preview Panel (The Narrative Check)

After a selection or query result exists, the user needs a way to see the curated set as a cohesive narrative — without losing spatial context in the main grid.

**Slide-up panel:**
- A panel rises from the bottom of the viewport, covering roughly the lower 60% of the screen. The main grid stays behind it, dimmed by the panel's subtle backdrop (`bg-primary-950/40`).
- **Trigger:** A small "Preview selection" ghost button appears near the result count once results exist. Alternatively, a keyboard shortcut (e.g., `Space` when images are selected).
- **Content:** The selected/result images displayed in a tight masonry grid (3-4 columns, small thumbnails). Clean, dense, narrative-focused — this is where the user judges whether the set tells a story.
- **Header inside the panel:** The count (`"50 images"` in `text-xl font-medium`), and a "Save as Gallery" button (`bg-primary-900 text-white rounded-xl`).
- **Save flow:** Clicking "Save as Gallery" reveals inline fields within the panel — gallery name input, layout toggles (masonry/timeline), visibility toggle (public/private). Submit creates the gallery. The panel closes. A confirmation appears in the chat: "Gallery saved → [link]".
- **Dismiss:** Click the backdrop above the panel, press Escape, or drag the panel down. The grid underneath is exactly where the user left it — no reflow, no state change.
- **Animation:** The panel slides up with `.animate-bloom` timing (150ms ease-out). Images inside populate with a subtle stagger.

### 3. Upload (Ambient & Frictionless)

No dedicated page. 
- For V1 simplicity, dragging files over a generous area of the page (e.g., the **Image Grid** or **Chat UI**) triggers the upload state, rather than hijacking the entire viewport. A crisp overlaid typography reads: "Drop to index."
- Progress is indicated by a simple, monospaced readout (`Uploading & Indexing 14 of 42...`), allowing the user to immediately start chatting with already-indexed images while background processors (Inngest) handle the rest.

### 4. Image Detail (The Darkroom)

When a specific image demands focus:
- A full-screen overlay. The background is either pure black (`primary-950`) or pure white, isolating the image completely.
- The image commands maximum viewport space, maintaining its exact aspect ratio.
- Hidden UI: hover near the edges to reveal next/prev arrows, or hover the bottom to summon technical details (mono font typography showing dimensions and index data).

### 5. Settings / Manager (Magical UI or Modal)

Settings and gallery management are ideally surfaced via natural language (e.g., "Show my settings card"). If a permanent home is needed, it opens in a stark, full-height drawer from the right, relying purely on grid alignment instead of boxed cards.

### 6. Public Gallery (`/g/[slug]`)

Pure, uninterrupted content for external viewers. No sidebar, no chat engine.
- **Top Bar (Minimalist Header):** 
  - **Top Left:** Small, sharp logo.
  - **Top Center:** Gallery name (`text-xl font-medium`).
  - **Top Right:** View mode toggle icons (if the owner enabled multiple layouts).
- **View Modes:**
  - **Masonry:** A regular masonry layout (fluid columns, vertical scroll). Images maintain native aspect ratios and gap-16. 
  - **Mobile:** Folds into a natural vertical scroll (`flex flex-col`). Images snap to a full-width 1-column stack.
  - **Timeline:** A responsive timeline layout:
    - **Large Screens:** A horizontal scroll track (`flex flex-row overflow-x-auto items-center`). Images sit side-by-side, perfectly aligned on their central X-axis. Each image has a maximum width equivalent to exactly one column of a 4-column grid (`lg:w-1/4`), preserving their original aspect ratios.
    - **Mobile:** Folds into a natural vertical scroll (`flex flex-col`). Images snap to a full-width 1-column stack.
    - Gaps between images across all breakpoints are strictly fixed to `0.5rem` (`gap-1 md:gap-2`).
- **Flawless Transitions:** When possible, the switch between Masonry and Timeline modes must be incredibly smooth and animated (e.g., using Framer Motion or the View Transitions API) to gracefully reflow images from a vertical grid into a horizontal sequence without jarring layout jumps.

### 7. Login (`/login`)

**The Dark Void.**
- Full viewport, warm black (`primary-950`).
- "Hypermood" in `text-5xl tracking-tight text-white font-sans`. Centered.
- **Step 1 — Email:** A single `rounded-none` email input, a single "Continue" button. No labels, no supporting copy. Absolute silence.
- **Step 2 — OTP code:** 6 individual digit boxes (`w-12 h-14`, `bg-primary-900`, `border-primary-800`). This is the segmented input (`OtpBoxes` component in `(auth)/login/page.tsx`):
  - **Paste:** intercepts clipboard, distributes digits across all 6 boxes instantly, auto-submits if all 6 are filled.
  - **Typing:** auto-advances focus to the next box on each digit.
  - **Backspace:** clears the current digit, or retreats to the previous box if already empty.
  - **Auto-submit:** fires `verifyOtp` the moment all 6 digits are present — no submit button on this step.
  - **Error state:** all box borders shift to `border-semantic-alert`.
  - **Focus state:** focused box border shifts to `border-white` (via `focus:border-white`).
  - Context line above boxes: `"Code sent to [email]"` in `text-base font-mono text-primary-200`.
  - Ghost link below: `"Use a different email"` in `text-sm font-mono text-primary-800 hover:text-white`. Resets to Step 1.
- Focus ring inverted from app default: `focus:ring-2 focus:ring-white` (background is dark).

---

## Technical Considerations

- **Next.js & ImageKit:** Aggressive caching, intelligent `srcset`, and perfect `sizes` attributes ensure desktop masonry grids populate instantly.
- **Generative Chat UI:** Components inside the chat must be highly composed and state-aware, capable of mutating based on user interaction while preserving strict top-to-bottom conversational flow. Use React Server Components or tailored UI streaming (e.g., Vercel AI SDK) for these magical components.
- **Accessibility:** Keyboard navigation must be flawless, with custom, sharp focus rings (`focus:ring-2 focus:ring-primary-900`) enabling power users to navigate the generative UI and image grid efficiently.
