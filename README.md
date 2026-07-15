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

The initial schema (`supabase/migrations/0001_initial_schema.sql`) defines:

- **profiles** — user profiles, auto-created on signup via trigger
- **projects** — user-owned app projects
- **chat_messages** — per-project AI conversation history
- **deployments** — deployment records per project
- **subscriptions** — billing state (Stripe)

All tables have row-level security enabled with owner-scoped policies.

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
