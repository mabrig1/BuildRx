# API reference

All endpoints live under `/api` and speak JSON unless noted otherwise. Errors use a consistent shape:

```json
{ "error": "Human-readable message" }
```

**Authentication** is cookie-based (Supabase session set by the login flow) — there are no API keys or bearer tokens for these endpoints; call them from the app's origin with credentials included. In **demo mode** (Supabase not configured) endpoints skip auth and operate on in-memory data; responses from simulated providers include `"simulated": true`.

**Common status codes**

| Code | Meaning |
| --- | --- |
| 400 | Validation failed (Zod) — the message names the first problem |
| 401 | Not signed in |
| 402 | Plan limit reached (monthly AI request quota) — upgrade or wait for the new month |
| 403 | Signed in but not allowed (admin-only endpoints) |
| 404 | Project/file not found, or not yours (RLS makes others' resources invisible) |
| 429 | Rate limit exceeded (see below) |
| 502 | Upstream provider (NVIDIA, GitHub, deploy host) returned a server error |
| 503 | The relevant provider isn't configured (missing env var) |

**Rate limiting** — the AI endpoints (`/api/ai/*`, `/api/agents/run`, `/api/agents/{agentId}/chat`) share a per-user (per-IP in demo mode) limit of `NVIDIA_RATE_LIMIT_RPM` requests/minute (default 20). Responses carry:

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 17
X-RateLimit-Reset: <unix seconds>
Retry-After: <seconds>        ← on 429 only
```

---

## AI

### `POST /api/chat`

Streaming project chat (Claude). Persists the user message, streams the assistant reply as **plain text chunks** (`Content-Type: text/plain`), then persists the reply and records usage.

```json
{ "projectId": "uuid-or-demo-id", "content": "Add a pricing page" }
```

- No `ANTHROPIC_API_KEY` but `NVIDIA_API_KEY` set: streams from the NVIDIA text model instead (`X-Model` header names it).
- Neither key: streams a labeled mock response.
- Errors: 400 invalid body · 401 · 402 quota · 404 unknown project.

### `POST /api/ai/generate`

Text generation via the NVIDIA Inference API.

```json
{
  "prompt": "Explain OAuth in one paragraph",
  "system": "optional system prompt",
  "projectId": "optional — attributes usage",
  "model": "optional model override",
  "maxTokens": 1024,
  "temperature": 0.7,
  "topP": 0.95,
  "seed": 42,
  "stream": true
}
```

- `stream: true` (default): plain-text delta stream; the resolved model is echoed in an `X-Model` header.
- `stream: false`: `{ "text": "...", "model": "...", "usage": { "promptTokens": n, "completionTokens": n, "totalTokens": n } }`
- Errors: 503 if `NVIDIA_API_KEY` unset · 429 · 402 · 502 upstream failure.

### `POST /api/ai/code`

Code generation using the code-specialized NVIDIA model (`NVIDIA_CODE_MODEL`), low temperature, fenced-code-block output.

```json
{
  "prompt": "A debounce utility",
  "language": "typescript",
  "context": "optional existing code the model should respect",
  "projectId": "optional",
  "stream": true
}
```

Same streaming/response/error behavior as `/api/ai/generate`.

### `GET /api/ai/models`

Lists the NVIDIA models available to the two endpoints above, plus the configured defaults:

```json
{
  "configured": true,
  "textModel": "z-ai/glm-5.2",
  "codeModel": "poolside/laguna-xs-2.1",
  "models": [
    { "id": "z-ai/glm-5.2", "label": "GLM 5.2", "kind": "text", "description": "…" },
    { "id": "stepfun-ai/step-3.7-flash", "label": "Step 3.7 Flash", "kind": "text", "description": "…" },
    { "id": "poolside/laguna-xs-2.1", "label": "Laguna XS 2.1", "kind": "code", "description": "…" }
  ]
}
```

### `GET /api/ai/config`

Configuration check without an API call: `{ "hasKey": true, "baseUrl": "https://integrate.api.nvidia.com/v1", "textModel": "…", "codeModel": "…" }`. The key itself is never returned.

### `GET /api/ai/test`

NVIDIA connectivity check — sends a one-word completion to the configured endpoint. Auth-free by design (it verifies configuration, not user data).

- Success: `{ "connected": true, "message": "Connected to NVIDIA successfully", "model": "…", "reply": "…" }`
- Failure: `{ "connected": false, "error": "…" }` with 503 (no key) or the upstream status.

### `POST /api/ai/vision`

Image understanding via a vision-language NIM — describes a screenshot/mockup (image-to-code). Body: `{ imageDataUrl, prompt?, projectId? }` → `{ text, model, usage }`.

### `POST /api/ai/parse`

Structured text/data extraction from an image (spec doc, form screenshot) via Nemotron Parse. Same shape as `/api/ai/vision`.

### `POST /api/ai/image`

Text-to-image generation (hero art, icons, placeholders). Body: `{ prompt, negativePrompt?, aspectRatio?, seed?, projectId? }` → `{ imageDataUrl, model }` (a `data:image/png;base64,…` URL).

### `POST /api/ai/transcribe`

Speech-to-text for voice input. `multipart/form-data` with a `file` field (+ optional `language`, `projectId`) → `{ text, model }`. 503 until `NVIDIA_ASR_API_URL` is set (see `.env.example`).

### `POST /api/ai/moderate`

Classifies text as safe/unsafe via the Nemotron Safety Guard model. Body: `{ text }` → `{ safe, categories, model }`. `/api/chat` calls this automatically before every prompt reaches a model.

### `POST /api/ai/plan`

Turns a feature request into a structured multi-file build plan via the long-context planning model, before any code is generated. Body: `{ prompt, context?, projectId? }` → `{ plan: { summary, files: [{ path, description }] }, model }`.

## AI Platform (multi-provider)

Additive to the endpoints above — `/api/chat`, `/api/ai/generate`, and `/api/ai/code` are unchanged and still exist. These new endpoints let a caller target **any** configured provider by id instead of always going through NVIDIA/Anthropic.

Provider ids: `nvidia | openai | anthropic | gemini | deepseek | grok`.

### `GET /api/ai/providers`

Every provider BuildRx knows about, its configuration status, default model, and model catalog (with pricing where known):

```json
{
  "providers": [
    {
      "id": "openai",
      "label": "OpenAI",
      "configured": true,
      "defaultModel": "gpt-4o-mini",
      "models": [
        { "id": "gpt-4o", "label": "GPT-4o", "contextWindow": 128000, "pricing": { "inputPer1M": 2.5, "outputPer1M": 10 } }
      ]
    }
  ]
}
```

### `GET /api/ai/settings` / `PUT /api/ai/settings`

The signed-in user's default provider/model (AI Settings page). `GET` returns `{ "defaultProvider": "nvidia", "defaultModel": "…" }` (falls back to the NVIDIA default when nothing's been saved, or when Supabase isn't configured). `PUT` body: `{ "defaultProvider": "openai", "defaultModel": "gpt-4o-mini" }` → `{ "success": true }`. 503 if Supabase isn't configured (nowhere to persist it).

### `POST /api/ai/complete`

A single completion from any configured provider, one request/response shape regardless of which:

```json
{
  "provider": "anthropic",
  "prompt": "Explain OAuth in one paragraph",
  "system": "optional system prompt",
  "model": "optional override — defaults to the provider's default model",
  "maxTokens": 2048,
  "temperature": 0.6,
  "topP": 0.95,
  "stream": true,
  "projectId": "optional — attributes usage"
}
```

Same streaming/non-streaming behavior as `/api/ai/generate` (`X-Model` and `X-Provider` headers on the stream; `{ text, model, provider, usage }` when `stream:false`). 503 if the requested provider isn't configured · 502 on an upstream provider error.

### `POST /api/ai/compare`

"Model comparison mode" — runs one prompt against 2-6 provider/model pairs **in parallel** (always non-streaming, so every result can be laid out side by side at once) and returns each with its text, token usage, estimated cost, and latency. One provider failing doesn't fail the others — it comes back with an `error` field instead. Saved to `model_comparisons` when signed in.

```json
{
  "prompt": "Write a haiku about databases",
  "system": "optional",
  "targets": [
    { "provider": "openai", "model": "gpt-4o-mini" },
    { "provider": "anthropic", "model": "claude-haiku-4-5-20251001" }
  ]
}
```

```json
{
  "results": [
    {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "text": "…",
      "promptTokens": 12,
      "completionTokens": 24,
      "costUsd": 0.000016,
      "durationMs": 812
    },
    {
      "provider": "anthropic",
      "model": "claude-haiku-4-5-20251001",
      "durationMs": 0,
      "error": "Anthropic isn't configured on this deployment."
    }
  ]
}
```

`costUsd` is `null` when a model's pricing isn't in the catalog (e.g. NVIDIA's free tier) — token counts and text are still returned.

---

### `POST /api/agents/run`

Runs the six-agent build pipeline (Planner → UI → Database → Coding → Debug → Deployment) for a project. Streams progress as **NDJSON** (`application/x-ndjson`) — one JSON event per line:

```json
{ "projectId": "uuid-or-demo-id", "prompt": "Build a church website" }
```

Event stream:

```jsonl
{"type":"workflow_start","agents":["planner","ui","database","coding","debug","deployment"]}
{"type":"agent_start","agent":"planner","message":"Analyzing requirements…"}
{"type":"agent_log","agent":"planner","message":"Planned 5 pages, 3 tables"}
{"type":"file","agent":"ui","path":"src/app/page.tsx"}
{"type":"agent_complete","agent":"ui","message":"Generated 8 files"}
{"type":"workflow_complete","previewUrl":"/api/preview/<id>","fileCount":17}
```

An `{"type":"error","agent":?,"message":"..."}` event may appear at any point; the stream always ends after `workflow_complete` or `error`. Generated files are saved to the project filesystem.

Model selection: Anthropic Claude when `ANTHROPIC_API_KEY` is set; otherwise the NVIDIA models — the reasoning agents (Planner, Debug) use `NVIDIA_TEXT_MODEL` and the code-producing agents (UI, Database, Coding) use `NVIDIA_CODE_MODEL`. With neither key, prompt-aware mock agents run the same pipeline. Errors before the stream starts: 400 · 401 · 402 · 404 · 429.

---

## AI Agents

> **Naming note:** this is unrelated to the six-step build pipeline above (`/api/agents/run`) — these are user-created, reusable AI assistants ("custom GPTs") with their own system prompt, provider/model, tools, knowledge, and memory, not tied to a project. Every endpoint below **requires Supabase to be configured** (503 otherwise) — there's no demo-mode equivalent for owner-scoped agents.

### `GET /api/agents` / `POST /api/agents`

List your own agents, or create one:

```json
{
  "name": "Support Bot",
  "description": "optional",
  "icon": "🎧",
  "systemPrompt": "You are a friendly support agent…",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "tools": ["remember_fact"],
  "visibility": "private"
}
```

`visibility` ∈ `private | unlisted | public`. `tools` ∈ `get_current_time | calculator | remember_fact` (built-in, no external API keys required — see Tool calling below).

### `GET /api/agents/marketplace`

Public agents anyone signed in can browse, newest first (capped at 50).

### `GET /api/agents/{agentId}` / `PATCH` / `DELETE`

Fetch one agent (RLS: owner, or any non-`private` agent), update it, or delete it. `PATCH`/`DELETE` are owner-only (403 otherwise). Moving `visibility` off `private` for the first time mints a `share_slug`, resolved by `GET /agents/share/{slug}` (browser route, not JSON) to the canonical `/agents/{agentId}` URL.

### `POST /api/agents/{agentId}/clone`

"Use this agent" — copies the config (name, prompt, provider/model, tools) into a new private agent you own. Knowledge files and memory are not copied.

### Knowledge files

Plain-text context the agent includes in every conversation (capped at 6,000 characters total, most recent first) — not full retrieval/RAG (a later phase), just static injection. Readable by anyone who can access the agent; writable by the owner only.

| Endpoint | Description |
| --- | --- |
| `GET /api/agents/{agentId}/knowledge` | List files (name, size, created_at — not content) |
| `POST /api/agents/{agentId}/knowledge` `{ name, content }` | Add one (max 50,000 characters, 5 files per agent) |
| `DELETE /api/agents/{agentId}/knowledge/{fileId}` | Remove one |

### Conversations (memory threads)

| Endpoint | Description |
| --- | --- |
| `GET /api/agents/{agentId}/conversations` | Your own conversation threads with this agent |
| `POST /api/agents/{agentId}/conversations` `{ title? }` | Start a new one |
| `GET /api/agents/{agentId}/conversations/{conversationId}` | That conversation's messages, oldest first |
| `DELETE /api/agents/{agentId}/conversations/{conversationId}` | Delete it |

### `POST /api/agents/{agentId}/chat`

Runs one turn of a conversation. Body: `{ message, conversationId? }` (omit `conversationId` to start a new one). **Non-streaming** — see "Tool calling" below for why — the full answer (plus any tool trace) comes back in one response:

```json
{
  "conversationId": "uuid",
  "text": "2 + 2 is 4.",
  "steps": [
    { "type": "tool_call", "id": "call_1", "name": "calculator", "arguments": { "expression": "2+2" }, "result": "4" }
  ],
  "model": "gpt-4o-mini"
}
```

Persists the user message, every tool call/result, and the final answer, so the next turn sees the full exchange. Also injects the agent's knowledge files and any saved memories (see `remember_fact` below) into the system prompt automatically. Shares the same rate limit as the rest of `/api/ai/*`, plus the monthly AI request quota (402 when exceeded).

**Tool calling**: `get_current_time`, `calculator`, and `remember_fact` (saves a fact to the agent's memory for this user, recalled in future conversations) — all built-in, zero external config. Only honored on providers with `supportsTools: true` (OpenAI, Anthropic, DeepSeek, Grok as of this phase — not NVIDIA or Gemini yet). Resolution is a server-side loop (call model → run any requested tools → call model again with the results), capped at 4 iterations; deliberately non-streaming, since reliably parsing partial tool-call JSON out of a token stream is a substantially harder problem than this needed, and a visible tool-call trace is arguably more useful than a live-typed answer anyway.

---

## Document AI

> **Scoping note:** there's no blob storage configured on this deployment — upload extracts text/tables synchronously and only that extracted content is persisted; the original file bytes are discarded. Every endpoint requires Supabase (503 otherwise), same as AI Agents.

Supported types: **PDF** (embedded text only — a scanned PDF with no text layer returns a `warning` instead of fabricated text; OCR-ing scanned PDFs isn't implemented yet), **DOCX**, **XLSX** (tables extracted exactly, one per sheet), and **images** (real OCR, via the NVIDIA vision pipeline — requires `NVIDIA_API_KEY`).

### `GET /api/documents` / `POST /api/documents`

List your documents (metadata only), or upload one — `multipart/form-data` with a `file` field (max 10MB):

```json
{
  "document": {
    "id": "uuid",
    "name": "budget.xlsx",
    "file_type": "xlsx",
    "status": "ready",
    "extracted_text": "…",
    "tables": [{ "name": "Sheet1", "rows": [["Item","Cost"],["Widgets","100"]] }],
    "summary": "…auto-generated if a provider is configured and there's enough text…",
    "warning": null,
    "error": null
  }
}
```

`status` ∈ `ready | failed` (extraction is synchronous, so a document never sits in `processing` in the response you get back). A summary auto-generates on upload when a provider is configured and the extracted text is non-trivial — best-effort, failure doesn't fail the upload.

### `GET /api/documents/{documentId}` / `DELETE`

Fetch the full document (including `extracted_text`, `tables`, cached `summary`/`tables_markdown`/`report_markdown`) or delete it. Owner-only (RLS).

### `POST /api/documents/{documentId}/summarize`

(Re)generates and caches the summary. Body (optional): `{ "provider"?, "model"? }` — defaults to the document's provider/model (whichever was configured at upload time). → `{ "summary": "…" }`.

### `POST /api/documents/{documentId}/extract-tables`

AI-inferred table detection over the extracted text, formatted as markdown and cached. For XLSX, real tables are already in the `tables` field from upload — this is for PDF/DOCX/image documents, where "is this a table" is a judgment call the model makes from the extracted text (best-effort, not pixel-level layout detection). → `{ "tablesMarkdown": "…" }`.

### `POST /api/documents/{documentId}/report`

Generates and caches a structured markdown report (executive summary, key findings, reformatted tables) grounded in the document. → `{ "report": "…" }`.

### `POST /api/documents/{documentId}/ask`

Single-shot Q&A over one document's extracted text — stateless, no persisted conversation, no retrieval ranking (the whole document is the context). For semantic search and cited chat across a whole collection of documents, see the RAG / Knowledge Base section below. Body: `{ "question", "provider"?, "model"? }` → `{ "answer": "…" }`. Shares the same per-user rate limit as the rest of `/api/ai/*`.

---

## AI Coding

Generic code operations — not tied to a project's file system (`code` in, result out). The workspace code editor wires these to the currently open file, but any snippet works. All five take `{ code, language?, provider, model?, projectId? }` plus an action-specific field, and work in demo mode like `/api/ai/generate`.

### `POST /api/ai/code/explain`

→ `{ "explanation": "…", "model": "…" }`.

### `POST /api/ai/code/debug`

Body adds `errorMessage?` (paste the error/symptom for a better fix). → `{ "explanation", "code": string | null, "model" }`. `code` is `null` when the model's response couldn't be parsed into a code block (e.g. it just said "this looks correct") — show the explanation, there's nothing to apply.

### `POST /api/ai/code/refactor`

Body adds `instruction` (required — what to change, free text). → `{ "explanation", "code", "model" }`, same shape as `debug`.

### `POST /api/ai/code/docs`

Adds documentation comments (JSDoc/docstrings) without changing behavior. → `{ "explanation", "code", "model" }`.

### `POST /api/ai/code/tests`

Body adds `filePath?` (used to suggest a conventional `*.test.ts` sibling path). → `{ "testCode", "suggestedFileName"?, "model" }`.

---

## Content Studio

Six AI writers (`blog_post`, `ebook`, `social_post`, `email`, `ad_copy`, `video_script`) sharing one generation engine. Requires sign-in (owner-scoped, RLS-backed) — no demo mode. Ebooks are generated as a chapter outline followed by one model call per chapter (up to 8), so `POST /api/content` with `type: "ebook"` can take a minute or two; the route sets `maxDuration = 180`.

### `GET /api/content`

List the caller's content pieces, newest first. Optional `?type=blog_post` (or any `ContentType`) filters.

### `POST /api/content`

```json
{
  "type": "blog_post",
  "inputs": { "topic": "…", "tone": "…", "targetAudience": "…", "keywords": "…", "wordCount": "medium" },
  "provider": "nvidia",
  "model": "optional override"
}
```

`inputs` fields vary by `type` — see `ContentInputs` in `src/lib/content/prompts.ts` (`topic`, `tone`, `targetAudience`, `keywords`, `wordCount`, `platform`, `includeHashtags`, `purpose`, `callToAction`, `product`, `chapterCount`, `videoLength`). Generates the piece, saves it, and records AI usage (including on failure — the row is saved with `status: "failed"` and an `error` message). → `{ "content": ContentPiece }`. Errors: 400 invalid body · 401 · 503 provider not configured.

### `GET /api/content/{contentId}`

Fetch one piece (owner only, 404 otherwise).

### `PATCH /api/content/{contentId}`

Body: `{ "title"?, "content"? }` — manual edits after generation. 400 if neither field is present.

### `DELETE /api/content/{contentId}`

Delete a piece.

### `POST /api/content/{contentId}/regenerate`

Body: `{ "inputs"?, "provider"?, "model"? }`, all optional — omitted fields reuse the piece's existing values. Re-runs generation and updates the row in place. `maxDuration = 180`.

### `POST /api/content/{contentId}/cover-image`

Generates a cover image via the NVIDIA image model (`generateImage`, 16:9) and saves it as a data URL on the piece. Body: `{ "prompt"? }` — defaults to a generic cover prompt built from the piece's title. 503 if NVIDIA isn't configured.

### Prompt library

`GET /api/prompt-library` (optional `?category=`), `POST /api/prompt-library` (`{ "title", "category", "promptText" }`, `category` is a `ContentType` or `"general"`), `PATCH /api/prompt-library/{promptId}`, `DELETE /api/prompt-library/{promptId}` — all owner-scoped saved prompts, independent of any generated content piece.

---

## RAG (Knowledge Base)

Upload documents into a knowledge base, then chat with them — answers are grounded in the retrieved chunks with inline `[n]` citations, not the model's general knowledge. Requires sign-in (owner-scoped, RLS-backed); requires `NVIDIA_API_KEY` for embeddings regardless of which provider answers the chat (embedding is NVIDIA-only, chat can use any configured provider).

Pipeline: upload → extract text (reuses the Document AI extractors — PDF/DOCX/XLSX/image) → split into ~1000-character overlapping chunks → embed each chunk (`nvidia/nv-embedqa-e5-v5`, 1024 dimensions) → store in a `pgvector` column with an HNSW cosine-similarity index. All synchronous at upload time (no background job), so a large document's upload can take a while — `maxDuration = 120` on the upload route.

### `GET /api/rag/knowledge-bases` / `POST /api/rag/knowledge-bases`

List your knowledge bases, or create one: `{ "name", "description"? }` → `{ "knowledgeBase": {...} }`.

### `GET /api/rag/knowledge-bases/{kbId}` / `PATCH` / `DELETE`

Fetch one (includes `documentCount`), rename/re-describe it (`{ "name"?, "description"? }`), or delete it — deleting cascades to its documents and chunks.

### `GET /api/rag/knowledge-bases/{kbId}/documents` / `POST`

List documents in the KB, or upload one — `multipart/form-data` with a `file` field (max 10MB, same supported types as Document AI). → `{ "document": { "id", "name", "file_type", "status", "chunk_count", "warning", "error", ... } }`. `status` is `ready` once chunked and embedded, or `failed` with an `error` message (extraction failure, no extractable text, or an embedding-API error) — a failed upload still returns 201 with the failed-status row rather than an HTTP error, so the UI can show why.

### `GET /api/rag/knowledge-bases/{kbId}/documents/{documentId}` / `DELETE`

Fetch or delete one document (deleting removes its chunks).

### `POST /api/rag/knowledge-bases/{kbId}/chat`

Body: `{ "message", "provider", "model"? }`. Embeds the message, retrieves the most similar chunks (cosine similarity ≥ 0.3, top 6) via the `match_knowledge_chunks` Postgres function, and — only if at least one relevant chunk was found — asks the model to answer using just that context. → `{ "answer", "citations": [{ "documentId", "documentName" }], "model" }`. When nothing relevant is found, returns a fixed "couldn't find anything relevant" answer with no model call (`model: null`) rather than letting the model guess from outside knowledge. Chat history isn't persisted server-side — each call is a fresh single-turn question grounded in the KB.

---

## Projects

### `GET /api/projects`

Lists the signed-in user's projects → `{ "projects": [{ "id", "name", "description", "status", "previewUrl", "updatedAt" }, …] }`. Demo mode lists the in-memory demo projects.

### `POST /api/projects`

Creates a project (enforces the plan's project limit — 402 when reached):

```json
{ "name": "My App", "description": "optional" }
```

Returns `201 { "project": { "id", "name", "status" } }` (`{ "id", "simulated": true }` in demo mode). The dashboard UI uses a server action for the same operation.

## Project files

### `GET /api/files` (alias)

Flat-path alias for the per-project files API below, addressed by query/body `projectId`: `GET /api/files?projectId=&path=`, `PUT /api/files { projectId, path, content }`, `DELETE /api/files?projectId=&path=`. Same responses and rules as the canonical routes.

### `GET /api/projects/{projectId}/files`

Without query params: `{ "files": [{ "path", "language", "size", "updatedAt" }, …], "tree": <nested file tree> }` (metadata only — no contents).
With `?path=src/app/page.tsx`: `{ "file": { "path", "content", "language" } }` or 404.

### `PUT /api/projects/{projectId}/files`

Create or overwrite one file (max 500 kB):

```json
{ "path": "src/app/page.tsx", "content": "export default ..." }
```

Returns `{ "success": true }`. Paths are validated — no traversal (`..`), no absolute paths (400 otherwise).

### `DELETE /api/projects/{projectId}/files?path=...`

Deletes the file. Returns `{ "success": true }`.

### `GET /api/projects/{projectId}/export`

Downloads the project's entire virtual filesystem as a zip archive (`Content-Disposition: attachment; filename="<project-slug>.zip"`). 404 if the project has no files yet.

### `GET /api/preview/{projectId}`

Serves the generated static preview (`preview/index.html` from the project filesystem) as sandboxed HTML — a strict `Content-Security-Policy` isolates generated content, and an injected script forwards runtime errors to the workspace's error console via `postMessage`. Returns a placeholder page for demo projects with no build, 404 HTML otherwise.

---

## GitHub

Tokens are entered in the workspace UI and stored per-user in `integration_connections` (simulated in demo mode).

| Endpoint | Description |
| --- | --- |
| `GET /api/github/connection?projectId=` | `{ connected, username, repo, simulated }` |
| `POST /api/github/connection` `{ token }` | Connect with a personal access token (needs `repo` scope); validates against the GitHub API |
| `DELETE /api/github/connection` | Disconnect |
| `POST /api/github/repos` `{ projectId, name, isPrivate?, description? }` | Create a repository and link it → `{ repo: "owner/name", url }` |
| `PUT /api/github/repos` `{ projectId, fullName: "owner/name" }` | Link an **existing** repository (any repo the token can access) to the project → `{ repo: "owner/name" }` |
| `GET /api/github/repos/list` | The connected account's own repos, most recently pushed first → `{ repos: [{ fullName, htmlUrl, defaultBranch, private }, …] }`. Powers the import picker — pair with `PUT` + `POST /pull` below, or let the UI do both in one "Import" click. |
| `POST /api/github/push` `{ projectId, message? }` | Push all project files as one commit (Git Data API: blobs → tree → commit → ref) → `{ commitSha, commitUrl, fileCount }` |
| `POST /api/github/pull` `{ projectId }` | Pull the repo's files into the project filesystem → `{ fileCount }` |
| `GET /api/github/commits?projectId=` | `{ commits: [{ sha, message, author, date, url }, …] }` |

Errors: 400 not connected / no linked repo / no files yet · 401 · 502 GitHub API failure.

---

## Deployment

| Endpoint | Description |
| --- | --- |
| `GET /api/deploy` | API index: supported providers, your connection status, and the operation endpoints |
| `GET /api/deploy/connection` | `{ connections: { vercel, netlify, railway } }` (booleans) |
| `POST /api/deploy/connection` `{ provider, token }` | Connect a provider token (validated against the provider's API) |
| `DELETE /api/deploy/connection?provider=` | Disconnect |
| `POST /api/deploy/run` `{ projectId, provider }` | One-click deploy — **NDJSON stream** of `{"type":"status","status":"building"}` and `{"type":"log","line":"…"}` events ending in `{"type":"complete","status":"live"\|"failed","url":…}`; the deployment (with logs) is recorded in history. 400 if there's no build to deploy yet. |
| `GET /api/deploy/history?projectId=` | `{ deployments: [{ id, provider, status, url, domain, logs, createdAt, completedAt }, …] }` |
| `POST /api/deploy/domain` `{ projectId, provider, domain }` | Attach a custom domain (Vercel/Netlify API; Railway domains are managed in its dashboard) → includes DNS instructions |

`provider` ∈ `vercel | netlify | railway`. Errors: 400 not connected / invalid domain · 401 · 404 · 502 provider failure.

---

## Billing

| Endpoint | Description |
| --- | --- |
| `POST /api/billing/checkout` `{ plan: "pro", provider: "paystack"\|"flutterwave" }` | Start a hosted checkout → `{ url }` to redirect the user to. Demo mode activates Pro instantly (`{ simulated: true, url: "/billing?upgraded=1" }`). 503 if the provider isn't configured. |
| `GET /api/billing/verify?provider=…` | Checkout callback (the provider redirects here — not called directly). Verifies the transaction server-side (Paystack `?reference=`, Flutterwave `?transaction_id=`), activates the subscription + records the invoice, then redirects to `/billing?upgraded=1` or `/billing?payment_failed=1`. |
| `POST /api/billing/webhooks/paystack` | Paystack webhook. Verified via `x-paystack-signature` (HMAC-SHA512 of the raw body). Idempotent activation on `charge.success`. |
| `POST /api/billing/webhooks/flutterwave` | Flutterwave webhook. Verified via the `verif-hash` header against `FLUTTERWAVE_SECRET_HASH`. |
| `POST /api/billing/cancel` | Cancel at period end → `{ canceled: true }`. 503 without `SUPABASE_SERVICE_ROLE_KEY`. |

All subscription/invoice writes go through the service-role client — clients cannot forge plan changes.

---

## Admin

### `GET /api/admin/reports?type=users|usage|revenue`

CSV export (`text/csv`, download disposition) of signups by day, AI requests by day, or MRR by plan. Requires the `admin` role (403 otherwise); open in demo mode with deterministic sample data.

---

## Auth routes (browser flows, not JSON APIs)

| Route | Purpose |
| --- | --- |
| `GET /auth/callback?code=…&next=…` | OAuth (Google) + PKCE code exchange; sets the session cookies and redirects to a **same-origin** `next` path |
| `GET /auth/confirm?token_hash=…&type=…&next=…` | Email OTP confirmation (signup verification, password recovery token-hash flow) |

Everything else auth-related (signup, login, password reset, profile updates) is implemented as Next.js **server actions** on the corresponding pages rather than REST endpoints, as is project CRUD (create/duplicate/delete) on the dashboard.
