# Hypermood — Frontend Specification

## Design Philosophy

The images are the interface. Everything else disappears.

White canvas. The UI is structure, not decoration — borders, type, and whitespace do all the work so the user's images carry every ounce of visual weight. Think cosmos.so's density, Emele Collab's numbered grid clarity, Are.na's search-over-content overlay pattern. Photography-native. Invisible UI.

One exception: the login screen is fully dark (`primary-950`) — a single, deliberate inversion that marks the threshold into the app.

---

## Design System (Tailwind CSS)

Hand-built components only. No shadcn/ui, no Radix, no Headless UI. Tailwind utilities throughout. Custom CSS only for masonry layout, custom scrollbars, and complex animations.

### Colors

Four scales derived from the project's design system. Each scale is a full spectrum — use the shades, not just the DEFAULT.

```ts
// tailwind.config.ts — extend colors
colors: {
  primary: {
    DEFAULT: '#000000',
    50:  '#F7F7F7',
    100: '#E3E3E3',
    200: '#C8C8C8',
    300: '#A4A4A4',
    400: '#818181',
    500: '#666666',
    600: '#515151',
    700: '#434343',
    800: '#383838',
    900: '#1A1A1A',
    950: '#000000',
  },
  secondary: {
    DEFAULT: '#007AFF',
    50:  '#EBF5FF',
    100: '#D6EBFF',
    200: '#ADD6FF',
    300: '#85C2FF',
    400: '#5CADFF',
    500: '#007AFF',
    600: '#0062CC',
    700: '#004A99',
    800: '#003166',
    900: '#001933',
  },
  tertiary: {
    DEFAULT: '#00FF94',
    50:  '#EDFFF7',
    100: '#D6FFED',
    200: '#ADFFDB',
    300: '#85FFC9',
    400: '#5CFFB7',
    500: '#00FF94',
    600: '#00CC76',
    700: '#009959',
    800: '#00663B',
    900: '#00331E',
  },
  neutral: {
    DEFAULT: '#F8F9FA',
    50:  '#FDFDFE',
    100: '#F8F9FA',
    200: '#F0F1F3',
    300: '#DEE0E3',
    400: '#BEC2C8',
    500: '#9EA3AB',
    600: '#6C727F',
    700: '#4A4F59',
    800: '#2E3238',
    900: '#1A1D21',
  },
  status: {
    success: '#16A34A',
    error:   '#DC2626',
    warning: '#CA8A04',
    info:    '#007AFF',
  },
}
```

**How to use shades — not just defaults:**

- **Primary scale** is the workhorse. `primary-950` for headings and primary buttons. `primary-700` for secondary text emphasis. `primary-400` for disabled/muted text. `primary-100` for subtle dividers. `primary-50` for hover backgrounds on white surfaces. The whole range is in play.
- **Secondary (blue)** signals interactivity and selection. `secondary-500` for active states, selected image rings, links. `secondary-50` as a tinted background for selected/active items (e.g. a selected chat filter chip). `secondary-100` for hover on blue-tinted elements. `secondary-700` for text-on-light when blue needs to pass contrast. Never use blue decoratively — it always means "this is interactive" or "this is selected."
- **Tertiary (green)** is the rarest color. `tertiary-500` only for success/complete indicators — an indexed badge, a "live" gallery dot. `tertiary-50` as a background tint for success states. `tertiary-700` for text-on-light success messages. Never more than one or two green elements visible on any screen.
- **Neutral** handles surfaces. `neutral-50` for page-level background (or pure white). `neutral-100` for card backgrounds and input fills. `neutral-200` for borders and dividers. `neutral-300` for stronger dividers (panel splits). `neutral-500` for placeholder text. `neutral-600`–`neutral-700` for secondary body text.
- **Status** colors appear only inside badges and inline indicators. They don't bleed into backgrounds, borders, or buttons. Exception: `status-error` can tint a destructive button on hover.

### Typography

**Font:** `"Instrument Sans"` — weights 400, 500, 600, 700. Single family throughout.
**Mono:** `"JetBrains Mono"` 400 — metadata values, tag chips, technical readouts.

```ts
fontFamily: {
  sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'monospace'],
}
```

**Scale — use what the moment needs:**

