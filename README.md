# App-Creator

An AI app builder, similar to Lovable — describe the app you want in plain English and watch it come to life with live preview and one-click deployment.

> **Status:** project architecture and configuration only. Feature implementation comes next.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js 15](https://nextjs.org) (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + [Shadcn UI](https://ui.shadcn.com) (Radix primitives) |
| Auth & Database | [Supabase](https://supabase.com) (PostgreSQL, RLS, Auth) |
| State management | Zustand |
| Forms & validation | React Hook Form + Zod |
| Notifications | Sonner |
| Deployment | Vercel |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# fill in your Supabase / Anthropic / Stripe keys

# 3. Apply the database schema (Supabase CLI)
npx supabase db push

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app runs without env vars configured (auth middleware no-ops until Supabase keys are present), so you can explore the UI immediately.

## Project structure

```
├── supabase/
│   ├── migrations/            # SQL migrations (schema + RLS policies)
│   └── seed.sql               # Local development seed data
├── src/
│   ├── app/
│   │   ├── (auth)/            # login, signup, forgot-password
│   │   ├── (dashboard)/       # dashboard, projects, chat, settings, billing, admin
│   │   ├── preview/[projectId]/  # full-screen live preview
│   │   ├── auth/callback/     # Supabase OAuth callback
│   │   └── api/               # chat, projects, stripe webhook endpoints
│   ├── components/
│   │   ├── ui/                # Shadcn UI primitives
│   │   ├── layout/            # sidebar, header, user nav, theme toggle
│   │   ├── providers/         # theme provider
│   │   └── {auth,chat,projects,preview,billing,admin}/  # feature components
│   ├── lib/
│   │   ├── supabase/          # browser / server / admin clients + middleware
│   │   ├── validations/       # Zod schemas
│   │   ├── ai/                # AI generation logic (upcoming)
│   │   ├── constants.ts       # site config, navigation, plans
│   │   └── utils.ts
│   ├── stores/                # Zustand stores (projects, chat, preview, ui)
│   ├── hooks/                 # shared React hooks
│   ├── types/                 # domain + database types
│   └── middleware.ts          # session refresh + route protection
├── components.json            # Shadcn UI configuration
├── vercel.json                # Vercel deployment configuration
└── .env.example               # required environment variables
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing page |
| `/login`, `/signup`, `/forgot-password` | Authentication |
| `/dashboard` | Overview of projects and activity |
| `/projects` | Project management |
| `/projects/[projectId]` | AI chat + preview workspace |
| `/chat` | Standalone AI chat interface |
| `/preview/[projectId]` | Full-screen live preview |
| `/settings` | Account settings |
| `/billing` | Plans and usage |
| `/admin` | Platform administration (admins only) |

## Database

The schema lives in `supabase/migrations/` as ordered, domain-scoped migrations. Apply with `npx supabase db push` (or `npx supabase db reset` locally, which also runs `seed.sql`).

| Table | Purpose |
| --- | --- |
| `users` | Application users, mirroring `auth.users` 1:1 (auto-created on signup via trigger) |
| `templates` | Curated starter templates; the prompt seeds the first AI generation |
| `projects` | User-owned app projects, optionally created from a template |
| `project_files` | Virtual filesystem of generated source files (unique per `project_id + path`) |
| `chat_messages` | Per-project AI conversation history |
| `ai_generations` | One row per LLM call: model, token usage, timing, outcome |
| `deployments` | Deployment attempts per project with status transitions |
| `subscriptions` | One row per user, synced with Stripe by the webhook handler |
| `usage_logs` | Append-only metering of billable actions (plan limits) |
| `analytics` | Append-only product analytics events |

Design notes:

- **RLS everywhere.** Every table has row-level security enabled. Owners get scoped CRUD on their projects and related rows; `is_public` projects (and their files) are readable by anyone; admins get read access via a `SECURITY DEFINER` `is_admin()` helper that avoids recursive policy evaluation.
- **Column-level privileges.** Regular users can update only `name`, `avatar_url`, and `onboarded` on their own `users` row — `role` and `plan` are revoked from the `authenticated` role, so privilege escalation is blocked at the grant level, beneath RLS.
- **Service-role writes.** `ai_generations`, `usage_logs`, `subscriptions`, and deployment status updates have no client write policies; only the server (service-role key) can write them, so metering and billing can't be forged from a browser.
- **Cascades.** Deleting an auth user cascades through users → projects → files/messages/generations/deployments; nullable references (`triggered_by`, `created_by`, analytics attribution) use `on delete set null` to preserve history.
- **Indexes** cover every foreign key plus the hot query paths: `(owner_id, updated_at desc)` for project lists, `(project_id, created_at)` for chat history, `(user_id, created_at desc)` for usage metering, `(event_type, created_at desc)` for analytics, and partial indexes for public projects and in-flight deployments.

TypeScript mirrors of the schema live in `src/types/database.ts` (regenerate with `npx supabase gen types typescript` once connected to a project).

## Authentication

Auth is built on Supabase Auth (`@supabase/ssr`). Sessions are JWTs stored in secure cookies, refreshed on every request by `src/middleware.ts`, which also redirects unauthenticated users off protected routes (`/dashboard`, `/projects`, `/chat`, `/settings`, `/billing`, `/admin`, `/profile`) and signed-in users away from the auth pages.

Supported flows:

- **Email + password** — signup (with optional email confirmation), login, password reset via email link
- **Google OAuth** — enable the Google provider in Supabase (Authentication → Providers) with your OAuth client ID/secret

Supabase dashboard configuration:

1. **Authentication → URL Configuration** — set the Site URL to your deployment URL and add `https://<your-domain>/auth/callback` to the redirect allow list (plus `http://localhost:3000/auth/callback` for local dev).
2. **Authentication → Providers → Google** — add your Google OAuth credentials; the authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Optional: point email templates at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...` — both the code (`/auth/callback`) and token-hash (`/auth/confirm`) flows are supported.

## AI providers

Two providers are integrated, each behind its own env vars:

- **Anthropic Claude** (`ANTHROPIC_API_KEY`) powers the app-builder chat at `/api/chat` (streaming, conversation persistence).
- **NVIDIA Inference API** (`NVIDIA_API_KEY`, key from [build.nvidia.com](https://build.nvidia.com)) powers two general-purpose endpoints:
  - `POST /api/ai/generate` — text generation. Body: `{ prompt, system?, projectId?, model?, maxTokens?, temperature?, stream? }`
  - `POST /api/ai/code` — code generation on a code-specialized model. Body: `{ prompt, language?, context?, projectId?, stream? }`

Both NVIDIA endpoints stream text by default (`stream: false` returns JSON with token usage), require an authenticated session, and are rate limited per user (`NVIDIA_RATE_LIMIT_RPM`, default 20/min) with standard `X-RateLimit-*`/`Retry-After` headers. Every call is metered into `usage_logs` (and `ai_generations` when a `projectId` is supplied). Models default to `meta/llama-3.3-70b-instruct` (text) and `qwen/qwen2.5-coder-32b-instruct` (code), overridable via `NVIDIA_TEXT_MODEL` / `NVIDIA_CODE_MODEL`. Upstream 429/5xx responses are retried with backoff; failures surface as clean JSON errors.

## Multi-agent build system

`POST /api/agents/run` executes an automated build pipeline in which six specialized agents collaborate through a shared workflow context, streaming NDJSON progress events consumed by the "Build app" panel in the workspace:

| # | Agent | Role |
| --- | --- | --- |
| 1 | **Planner** | Turns the user's description into a structured plan (pages, components, data model, features) |
| 2 | **UI** | Generates Next.js pages/components plus a self-contained static preview (`preview/index.html`) |
| 3 | **Database** | Produces `supabase/schema.sql` (with RLS) and matching TypeScript types from the plan's data model |
| 4 | **Coding** | Wires the app together — data helpers, layout, remaining logic — without regenerating existing files |
| 5 | **Debug** | Static checks plus an LLM review pass; corrected files replace the originals |
| 6 | **Deployment** | Persists files to `project_files`, records a `deployments` row, publishes the preview, marks the project `ready`, and posts a build summary into the project chat |

Each agent reads and extends the shared context (the plan and the generated-file map), so later agents build on earlier output. The generated preview is served at `/api/preview/[projectId]` (sandboxed with a strict CSP) and renders live in the workspace preview panel.

Generated files live in a virtual filesystem (`src/lib/files/manager.ts`, backed by `project_files` with an in-memory demo fallback) exposed via `/api/projects/[projectId]/files`. The workspace's **Code** tab is a full in-browser IDE: Monaco editor (bundled locally, no CDN) with syntax highlighting, a file explorer, multiple tabs with dirty indicators, debounced auto-save, search & replace, and a simulated terminal (`ls`, `cat`, `rm`, `npm run build`, …) operating on the same virtual filesystem. LLM agents run on Claude (`claude-opus-4-8`); without an `ANTHROPIC_API_KEY` the pipeline runs deterministic mock agents so the workflow is fully demoable. Deployment is currently simulated (files + preview publishing) — swapping in a real Vercel deploy only touches the Deployment Agent.

## Deployment

Deploy to [Vercel](https://vercel.com): import the repository, set the environment variables from `.env.example`, and deploy. `vercel.json` configures the framework and security headers.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
