# Domain Glossary

| Term | Definition |
|---|---|
| **Roll** | A collection of images owned by a user. Analogous to a photo album or a film roll. One user can have many rolls. Each roll has its own chat. |
| **Image** | A single photo/picture within a roll. Has a status lifecycle: `pending` → `indexed` → optionally `failed`. |
| **Index / Indexing** | The one-time process of analyzing an image with a vision model to extract structured metadata and generate an embedding vector. "The index" refers to the complete set of metadata + embeddings for all images in a roll. |
| **Base Layer** | The universal metadata schema extracted for every image regardless of use case (objects, colors, scene, mood, quality, composition, text, tags, description). This is the only layer built in v1. |
| **Domain Layer** | A specialized metadata extraction pass for a specific use case (e.g., scientific analysis, fashion). Post-MVP. The base layer architecture supports adding domain layers as additional metadata without schema changes. |
| **Embedding** | A numerical vector (array of 3072 floats) representing the semantic meaning of an image or text. Two similar concepts have vectors that are close together in vector space. Used for similarity search. |
| **Centroid** | The average of multiple embedding vectors. Used in image-as-prompt: average the embeddings of selected reference images to create a single query vector. |
| **Storage Key** | The canonical path of an image in storage (e.g., `rolls/abc123/img_001.jpg`). Never a full URL. Resolved to a delivery URL at render time. |
| **Gallery** | A saved set of filtered images from a roll. Has a name, slug, layout preference, and visibility setting. Can be public (shareable via URL). |
| **Public Gallery** | A gallery with `is_public: true`. Accessible without authentication at `/gallery/[slug]`. |
| **Chat** | The persistent natural language conversation interface for a roll. Each roll has exactly one chat. Messages include user queries, system responses, and result sets. |
| **Query Plan** | The structured representation of a user's natural language query, as interpreted by the LLM. Contains filters (tag matches, metadata conditions), optional semantic search intent, and sort preference. |
| **Interpreted Filter** | The human-readable version of the query plan shown to the user (collapsed/toggleable). Lets users understand and verify what the system searched for. |
| **Two-Stage Retrieval** | The query pattern: (1) fast vector search returns top K candidates, (2) LLM reranks those K candidates using full metadata. Keeps LLM context small. |
| **Image-as-Prompt** | Feature where selected images serve as the query. Their stored embeddings are averaged into a centroid, optionally blended with a text query embedding, and used for similarity search. |
| **Vision Call** | An API call to Gemini Flash-Lite that sends image pixels for analysis. Expensive. Only happens during indexing, never at query time. |
| **Transform** | An on-the-fly image manipulation applied via ImageKit URL parameters (resize, quality, format). No file is modified — the CDN serves a transformed version. |
| **Slug** | A URL-safe identifier for a gallery (e.g., `summer-trip-highlights`). Unique per user. Used in public gallery URLs. |
| **OTP** | One-Time Password. The authentication method — user enters email, receives a code/link, logs in without a password. |
| **RLS** | Row Level Security. Postgres feature enforced by Supabase. Every query automatically filters by the authenticated user's ID. Prevents cross-user data access. |
| **Fan-out** | The Inngest pattern where one event (start indexing roll) triggers many parallel child events (index individual images). Used for batch processing. |
| **Re-indexing** | Running the indexing pipeline again on already-indexed images, potentially with a different prompt or model. Post-MVP feature, but architecture supports it. |