| Class                      | When                                    |
| -------------------------- | --------------------------------------- |
| `text-5xl font-bold`       | Login screen title, hero empty states   |
| `text-3xl font-semibold`   | Roll name as page header, gallery title |
| `text-xl font-semibold`    | Section headings, panel titles          |
| `text-base font-medium`    | Important labels, active nav items      |
| `text-sm`                  | Body, chat messages, descriptions       |
| `text-xs text-primary-400` | Timestamps, counts, subtle metadata     |
| `text-xs font-mono`        | Tags, scores, dimensions, file sizes    |

No ceiling. Typography serves hierarchy, not uniformity.

### Spacing & Layout

Base unit: 4px (Tailwind default). Page padding: `px-6` (content area, right of sidebar). Max content width: `max-w-screen-2xl`. Image grids use CSS Grid with `auto-fill` + `minmax()`.

### Navigation Pattern

**Sidebar rail** — always visible on the left edge. Two states:

- **Collapsed (default):** `w-14`, icon-only, `bg-primary-950` (dark rail on white page — the one persistent dark element, echoing login). Icons in `text-primary-300`, active icon highlighted with `bg-primary-800 text-white rounded-lg`. Logo mark at top. User avatar at bottom.
- **Expanded (on hover or toggle):** `w-56`, reveals text labels next to icons. Same dark background. Smooth width transition `duration-200`.

This pattern comes from the sidebar reference (image 4). The dark rail creates a strong left anchor and frames the white content area. Navigation items: Dashboard, Upload, Galleries, Settings.

### Surfaces & Borders

- Borders: `border border-neutral-200`. Thin, barely there.
- Images: `rounded-none` always. Sharp corners, no exceptions.
- UI elements (buttons, inputs, chips): `rounded-md`.
- Cards/panels: `rounded-lg` max. Panels that sit flush to edges get no radius on the flush side.
- No box shadows anywhere. Depth through background color shift only: white → `neutral-50` → `neutral-100`.

### Interactive States

**Buttons:**

- Primary: `bg-primary-950 text-white hover:bg-primary-800 active:bg-primary-700`
- Secondary: `bg-neutral-200 text-primary-900 hover:bg-neutral-300`
- Ghost: `text-primary-500 hover:bg-primary-50 hover:text-primary-900`
- Accent: `bg-secondary-500 text-white hover:bg-secondary-600` — reserved for the single most important action per screen

**Inputs:** `bg-neutral-100 border-neutral-200 focus:bg-white focus:border-primary-950 focus:ring-1 focus:ring-primary-950`
**Image selection:** `ring-2 ring-secondary-500 ring-offset-2`
**Image hover:** `opacity-90 transition-opacity duration-150`
**All transitions:** `duration-150 ease-out`. No spring, no bounce.

### Icons

Lucide React. 16px inline, 20px standalone. Stroke width 1.5. Outline only, never filled.

---

## Screens

### 1. Dashboard (`/`)

Content area right of sidebar. No separate top bar — the sidebar handles navigation.

**Stats:** three numbers in a row — total rolls, total images, total indexed. Large type (`text-3xl font-semibold`), small labels beneath (`text-xs text-primary-400`). No cards around them, just numbers and air.

**Rolls list:** each roll is a card showing a 2×2 or 1×4 thumbnail mosaic (like cosmos.so collection cards), roll name, image count, indexing progress as text ("847 / 1,000"). Cards laid out in a responsive grid (`auto-fill`, `minmax(280px, 1fr)`, `gap-4`). Thumbnail mosaics use `gap-0.5`, images `rounded-none`. Card itself: `bg-neutral-50 rounded-lg p-3`. Roll name below thumbnails.

**Empty state:** centered, generous whitespace. `text-4xl font-bold text-primary-300` message. Upload CTA as accent button.

### 2. Roll View (`/rolls/[id]`)

Two-panel split, full viewport height (minus nothing — sidebar is vertical, not a top bar).

**Left — Chat panel:** `w-[400px]`, `border-r border-neutral-200`, `bg-white`. Scroll for message history. User messages: `bg-primary-900 text-white rounded-lg px-3 py-2 text-sm`, right-aligned. System messages: `bg-neutral-100 text-primary-800 rounded-lg px-3 py-2 text-sm`, left-aligned. Sticky input at bottom: `bg-neutral-100 rounded-lg` with no visible border, send icon right. Above input: reference image strip (small 40×40 thumbnails with × to deselect) — hidden when empty.

**Right — Image grid:** fluid width. Top strip: roll name (`text-xl font-semibold`), count ("47 of 1,000" in `text-sm text-primary-400`), select mode toggle (ghost button). Grid: `auto-fill`, `minmax(180px, 1fr)`, `gap-1`. Images `object-cover` in fixed-height cells (~200px). In select mode, click toggles `ring-2 ring-secondary-500 ring-offset-2`. Indexing progress: `h-0.5 bg-secondary-500` bar at very top, only visible during processing.

