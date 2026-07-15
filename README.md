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

## Deployment

Deploy to [Vercel](https://vercel.com): import the repository, set the environment variables from `.env.example`, and deploy. `vercel.json` configures the framework and security headers.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
