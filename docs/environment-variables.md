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
| `NEXT_PUBLIC_SUPABASE_URL` | For connected mode | Your project URL, `https://<project-ref>.supabase.co`. Without it (and a public key), the app runs entirely in demo mode. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | For connected mode (preferred) | The modern `sb_publishable_...` key (Project Settings → API Keys). Safe to expose — Row Level Security governs all access. Takes precedence over the anon key. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy fallback | The legacy JWT `anon` key. Used only when no publishable key is set. |
| `SUPABASE_SERVICE_ROLE_KEY` | For billing & metering | The `service_role` key. **Server-only; never expose.** Required for subscription activation, invoices, usage accounting, and cancellation — these tables are deliberately not client-writable, so billing fails gracefully with a 503 if this is missing. |
| `DATABASE_URL` | Tooling only | Direct Postgres connection string (Project Settings → Database). Used by migration/CLI tooling, not by the app at runtime. |

**Without Supabase:** no login/signup; projects, files, chat, and billing live in memory and reset on restart; GitHub/deploy connections are simulated.

**Google Sign-In** requires no extra env vars — the Google OAuth client is configured in the Supabase dashboard. See the [Google OAuth setup guide](google-oauth.md) for the required provider, redirect-URL, and callback-URL configuration.

## MongoDB Atlas (durable agent state)

MongoDB has one bounded responsibility: document-shaped checkpoints for agent/build runs. Supabase remains the source of truth for identity, project ownership, relational records, RLS, and generated files.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | For durable checkpoints | Server-only Atlas connection string. Grant read/write only to the BuildRx database. |
| `MONGODB_DATABASE` | No | Database name. Default: `buildrx`; the app writes the `build_runs` collection. |

Without MongoDB, builds still execute, but workflow checkpoints are not durable across function failure or restart.

## Cloudflare (edge + R2 artifacts)

Cloudflare owns DNS/edge protection and private ZIP artifact backups. Vercel remains the application runtime.

| Variable | Required | Description |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | For Cloudflare/R2 | Cloudflare account identifier. |
| `CLOUDFLARE_API_TOKEN` | For edge administration | Least-privilege server-only API token. |
| `CLOUDFLARE_R2_BUCKET` | For artifact backups | Private R2 bucket name. |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | For artifact backups | R2 S3 API access key ID. |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | For artifact backups | R2 S3 API secret; server-only. |

Project ZIP downloads still work without R2; the response header `X-BuildRx-Artifact` reports whether the immutable backup was stored.

## AI providers (chat + agent build pipeline)

`/api/chat` and `/api/agents/run` go through a shared provider chain
(`src/lib/ai/provider.ts`): **OpenRouter first, NVIDIA fallback**, with
Anthropic available only when explicitly enabled. Either OpenRouter or
NVIDIA is enough for real generation. With neither, the pipeline uses
well-formed deterministic fallbacks and labels the build as degraded.

| Variable | Required | Description |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Recommended for real AI | Primary provider key. Model routing is resolved against its live catalog. |
| `OPENROUTER_BASE_URL` | No | Default: `https://openrouter.ai/api/v1`. |
| `OPENROUTER_MODEL_STRONG` | No | Fixed override for planning, FounderOps, and application code. |
| `OPENROUTER_MODEL` | No | Fixed override for chat and lighter review tasks. |
| `NVIDIA_API_KEY` | **Yes, for real AI** | Bearer token for the NIM OpenAI-compatible API. Get a free one at [build.nvidia.com](https://build.nvidia.com). |
| `NVIDIA_BASE_URL` | No | API base URL (alias: `NVIDIA_API_BASE_URL`). Default: `https://integrate.api.nvidia.com/v1`. |
| `NVIDIA_GLM_MODEL` | No | Primary provider-chain model. Default: `z-ai/glm-5.2`. |
| `NVIDIA_CHAT_MODEL` | No | Second chain tier, and the model chat starts on. Default: `stepfun-ai/step-3.7-flash`. |
| `NVIDIA_LLAMA_MODEL` | No | Last chain tier — a lightweight model, tried only if the two above fail. Default: `meta/llama-3.2-1b-instruct`. |
| `NVIDIA_RATE_LIMIT_RPM` | No | Per-user requests/minute across the AI endpoints (also applies to `/api/agents/run`). Default: `20`. |
| `NVIDIA_MODEL_DEEPSEEK_PRO` | No | Deep reasoning / architecture / primary coding model for the agent pipeline (Planner, Architect, Coding). Falls back to `NVIDIA_GLM_MODEL` / `NVIDIA_CODE_MODEL`. |
| `NVIDIA_MODEL_DEEPSEEK_FLASH` | No | Fast diagnostics model (Debugging Agent). Falls back to `NVIDIA_CHAT_MODEL`. |
| `NVIDIA_MODEL_MISTRAL_LARGE` | No | Code generation/review model (UI, Database, Repair). Falls back to `NVIDIA_CODE_MODEL`. |
| `NVIDIA_MODEL_MISTRAL_MEDIUM` | No | Lightweight-task model (Security Agent judgment calls). Falls back to `NVIDIA_CHAT_MODEL`. |
| `NVIDIA_MODEL_KIMI` | No | General-purpose model used as the fallback tier for every agent call. Falls back to `NVIDIA_CHAT_MODEL`. |
| `AGENT_PIPELINE_BUDGET_MS` | No | Total time the eleven-stage build pipeline may use, split across the steps by weight. Default: `270000` (270s, leaving 30s for persistence and verification). |

All model routing is server-side only — `NVIDIA_API_KEY` and every model id are read in server code and never shipped to the browser.

### Optional Anthropic tier (off by default)

Anthropic Claude is available as an extra last-resort tier but is
**disabled unless you explicitly turn it on**. A key on its own does
nothing: an unfunded Claude account returns `400 — "Your credit balance
is too low"`, and that error would surface to users instead of a working
NVIDIA answer, so both variables below are required to enable it.

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_ENABLED` | To enable Anthropic | Set to `true` to append the Anthropic tier to the chain. Unset/`false` (the default) keeps the app NVIDIA-only and unable to incur Anthropic spend. |
| `ANTHROPIC_API_KEY` | To enable Anthropic | From the [Anthropic Console](https://console.anthropic.com). Must be on a funded account. Ignored entirely unless `ANTHROPIC_ENABLED=true`. |

## NVIDIA Inference API (`/api/ai/generate`, `/api/ai/code`)

These two endpoints return `503` if `NVIDIA_API_KEY` is unset. They use their own role-specialized models, independent of the provider-chain tiers above.

| Variable | Required | Description |
| --- | --- | --- |
| `NVIDIA_TEXT_MODEL` | No | Reasoning model — `/api/ai/generate`. Default: `z-ai/glm-5.2`. |
| `NVIDIA_CODE_MODEL` | No | Code model — `/api/ai/code`, and reused by the chat/agent pipeline's code-generating agents. Default: `poolside/laguna-xs-2.1`. |

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
| Real AI chat + agent builds | `OPENROUTER_API_KEY` and optionally `NVIDIA_API_KEY` |
| Durable agent checkpoints | `MONGODB_URI` |
| Cloudflare artifact backups | `CLOUDFLARE_ACCOUNT_ID` + R2 variables |
| Billing/subscriptions | `SUPABASE_SERVICE_ROLE_KEY` + Paystack and/or Flutterwave keys |
| NVIDIA text/code endpoints | `NVIDIA_API_KEY` |
| Product analytics | `NEXT_PUBLIC_POSTHOG_KEY` |
