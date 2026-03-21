# Manual Setup (Before Coding)

Complete every step below before writing any application code.

## 1. Supabase Project

- Create a new project at [supabase.com](https://supabase.com)
- Note the project URL and anon key (for client-side)
- Note the service role key (for server-side / Inngest jobs only — never expose to client)
- Enable the `vector` extension:
  - Dashboard → Database → Extensions → Search "vector" → Enable (use `extensions` schema, the default)
  - Or run: `CREATE EXTENSION IF NOT EXISTS vector;`

## 2. Supabase Auth

- Dashboard → Authentication → Sign In / Providers → Enable Email (OTP mode)
- Configure email templates if desired (magic link or 6-digit code)
- Set Site URL to `http://localhost:3000` for local dev
- Add `http://localhost:3000` to Redirect URLs

## 3. Google AI API Key

- Go to [aistudio.google.com](https://aistudio.google.com)
- Sign in with any Google account
- Left sidebar → "Get API Key" → "Create API key" → select your project → copy the key
- The key works for all Gemini models (vision, text, embeddings) — one key covers everything

### Verify model access

Run these curl commands from your terminal (replace `YOUR_KEY` with your actual API key):

```bash
# Test vision model (gemini-3.1-flash-lite-preview)
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello in one word."}]}]}' | head -20

# Test query model (gemini-3-flash-preview)
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello in one word."}]}]}' | head -20

# Test embedding model (gemini-embedding-2-preview)
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"models/gemini-embedding-2-preview","content":{"parts":[{"text":"test embedding"}]}}' | head -20
```

Each should return a JSON response. If you get `"error"` with a model not found message, the model may have been renamed — check [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) for current model strings.

## 4. ImageKit Account

- Create account at [imagekit.io](https://imagekit.io)
- Note: URL endpoint (e.g., `https://ik.imagekit.io/your_id/`)
- Note: Public key, Private key
- Create a folder structure convention: images will be stored under `hypermood/rolls/{rollId}/`

## 5. Inngest

### 5.1 Create account + get keys

- Create account at [inngest.com](https://inngest.com)
- **For local dev, real keys are not required.** The dev server does not validate keys locally. Use dummy values in `.env.local`:

  ```env
  INNGEST_EVENT_KEY=local
  INNGEST_SIGNING_KEY=local
  ```

- **For production only:** go to the Inngest dashboard → **Settings → API Keys**
  - Copy the **Event Key** (starts with `evt_...`)
  - Copy the **Signing Key** (starts with `signkey-...`)

### 5.2 Local dev setup

1. Start your Next.js app in one terminal:

   ```bash
   pnpm dev
   ```

2. Start the Inngest dev server in a second terminal:

   ```bash
   pnpm dlx inngest-cli@latest dev
   ```

3. Open [http://localhost:8288/apps](http://localhost:8288/apps)

### 5.3 Sync your app with Inngest dev server

The dev server needs to know where your Inngest API route lives. Once your app is coded (Task 9), your route will be at `http://localhost:3000/api/inngest`.

On the Apps page at `http://localhost:8288/apps`:

- It will auto-discover your app at `http://localhost:3000/api/inngest` once the route exists
- If not auto-discovered, click **"I want to sync manually"** → enter `http://localhost:3000/api/inngest` → click Sync

Once synced, your registered Inngest functions will appear under **Functions** in the left sidebar.

### 5.4 Verify

- **Apps page:** shows `1 / 1 apps synced`
- **Functions page:** lists your registered functions (e.g. `index-image`, `index-roll`)
- **Runs page:** shows job history after triggering events

> **Note:** The Inngest dev server must be running alongside `pnpm dev` any time you want background jobs to process locally. It does not need to be running just to browse the app.

## 6. Environment Variables

Create `.env.local` with:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Google AI
GOOGLE_AI_API_KEY=AIza...
GEMINI_VISION_MODEL=gemini-3.1-flash-lite-preview
GEMINI_QUERY_MODEL=gemini-3-flash-preview
GEMINI_EMBEDDING_MODEL=gemini-embedding-2-preview

# ImageKit
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id
IMAGEKIT_PUBLIC_KEY=public_...
IMAGEKIT_PRIVATE_KEY=private_...

# Inngest
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

## 7. Database Schema (Run as Migration)

After Supabase project is created and vector extension is enabled, run the initial schema migration. The SQL will be generated in Task 2 of `tasks.md`. Run it via:

- Supabase Dashboard → SQL Editor, OR
- Supabase CLI: `supabase db push`

Tables to create (details in Task 2):

- `rolls`
- `images`
- `image_metadata`
- `image_embeddings`
- `chat_messages`
- `galleries`
- `gallery_images`

All tables include `user_id` FK + RLS policies.

## 8. Verify Checklist

Before writing code, confirm:

- [√] Supabase project is live and accessible
- [√] pgvector extension is enabled
- [√] Auth is configured for OTP email login
- [√] Google AI API key works (tested all three models with curl — see step 3)
- [√] ImageKit account is active, keys noted
- [√] Inngest account created, keys noted
- [√] `.env.local` is populated with all values
- [√] `.env.local` is in `.gitignore`
