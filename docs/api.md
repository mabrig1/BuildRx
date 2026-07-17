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

**Rate limiting** — the AI endpoints (`/api/ai/*`, `/api/agents/run`) share a per-user (per-IP in demo mode) limit of `NVIDIA_RATE_LIMIT_RPM` requests/minute (default 20). Responses carry:

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

## Project files

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
| `POST /api/github/push` `{ projectId, message? }` | Push all project files as one commit (Git Data API: blobs → tree → commit → ref) → `{ commitSha, commitUrl, fileCount }` |
| `POST /api/github/pull` `{ projectId }` | Pull the repo's files into the project filesystem → `{ fileCount }` |
| `GET /api/github/commits?projectId=` | `{ commits: [{ sha, message, author, date, url }, …] }` |

Errors: 400 not connected / no linked repo / no files yet · 401 · 502 GitHub API failure.

---

## Deployment

| Endpoint | Description |
| --- | --- |
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
