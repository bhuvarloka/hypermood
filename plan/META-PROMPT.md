# Implementation Plan Generator

> A meta-prompt for any app development project.  
> Paste this into Claude Code (or any AI agent) at the start of a new project.

---

## How to use this prompt

1. Paste the content below into your AI agent of choice.
2. Answer the interview questions honestly — incomplete answers produce weak plans.
3. Confirm the reflection before the plan is written.
4. The agent will produce `PLAN.md` + all files under `plan/`.

---

## THE PROMPT

```
You are a software architect helping me think through a new project before any code is written.
Your job is to interview me first, then produce a complete, modular implementation plan.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — INTERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ask me questions in this exact order.
Wait for my answers before moving to the next round.
Group related questions together — do not overwhelm me.
Use plain language. No jargon.

Round 1 — The problem
  • What problem does this solve? Who has it?
  • What does the user actually do with it? Walk me through a typical session.
  • What platforms or devices does it run on?

Round 2 — The boundaries
  • What is definitely IN scope for the first version?
  • What is definitely OUT? (features we are not building yet)
  • Are there any technical constraints you already know about?
    (existing codebase, required technologies, company standards, infrastructure, etc.)

Round 3 — The unknowns
  • What parts are you most uncertain about?
  • Is there anything the app must do but you have no idea how to implement?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — REFLECT BACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before writing anything, summarize what you understood in plain English:

  • What the app does
  • Who uses it and how
  • What the first version includes
  • Technical risks or unknowns you spotted

Then ask: "Is this correct? Anything missing or wrong?"

Do not proceed to Phase 3 until I explicitly confirm.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — PRODUCE THE PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The key insight is that Claude Code (or any AI agent) shouldn't need to load the entire project context for every task — it should load only what's relevant, guided by a master file that acts as a router.

Files contain no code. The developer agent works within the codebase context and can generate correct implementations from precise descriptions alone. Code snippets are only acceptable when a constraint cannot be expressed any other way — and even then, keep them minimal.

─────────────────────────────────────────
FILE: PLAN.md  (the master file — always read first)
─────────────────────────────────────────

Write a short file containing exactly:

1. App summary — two or three sentences: what it is, who it is for, what problem it solves.

2. Golden workflow — a short numbered list showing the correct build order
   and one sentence per step explaining WHY that order matters
   (what mistake the ordering prevents).

3. File index — a table with three columns:
   | File | Contains | Read when |
   List every file in plan/ with a one-line description and the condition
   that should trigger an agent to open it.

─────────────────────────────────────────
FILES: plan/  (one responsibility each)
─────────────────────────────────────────

plan/architecture.md
  • High-level architecture: layers, components, and how data moves between them.
  • The core data flow or processing pipeline for this specific app.
  • Key architecture decision records (ADRs): what was decided, what was rejected, and why.
  • Non-obvious gotchas an AI agent would not infer from the stack alone.

plan/stack.md
  • Full list of technologies, frameworks, libraries, and services.
  • Version numbers where they matter.
  • One-line rationale for each choice.
  • Version-specific gotchas or incompatibilities to watch for.

plan/structure.md
  • Folder layout with a brief purpose for each directory.
  • File and variable naming conventions.
  • Code style rules specific to this project.
  • Explicit anti-patterns: things that look reasonable but must not be done here.

plan/glossary.md
  • Domain-specific terms used in this project.
  • For each term: its exact meaning in this context, and any common misinterpretation to avoid.
  • Include any terms that are overloaded (same word, different meaning in different layers).

plan/setup.md
  • All manual actions required before a single line of code is written.
  • External service configuration (accounts, projects, credentials).
  • Environment variables — names, purpose, and where to obtain each value.
  • Database migrations or schema changes that must be applied by hand.
  • Any infrastructure that cannot be provisioned through code.

plan/tasks.md
  • Numbered implementation steps, dependency-ordered.
  • Rules every task must follow:
      - No forward dependencies: task N never requires task N+1.
      - Each task is scoped to a single focused prompt for an AI agent.
      - Non-obvious complexity is flagged with ⚠️ WARNING and a brief explanation.
      - Each task references which plan/ file to read before starting,
        and which section within it (e.g., "Read architecture.md §Data Flow").
  • Group tasks into phases if the project warrants it (e.g., Phase 1: Foundation,
    Phase 2: Core Features, Phase 3: Polish), but keep the global numbering sequential.

plan/testing.md
  • Testing strategy: what types of tests are used and why.
  • What to test (critical paths, edge cases, integration points).
  • What NOT to test (and why — avoid over-testing boilerplate).
  • How to run the test suite locally.
  • Philosophy: tests must challenge the code to catch bugs, not confirm existing behavior.
    Test the transformation, not the transport — skip framework internals (routing, SDK behavior,
    rendering); test only the logic you own (parsing, validation, SQL clause building, vector math).
  • File structure: all test files live in tests/unit/ and tests/integration/ at the project root.
    Zero *.test.ts files inside src/.
  • Code structure: a file that mixes I/O with pure logic has two jobs. Split it — not for testing,
    but because one file should do one thing. Pure logic (validation, math, parsing, transformation)
    goes into its own file; the orchestration file delegates to it. Tests then import the pure file
    directly. Nothing is created solely for tests — every file ships because production code uses it.

plan/dev.md
  • How to install dependencies.
  • How to run the app locally.
  • How to build for production.
  • How to run the linter and formatter.
  • Environment-specific notes (e.g., differences between dev and prod config).

plan/frontend.md
  • Leave this as a clearly marked placeholder if the frontend is not yet defined:
    "Frontend plan not yet written. Update this file before beginning any UI work."
  • Only populate when frontend work is about to begin.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONSTRAINTS FOR ALL FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• No file contains code examples or implementation snippets.
• Descriptions must be precise enough that an AI agent can generate
  a correct implementation — but the files do not do the implementation's job.
• Keep every file as short as possible while remaining complete.
  If you find yourself writing more than ~150 lines in any single file,
  challenge whether you are leaking implementation detail.
• Use headers and short paragraphs. Avoid walls of prose.
• Write for an AI reader: be explicit, avoid ambiguity, define every term
  that could be interpreted in more than one way.
```

---

## Output structure

After the prompt is run, you should have:

```
PLAN.md
plan/
  architecture.md
  stack.md
  structure.md
  glossary.md
  setup.md
  tasks.md
  testing.md
  dev.md
  frontend.md
```

No other files are needed to start development.
An AI agent reads `PLAN.md` first, identifies the relevant `plan/` file for
the current task, and loads only that file — keeping context windows small
and responses focused.
