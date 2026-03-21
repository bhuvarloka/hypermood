# Project Structure & Conventions

## Folder Layout

```
semantic-image-app/
├── PLAN.md
├── plan/                          # Implementation docs (not shipped)
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Landing / redirect to dashboard
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (app)/                 # Authenticated routes
│   │   │   ├── layout.tsx         # App shell with nav
│   │   │   ├── rolls/
│   │   │   │   ├── page.tsx       # Roll list
│   │   │   │   └── [rollId]/
│   │   │   │       ├── page.tsx   # Roll view (chat + image grid)
│   │   │   │       └── upload/page.tsx
│   │   │   └── galleries/
│   │   │       ├── page.tsx       # Gallery list
│   │   │       └── [galleryId]/page.tsx
│   │   ├── gallery/               # Public gallery routes (no auth)
│   │   │   └── [slug]/page.tsx
│   │   └── api/
│   │       └── inngest/route.ts   # Inngest webhook handler
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser client
│   │   │   ├── server.ts          # Server client (cookies-based)
│   │   │   ├── admin.ts           # Service role client (for Inngest jobs)
│   │   │   └── types.ts           # Generated DB types
│   │   ├── imagekit/
│   │   │   ├── upload.ts          # Server-side upload
│   │   │   └── url.ts             # URL resolver + transforms
│   │   ├── gemini/
│   │   │   ├── vision.ts          # Indexing prompt + structured output parsing
│   │   │   ├── embedding.ts       # Image + text embedding calls
│   │   │   └── query.ts           # NL→filter translation
│   │   └── inngest/
│   │       ├── client.ts          # Inngest client instance
│   │       └── functions/
│   │           ├── index-image.ts  # Single image indexing function
│   │           └── index-roll.ts   # Fan-out: triggers index-image per image
│   ├── actions/                   # Server Actions
│   │   ├── rolls.ts
│   │   ├── images.ts
│   │   ├── chat.ts
│   │   └── galleries.ts
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components (generated)
│   │   ├── chat/
│   │   ├── gallery/
│   │   ├── roll/
│   │   └── upload/
│   └── types/
│       └── domain.ts              # Shared domain types (Roll, Image, Gallery, etc.)
├── supabase/
│   └── migrations/                # SQL migration files
├── public/
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Naming Conventions

| What | Convention | Example |
|---|---|---|
| Files (components) | kebab-case | `image-grid.tsx` |
| Files (lib/utils) | kebab-case | `url.ts`, `vision.ts` |
| React components | PascalCase | `ImageGrid`, `ChatInput` |
| Functions/variables | camelCase | `getImageUrl`, `rollId` |
| Server Actions | camelCase, verb-first | `createRoll`, `sendMessage` |
| DB tables | snake_case, plural | `images`, `chat_messages` |
| DB columns | snake_case | `storage_key`, `user_id` |
| Inngest events | domain/verb.noun | `indexing/start.roll`, `indexing/process.image` |
| Inngest functions | kebab-case | `index-single-image` |
| Types | PascalCase | `Roll`, `ImageMetadata` |
| Env vars | SCREAMING_SNAKE | `NEXT_PUBLIC_SUPABASE_URL` |

## Code Style Rules

- Strict TypeScript. No `any` unless a comment explains why.
- Prefer `type` over `interface` unless extending is needed.
- Server Actions are the default for mutations. API routes only for webhooks (Inngest).
- Use `@/` path alias for imports from `src/`.
- One export per file for components. Named exports for utilities.
- Colocate types with their module. Shared types go in `types/domain.ts`.
- No barrel files (`index.ts` re-exports). Import directly from the file.

## Anti-Patterns for THIS Project

| Don't | Why | Do instead |
|---|---|---|
| Store full ImageKit URLs in DB | Couples storage to CDN provider | Store `storage_key`, resolve URL at render time |
| Call Gemini vision at query time | Violates core architecture (cost + latency) | Query only metadata + embeddings |
| Send all image metadata to LLM for query interpretation | Context overflow at scale | Two-stage retrieval: vector search first, then LLM reranks top K |
| Use `localStorage` for chat history | Breaks multi-device, not persistent | Store chat in Supabase `chat_messages` table |
| Create separate CSS/JS files for components | Project uses Tailwind + single-file components | Keep styles in Tailwind classes, logic in the component file |
| Use Next.js API routes for data mutations | Server Actions are simpler and type-safe | Use Server Actions; API routes only for Inngest webhook |
| Mix embedding vectors from different models | Vectors from different models are incomparable | Always check `embedding_model_version` matches |
| Upload images client-side to ImageKit | Exposes private key | Upload server-side via Server Action or API route |
| Use Supabase service role key in client code | Full DB access, bypasses RLS | Service role only in server-side code (Inngest jobs, Server Actions) |
| Build UI before the API layer is testable | Constant rework as API changes | Follow Golden Workflow order |
| Put business logic in components | Untestable, coupled to React | Logic in `lib/` and `actions/`, components only render |
