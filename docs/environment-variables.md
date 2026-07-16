# Environment variables

Copy `.env.example` to `.env.local` and fill in what you need. **Every variable is optional** — with none set, App-Creator runs in demo mode (in-memory data, simulated providers, mock AI). Each variable you add unlocks the corresponding real integration.

> Next.js reads env vars at build/start time. After editing `.env.local`, restart `npm run dev` (or rebuild for production). Variables prefixed `NEXT_PUBLIC_` are embedded in the client bundle — never put secrets in them.

## App

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Recommended in production | Public origin of your deployment (e.g. `https://app.example.com`). Used as a fallback for billing callback URLs when no `Origin` header is available. Default assumption: `http://localhost:3000`. |

## Supabase (auth + persistence)

Get these from **Project Settings → API** in the [Supabase dashboard](https://supabase.com/dashboard).

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | For connected mode | Your project URL, `https://<project-ref>.supabase.co`. Without it (and the anon key), the app runs entirely in demo mode. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For connected mode | The `anon` public key. Safe to expose — Row Level Security governs all access. |
| `SUPABASE_SERVICE_ROLE_KEY` | For billing & metering | The `service_role` key. **Server-only; never expose.** Required for subscription activation, invoices, usage accounting, and cancellation — these tables are deliberately not client-writable, so billing fails gracefully with a 503 if this is missing. |
| `DATABASE_URL` | Tooling only | Direct Postgres connection string (Project Settings → Database). Used by migration/CLI tooling, not by the app at runtime. |

**Without Supabase:** no login/signup; projects, files, chat, and billing live in memory and reset on restart; GitHub/deploy connections are simulated.

## Anthropic (AI chat + agents)

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | For real AI | From the [Anthropic Console](https://console.anthropic.com). Powers the streaming project chat and the six-agent build pipeline. Without it, both return well-formed **mock responses** (still persisted when Supabase is connected), clearly labeled as demo output. |

## NVIDIA Inference API (`/api/ai/generate`, `/api/ai/code`)

Get a key at [build.nvidia.com](https://build.nvidia.com). These endpoints return `503` if `NVIDIA_API_KEY` is unset.

| Variable | Required | Description |
| --- | --- | --- |
| `NVIDIA_API_KEY` | For the NVIDIA endpoints | Bearer token for the NIM OpenAI-compatible API. |
| `NVIDIA_API_BASE_URL` | No | API base URL. Default: `https://integrate.api.nvidia.com/v1`. |
| `NVIDIA_TEXT_MODEL` | No | Model for `/api/ai/generate`. Default: `meta/llama-3.3-70b-instruct`. |
| `NVIDIA_CODE_MODEL` | No | Model for `/api/ai/code`. Default: `qwen/qwen2.5-coder-32b-instruct`. |
| `NVIDIA_RATE_LIMIT_RPM` | No | Per-user requests/minute across the AI endpoints (also applies to `/api/agents/run`). Default: `20`. |

## PostHog (product analytics)

Optional. Without these, first-party analytics still land in the `analytics` table; only PostHog capture is skipped.

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | Project API key (PostHog → Project Settings). Enables client pageview tracking and server-side event capture. |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | Ingestion host. Default: `https://us.i.posthog.com` (use the EU host if your project is in the EU region). |

## Billing — Paystack & Flutterwave

Configure at least one provider to accept real payments; the upgrade dialog offers whichever is configured. Checkout returns `503` for an unconfigured provider. In demo mode (no Supabase) upgrades are simulated without charging.

| Variable | Required | Description |
| --- | --- | --- |
| `PAYSTACK_SECRET_KEY` | For Paystack | Secret key from [Paystack Dashboard](https://dashboard.paystack.com) → Settings → API Keys & Webhooks. Used to initialize/verify transactions and to verify the `x-paystack-signature` webhook HMAC. |
| `PAYSTACK_PLAN_CODE_PRO` | No | A Paystack **Plan** code (e.g. `PLN_...`). When set, checkouts subscribe the customer to that plan so Paystack auto-renews; without it, each charge is one-off. |
| `FLUTTERWAVE_SECRET_KEY` | For Flutterwave | Secret key from [Flutterwave Dashboard](https://app.flutterwave.com) → Settings → API. |
| `FLUTTERWAVE_SECRET_HASH` | For Flutterwave webhooks | The secret hash you set in Flutterwave → Settings → Webhooks. Incoming webhooks are rejected unless their `verif-hash` header matches. |
| `BILLING_CURRENCY` | No | ISO currency code for checkouts (default `USD`). Must be enabled on your provider account — Paystack accounts commonly charge in `NGN`, `GHS`, `ZAR`, or `KES`. |

Webhook URLs to register (see the [deployment guide](deployment.md)):

- Paystack: `https://<your-domain>/api/billing/webhooks/paystack`
- Flutterwave: `https://<your-domain>/api/billing/webhooks/flutterwave`

## Provider tokens entered in the UI (not env vars)

GitHub personal access tokens and Vercel / Netlify / Railway API tokens are **not** environment variables — users connect them per-account inside the app (workspace → GitHub / Deploy panels). They're stored in the `integration_connections` table under RLS, or held in memory in demo mode.

## Quick reference

| Goal | Set |
| --- | --- |
| Just explore | nothing |
| Real accounts + persistence | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Real AI chat + agent builds | `ANTHROPIC_API_KEY` |
| Billing/subscriptions | `SUPABASE_SERVICE_ROLE_KEY` + Paystack and/or Flutterwave keys |
| NVIDIA text/code endpoints | `NVIDIA_API_KEY` |
| Product analytics | `NEXT_PUBLIC_POSTHOG_KEY` |
