# BuildRx by MABRIG Technologies

**BuildRx is a MABRIG Technologies product, developed and maintained by MABRIG Technologies.** Describe the app you want in plain English, watch a team of AI agents plan, build, debug, and deploy it — then edit the generated code in an in-browser IDE, see it render live, push it to GitHub, and ship it to Vercel, Netlify, or Railway.


## MABRIG Technologies

BuildRx is part of the MABRIG Technologies ecosystem.

| Channel | Contact |
| --- | --- |
| Phone | [+234 706 534 2818](tel:+2347065342818) |
| WhatsApp | [+234 706 534 2818](https://wa.me/2347065342818) |
| Email | [Mabrig1@gmail.com](mailto:Mabrig1@gmail.com) |
| MABRIG email | [mabrig@mabrigkorie.org](mailto:mabrig@mabrigkorie.org) |
| Contact email | [contact@mabrigkorie.org](mailto:contact@mabrigkorie.org) |
| Website | [mabrigkorie.org](https://mabrigkorie.org) |
| Store | [store.mabrigkorie.org](https://store.mabrigkorie.org) |
| Facebook | [Mabrig Korie](https://web.facebook.com/apostlemabrigkorie) |
| TikTok | [@mabrigkorie](https://www.tiktok.com/@mabrigkorie) |
| YouTube | [@ApostleEmersonMabrigKorie](https://www.youtube.com/@ApostleEmersonMabrigKorie) |
| GitHub | [mabrig1](https://github.com/mabrig1) |


## Features

- **AI chat workspace** — streaming Claude-powered chat per project, with conversation history, message editing, markdown + code-block rendering
- **Agentic build pipeline** — eleven specialized stages (Planner → FounderOps → Architect → UI → Database → Coding → Debug → Security → QA → Repair → Deployment) generate, verify, repair, and release a complete project with a production evidence pack
- **Virtual project filesystem** — every generated file is stored per project, browsable and editable
- **In-browser IDE** — Monaco editor (bundled, no CDN) with a file explorer, tabs, auto-save, search & replace, and a simulated terminal
- **Live preview environment** — instant-refresh static preview, a Sandpack engine, and a WebContainer runner that boots the generated project's real dev server in the browser; device viewports, error console, fullscreen
- **GitHub integration** — connect an account, create/link repositories, push the whole project as a commit, pull changes back, browse commit history
- **Zip export** — download any project's files as a zip archive, with optional immutable Cloudflare R2 backup
- **One-click deployment** — complete generated Next.js projects deploy to Vercel by digest upload; Netlify and Railway remain available with live logs and history
- **Auth** — Supabase email/password + Google OAuth, secure-cookie JWT sessions, protected routes
- **Subscriptions** — Free (5 projects) and Pro (unlimited) plans, Paystack & Flutterwave checkouts, invoices, server-enforced usage limits
- **MABRIG Tech+ Academy** — premium ₦100,000 BuildRx Full-Stack Launchpad with 8 project-first modules, one-click lab briefs, progress tracking, one-time enrollment checkout, and a production capstone
- **Admin analytics** — users, activity, AI usage, revenue, login history, and CSV report exports, with optional PostHog tracking
- **Demo mode** — the entire product works with zero configuration (in-memory stores, simulated providers) so you can explore before adding any keys

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js 15](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + [Shadcn UI](https://ui.shadcn.com) (Radix primitives) |
| Auth & database | [Supabase](https://supabase.com) (PostgreSQL, RLS, Auth) |
| Agent state | [MongoDB Atlas](https://www.mongodb.com/atlas) (`build_runs` checkpoints only) |
| Artifact storage / edge | [Cloudflare](https://www.cloudflare.com/) R2 + DNS/edge protection |
| AI | OpenRouter primary with NVIDIA fallback; Anthropic Claude is optional and off by default |
| Editor & preview | Monaco · Sandpack · WebContainers |
| State / forms | Zustand · React Hook Form + Zod |
| Payments | Paystack · Flutterwave |
| Analytics | PostHog (optional) + first-party events |
| Charts | Recharts |

## Quickstart

```bash
git clone <your-fork-url> app-creator && cd app-creator
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the app runs fully in **demo mode** with no environment variables (in-memory data, simulated integrations). To connect real services, follow the [installation guide](docs/installation.md) and the [environment variable reference](docs/environment-variables.md).

## Documentation

| Guide | Contents |
| --- | --- |
| [Installation](docs/installation.md) | Prerequisites, Supabase setup, migrations, auth providers, first run, troubleshooting |
| [Environment variables](docs/environment-variables.md) | Every variable, where to get it, what breaks without it |
| [Deployment](docs/deployment.md) | Deploying App-Creator to Vercel, webhooks, domains, post-deploy checklist |
| [API reference](docs/api.md) | Every endpoint: auth, request/response shapes, streaming formats, errors |

## Project structure

```
├── docs/                          # Installation, env, deployment, API docs
├── supabase/
│   ├── migrations/                # 12 ordered migrations (schema + RLS)
│   └── seed.sql                   # Starter templates
├── src/
│   ├── app/
│   │   ├── (auth)/                # login, signup, forgot/reset password + actions
│   │   ├── (dashboard)/           # dashboard, projects, chat, settings, billing, admin, profile
│   │   ├── (workspace)/projects/[projectId]/   # the build workspace (chat + IDE + preview)
│   │   ├── preview/[projectId]/   # full-page preview (+ /container WebContainer runner)
│   │   ├── auth/                  # OAuth callback + email OTP confirm
│   │   └── api/                   # chat, ai, agents, projects/files, github, deploy, billing, admin
│   ├── components/
│   │   ├── ui/                    # Shadcn UI primitives
│   │   ├── layout/ providers/     # app shell, theme
│   │   └── {auth,chat,agents,editor,preview,files,github,deploy,billing,admin,projects,dashboard}/
│   ├── lib/
│   │   ├── agents/                # eleven build stages + orchestrator
│   │   ├── ai/                    # Claude prompts, NVIDIA client, usage metering, route helpers
│   │   ├── analytics/             # PostHog, event tracking, admin aggregates
│   │   ├── billing/               # plans/limits, Paystack & Flutterwave, activation
│   │   ├── deploy/                # Vercel/Netlify/Railway adapters
│   │   ├── files/                 # virtual filesystem manager
│   │   ├── mongodb/               # durable agent/build-run checkpoints
│   │   ├── cloudflare/            # R2 artifact storage
│   │   ├── github/                # GitHub REST + Git Data API client
│   │   ├── supabase/              # browser/server/admin clients + session middleware
│   │   ├── validations/           # Zod schemas
│   │   └── rate-limit.ts constants.ts utils.ts
│   ├── stores/                    # Zustand stores
│   ├── hooks/ types/
│   └── middleware.ts              # session refresh + route protection
└── .env.example
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing page |
| `/login` `/signup` `/forgot-password` `/reset-password` | Authentication |
| `/academy` | Public MABRIG Tech+ Full-Stack Launchpad sales page |
| `/course` | Premium learner dashboard with BuildRx practical labs |
| `/dashboard` | Overview, stats, recent projects |
| `/projects` | Project management (create/search/duplicate/delete) |
| `/projects/[id]` | Build workspace: AI chat, agent builds, IDE, live preview, GitHub, deploy |
| `/preview/[id]` | Full-page live preview (`/container` runs it in a WebContainer) |
| `/chat` | Jumps into your most recent project's chat |
| `/settings` `/profile` `/billing` | Account, profile, subscription & invoices |
| `/admin` | Admin analytics (admin role required) |

## Database

Twelve ordered migrations in `supabase/migrations/` define the schema — apply with `npx supabase db push`. Tables: `users`, `templates`, `projects`, `project_files`, `chat_messages`, `ai_generations`, `deployments`, `subscriptions`, `invoices`, `usage_logs`, `analytics`, `integration_connections`.

Security model:

- **RLS on every table** — owner-scoped CRUD; public projects readable by anyone; admin reads via a `SECURITY DEFINER is_admin()` helper
- **Column-level privileges** — clients can never change their own `role` or `plan` (revoked beneath RLS)
- **Service-role-only writes** for billing, invoices, metering, and generation accounting — usage and payments can't be forged from a browser
- Full details in the migration files, each validated against Postgres 16

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |

## License

Private project — all rights reserved.