Grid fades content on query update: container `opacity-0 → opacity-100` over `duration-200`.

### 3. Upload (`/upload` or modal from Dashboard)

Centered, `max-w-xl`, white card on `neutral-50` page background.

Roll selector: dropdown or inline "New roll" with name input. Drop zone: `border-2 border-dashed border-neutral-300 rounded-lg`, icon + text. Hover state: `border-secondary-400 bg-secondary-50`.

After file selection: vertical list per image — small thumbnail, filename, status chip. Status uses shade-aware colors: pending = `bg-neutral-100 text-primary-400`, processing = `bg-yellow-50 text-yellow-700`, indexed = `bg-tertiary-50 text-tertiary-700`, failed = `bg-red-50 text-red-700`. Overall progress: fraction text (`text-sm font-mono`), no animated bar.

### 4. Image Detail (modal overlay)

Backdrop: `bg-black/80`. Image centered, max viewport size, original aspect ratio preserved.

Right panel `w-[360px]`, `bg-white`, slides from right (`translate-x → 0` over `duration-200`). Contains:

- Filename, dimensions, file size — `text-xs font-mono text-primary-400`.
- Tags: inline chips, `bg-neutral-100 text-primary-700 text-xs font-mono px-2 py-1 rounded-md`. Editable — × to remove, input to add.
- Dominant colors: row of `w-4 h-4 rounded-full` swatches.
- Description: `text-sm text-primary-600`.
- Quality score: `text-xs font-mono`.

Arrow key navigation through current result set. Escape or backdrop click to close. Panel collapsible to go full-bleed image.

### 5. Gallery Manager (`/galleries`)

Responsive grid of gallery cards, same layout rhythm as Dashboard roll cards. Each card: thumbnail mosaic, gallery name, image count, public/private badge (`bg-tertiary-50 text-tertiary-700` for public, `bg-neutral-100 text-primary-400` for private), source roll name.

Edit view (expanded inline or as a sub-page): drag-and-drop image reorder, name/description editing, layout toggles (masonry on/off, timeline on/off), visibility toggle, copy-public-URL button. Delete with confirmation modal.

### 6. Public Gallery (`/g/[slug]`)

No sidebar, no app chrome. Pure content.

Gallery title: `text-3xl font-semibold`, left-aligned, generous top padding. Optional description: `text-base text-primary-500`. Layout switcher (if both enabled): simple text toggle — "Masonry / Timeline" in `text-xs font-medium`, separated by `/`, active one in `text-primary-950`, inactive in `text-primary-300`.

**Masonry:** 3 cols desktop, 2 tablet, 1 mobile. `gap-1`. Images `rounded-none`, variable height, native aspect ratio.
**Timeline:** single column, `max-w-3xl` centered, images full-width, `gap-6`. Date labels between images if temporal data exists (`text-xs font-mono text-primary-300`).

Lazy loading via Intersection Observer. ImageKit responsive transforms with srcset. Footer: "Hypermood" in `text-xs text-primary-200`, bottom of page. **This is the only responsive screen (375px+).**

### 7. Login (`/login`)

**The dark screen.** Full viewport, `bg-primary-950`.

"Hypermood" in `text-5xl font-bold text-white`, centered. Beneath: email input (`bg-primary-900 border-primary-800 text-white placeholder:text-primary-500`) and "Send magic link" button (`bg-secondary-500 text-white hover:bg-secondary-600`). Max width `max-w-sm`, vertically centered.

Post-submit: swap form for "Check your email" in `text-lg text-primary-300`. Nothing else on the page. No illustrations, no taglines.

---

## Image Delivery (ImageKit)

```
Thumbnail:  ?tr=w-400,h-440,fo-auto,q-80,f-auto
Detail:     ?tr=w-1200,q-90,f-auto
Gallery:    ?tr=w-800,q-85,f-auto  (srcset: 400w, 800w, 1200w)
Tiny:       ?tr=w-80,h-80,fo-auto,q-70,f-auto
```

Store canonical keys in DB (`hypermood/rolls/{id}/{filename}`), resolve URLs at render via `getImageUrl()`.

---

## Accessibility

Keyboard nav on all interactives. `focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2`. Image alt from indexed descriptions. Modal focus traps. `aria-label` on icon-only buttons. WCAG AA contrast.
