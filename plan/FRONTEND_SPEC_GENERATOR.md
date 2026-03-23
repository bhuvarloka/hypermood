# Frontend Spec Generator

> A companion prompt to the Implementation Plan Generator.  
> Run this when you are ready to define the UI — before any frontend code is written.  
> The tech stack is already defined in `plan/stack.md`. This prompt does not re-litigate it.

---

## How to use this prompt

1. Have `PLAN.md` and `plan/stack.md` already written. The agent will reference them.
2. Paste the prompt below into your AI agent.
3. Answer the interview honestly — vague answers produce vague specs.
4. Confirm the reflection before the spec is written.
5. The agent will produce `plan/frontend.md`, replacing the placeholder.

---

## THE PROMPT

```
You are a UI/UX-aware software architect helping me define the frontend of an app
before any interface code is written.

Read `PLAN.md` and `plan/stack.md` before asking me anything.
You already know what the app does and what tech is being used.
Do not ask me to repeat that context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — INTERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ask me questions in this exact order.
Wait for my answers before moving to the next round.
Use plain language. No design or engineering jargon unless I introduce it first.

Round 1 — Feel and references
  • If this app had a personality, how would you describe it in three adjectives?
  • Show me something — an app, a website, a film, a physical object, anything —
    whose look or feel you want to borrow from. What specifically do you like about it?
  • Is there anything whose aesthetic you actively want to avoid? Why?

Round 2 — Visual language
  • Do you have any existing brand assets? (logo, colors, fonts, a design system, etc.)
    If yes, describe them. If no, do you have strong preferences or is this open?
  • How dense should the UI be? (e.g. lots of content visible at once vs. spacious and minimal)
  • Is this primarily a light-mode app, dark-mode, or both?
  • Any strong feelings about typography — serious/editorial, friendly/rounded,
    technical/monospace, or no preference?

Round 3 — Layout and screens
  • Walk me through the app screen by screen. What does the user see first?
    Where do they go next? What is the most important screen?
  • Are there screens that need to exist but are low-priority for the first version?
  • Does the layout change significantly between mobile and desktop,
    or is one platform the clear primary target?

Round 4 — Components and interactions
  • What are the most complex or non-obvious UI pieces in this app?
    (e.g. a custom player, a drag-and-drop canvas, an infinite scroll feed)
  • Are there any interactions that must feel a specific way?
    (e.g. "the transition must be instant", "this gesture needs to feel physical")
  • What should the empty states look like? (first-time user, no results, error states)

Round 5 — State and data
  • What does the UI own locally vs. what does it always fetch fresh?
  • Are there any pieces of state that multiple screens share?
    (e.g. a selected item, a filter, a logged-in user)
  • What is the slowest or most unreliable data dependency?
    How should the UI behave while waiting for it?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — REFLECT BACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before writing the spec, summarize what you understood:

  • The visual personality and reference points
  • The screen inventory and priority order
  • The non-obvious components or interactions
  • Any UX risks or contradictions you spotted
    (e.g. "you want minimal but also very dense — let's resolve that")

Then ask: "Is this correct? Anything missing or wrong?"

Do not proceed to Phase 3 until I explicitly confirm.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — PRODUCE plan/frontend.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write plan/frontend.md using the structure below.
No code. No markup samples. No CSS snippets.
Every section answers "what to build and why" — not "here is the implementation."
Be explicit enough that an agent reading this file can make correct decisions
without asking follow-up questions.

─────────────────────────────────────────
§ Visual Identity
─────────────────────────────────────────
  • Personality: three adjectives + one sentence elaborating each.
  • References: each reference listed with what specifically to borrow
    (layout rhythm, color temperature, interaction speed, typography weight, etc.)
    and what NOT to borrow from the same source.
  • Anti-references: aesthetics to actively avoid, with a brief reason.
  • Color direction: palette intent (not hex values unless the user provided them).
    Describe in terms of mood and contrast role — primary, surface, accent, destructive.
  • Typography direction: one or two typeface roles (heading, body), the feeling
    they should convey, and any explicit exclusions.
  • Density and spacing: describe the intended breathing room using plain language
    (e.g. "generous whitespace, content never touches the viewport edge",
    or "information-dense, table-like, every pixel used").
  • Light/dark: which modes are supported and which is the design default.

─────────────────────────────────────────
§ Screen Inventory
─────────────────────────────────────────
  For each screen, a short entry containing:
  • Name and one-line purpose.
  • Primary user action on this screen.
  • Key layout decision (e.g. "full-bleed media", "sidebar + main", "single centered column").
  • Responsive behavior: does the layout change significantly at smaller viewports?
  • Priority: V1 (must ship) or Later (placeholder, do not build yet).

─────────────────────────────────────────
§ UX Flows
─────────────────────────────────────────
  • List the critical paths through the app — the sequences a user follows
    to complete the core actions.
  • For each flow: entry point → steps → exit point.
  • Flag any step where the user could get stuck or confused,
    and describe the intended resolution (tooltip, empty state, redirect, etc.).
  • Note any flows that share state across screens.

─────────────────────────────────────────
§ Component Inventory
─────────────────────────────────────────
  List every distinct UI component the app needs.
  Group into three tiers:

  Primitives — generic, reusable across the whole app
    (e.g. Button, Input, Badge, Avatar, Modal, Toast)

  Composed — built from primitives, specific to a feature
    (e.g. MediaCard, FilterBar, UploadDropzone, UserMenu)

  Screens — top-level page components (one per screen in the inventory above)

  For each non-obvious component, add:
  • What makes it complex or custom.
  • The interaction contract: what triggers it, what it emits, what it does on error.
  • Any known edge cases (empty, loading, error, overflow).

─────────────────────────────────────────
§ State Architecture
─────────────────────────────────────────
  • Global state: what lives at the app level and why
    (e.g. authenticated user, theme, active filters shared across screens).
  • Local state: what each screen or component owns privately.
  • Server state: what is always fetched fresh and never cached locally.
  • Loading and error strategy: describe the intended pattern for async operations
    (e.g. "optimistic updates for mutations", "skeleton loaders for initial fetch",
    "full-page error boundary only for auth failures").
  • Slowest dependency: name it, describe the fallback UI while waiting.

─────────────────────────────────────────
§ Interaction Principles
─────────────────────────────────────────
  • List any interactions with a specific required feel
    (e.g. "navigation transitions must be under 150ms and feel instant",
    "drag operations need tactile resistance on drop").
  • Animation stance: none / subtle / expressive — and where the line is.
  • Feedback contract: how the UI acknowledges user actions
    (e.g. "every destructive action requires confirmation",
    "every async action shows a loading indicator within 300ms").

─────────────────────────────────────────
§ Empty & Edge States
─────────────────────────────────────────
  For each significant screen or component, describe:
  • First-time / empty state (no data yet).
  • Loading state.
  • Error state (what broke, what the user can do).
  • Overflow state (too much content — truncation, pagination, or scroll strategy).
```

---

## Output

Running this prompt produces or replaces `plan/frontend.md`.
The placeholder originally written by the Implementation Plan Generator is now fully populated.
`PLAN.md` does not need to change — `plan/frontend.md` was already in the index.
