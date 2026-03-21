# Development

## Prerequisites

- Node.js 20+
- pnpm (preferred package manager)

## Initial Setup

```bash
pnpm create next-app@latest semantic-image-app --typescript --tailwind --app --src-dir
cd semantic-image-app
pnpm add @supabase/supabase-js @supabase/ssr @google/generative-ai inngest exifr
pnpm add -D vitest @types/node
```

shadcn/ui init:
```bash
pnpm dlx shadcn-ui@latest init
```

## Running Locally

Three processes needed in parallel:

```bash
# Terminal 1: Next.js dev server
pnpm dev

# Terminal 2: Inngest dev server (required for background jobs)
npx inngest-cli@latest dev

# Terminal 3 (optional): Supabase local (if using local Supabase instead of hosted)
supabase start
```

## Build

```bash
pnpm build
pnpm start
```

## Lint

```bash
pnpm lint
```

## Type Check

```bash
pnpm tsc --noEmit
```

## Generate Supabase Types

After any schema change:
```bash
pnpm dlx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
```
