# Hypermood Design & Tech Dossier

## 1. What Exactly is Hypermood?
Hypermood is a **Semantic Image Intelligence Web App**—effectively a private, AI-powered operating system for personal image collections. 
* **Core Philosophy:** *Index once, query forever.* 
* **How it Works:** Users upload batches of images ("rolls"). The system analyzes and indexes every image in the background (extracting structured metadata and vector embeddings). From that point on, users interact with their images entirely through a conversational chat interface that filters, searches, and curates using natural language.
* **Key Differentiator:** Vision models are *not* called at query time. The chat simply queries the already-extracted metadata and vector embeddings, making it lightning-fast and cost-effective.

## 2. Tech Stack Snapshot
* **Framework:** Next.js 16 (App Router, Server Actions)
* **Database & Auth:** Supabase (Postgres, Auth via OTP, RLS, pgvector for semantic search, Realtime for progress)
* **AI & Intelligence:** 
  * `gemini-3.1-flash-lite-preview` for background vision indexing
  * `gemini-3-flash-preview` for text query interpretation
  * `gemini-embedding-2-preview` for multimodal vector embeddings (maps images and text to the same vector space)
* **Storage:** ImageKit (storage, CDN, on-the-fly transforms)
* **Background Jobs:** Inngest v4 (handles the indexing pipeline and fan-out)
* **Styling:** Tailwind CSS v4 (hand-built components, **no** pre-built component libraries like shadcn/ui)
* **Language:** TypeScript (strict)

## 3. Design Philosophy & Aesthetic
* **Vibe:** Swiss-minimalism. A pristine, highly-considered canvas matching the exactness of an editorial photo gallery. It is emphatically *not* a standard 2020s SaaS dashboard.
* **Colors:** Warm zinc grayscale instead of pure, harsh grays. 
  * Defaults: Warm black text (`primary-900` / `#18181A`) on pure white or warm off-white canvases (`primary-50` / `#FAFAFA`).
  * Semantic Colors (Success, Error, Active) are strictly punctual and rarely used for backgrounds.
* **Typography:**
  * **Sans:** `"Dyatype Sans"` (Precision layout, confident scale, large body text. Never smaller than `text-lg`).
  * **Mono:** `"Neue Montreal Mono"` (Used strictly for technical readouts: timestamps, tags, counts, scores).
* **Shapes & Surfaces:** Fast, sharp edges (`rounded-none`) default for images. Punctual, intentional softness (`rounded-2xl`) selectively applied to conversational Chat UI elements. Zero drop-shadows. Depth is built strictly through background color shifts.
* **Motion (`.animate-bloom`, `.animate-swiss`):** Animations are magical but exact. Elements fade and scale in instantly (150ms-200ms ease-out) with zero bouncy/rubber-band physics.  

## 4. Key UX Patterns
* **Contextual Suggestions:** The chat never feels cold. It generates smart "starter chips" analyzing the roll's metadata, and offers "follow-up chips" (e.g. *Narrow down to close-ups*) after every query result.
* **Stream of Thought:** A monospace progress indicator dynamically types out what the system is doing behind the scenes (e.g., `Interpreting query...` -> `Searching 1,000 images...` -> `Found 47 matches`) rather than using boring spinners.
* **Actionable Interpreted Filters:** Natural language search parses into visible, editable filter "chips" (e.g. `scene: outdoor`). Users can cleanly click ‘X’ to remove a condition or ‘+’ to add one without re-typing their whole prompt.
* **Ghost Dimming (Three-Tier Opacity):** When results are returned, non-matching images don't vanish or shuffle—they dim to 15% opacity (`opacity-15`). Selected images gain a defined focus ring. Reflowing layouts is avoided to maintain spatial memory.
* **Image-as-Prompt:** Clicking an image adds it to a "selection strip" in the chat input. Users can bundle selected images with a text prompt ("find more with this vibe") to drive a multimodal vector search.

## 5. Every Screen & How They Relate
The app strictly minimizes views to preserve flow and focus.

### 1. The Login Void (`/login`)
* **What it is:** The threshold to enter the app. A dark void (`primary-950`).
* **Design:** Completely black viewport. Massive centered "Hypermood" text. A silent, label-free email input. Step 2 is a 6-digit OTP code layout (auto-formatting, paste-aware) that automatically submits upon completion. 

### 2. The App Shell (The Rail)
* **What it is:** Global navigation (left sidebar). Not a typical menu, but a portal to "Rolls."
* **Design:** Sits flush with the canvas without borders. Hovering over a "Roll" yields a micro-preview (a 2x2 grid glimpse) before clicking. 

### 3. The Roll Command Center (`/rolls/[rollId]`)
* **The structural heart of the app.** It contains two dynamically reacting halves:
  * **Top layer (The Chat Engine):** A single input box driven by NLP. Handles all prompts, filters, suggestions, and processing feedback.
  * **Bottom layer (The Image Grid):** A fluid, masonry grid displaying images edge-to-edge. 
* **Relation:** The chat talks *to* the grid. Send a prompt on top -> images highlight or dim on the bottom without destroying the layout.

### 4. Ambient Upload (Drag & Drop)
* **What it is:** Uploads are frictionless. There is no dedicated "upload page."
* **Design:** Users drop files globally over the Command Center's grid or chat. Background upload/indexing progresses passively with a mono-font readout while the user continues chatting with previously uploaded images.

### 5. The Preview Panel
* **What it is:** A sliding panel from the bottom (covers 60% of the screen) dimming the main grid behind it.
* **Purpose:** A narrative check. When a user has a subset of filtered/curated images, this dense miniature grid lets them judge if the set tells a good story. Includes the "Save as Gallery" submit action and fields.

### 6. Image Detail / "The Darkroom"
* **What it is:** A full-screen immersive overlay for a single image.
* **Design:** Pure black or pure white isolation. Max viewport utilization. UI is 100% hidden unless hovered at the edges. Technical specs (dimensions, metrics) hide at the bottom, accessible on-hover. 

### 7. Public Gallery (`/g/[slug]`)
* **What it is:** The curated output that external viewers see. Pure uninterrupted content, no chat.
* **Design:** Minimal top bar with logo, gallery name, and layout toggles. 
* **Layouts Types:** Standard Masonry or responsive timeline tracks (horizontal scrolling with images centered along the x-axis, gracefully snapping to vertical scrolling on mobile). Flawless transitions between modes.

### 8. Settings/Manager
* **What it is:** Configuration UI.
* **Design:** A full-height stark drawer sliding from the right relying purely on architectural grid alignments rather than boxed cards or modular panels.
