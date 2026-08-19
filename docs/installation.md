# Installation

App-Creator runs in two modes:

- **Demo mode** — zero configuration. In-memory data, simulated GitHub/deploy/billing providers, mock AI responses. Everything is clickable; nothing persists across restarts.
- **Connected mode** — Supabase for auth + persistence, NVIDIA for real AI, and optional provider keys for GitHub pushes, deployments, payments, and analytics.

## Prerequisites

- **Node.js 20+** (22 recommended) and npm 10+
- A [Supabase](https://supabase.com) project (free tier works) — connected mode only
- A free [NVIDIA API key](https://build.nvidia.com) for real AI generation
- Optional: [Paystack](https://dashboard.paystack.com), [Flutterwave](https://app.flutterwave.com), [PostHog](https://posthog.com) accounts

## 1. Clone and install

```bash
git clone <your-fork-url> app-creator
cd app-creator
npm install
```

## 2. Try demo mode (optional but recommended)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), visit a workspace like `/projects/demo-1`, click **Build app**, and run the pipeline with a prompt like *"Build a church website"*. You'll see the agents run, files appear in the Code tab, and the preview render — all without keys.

## 3. Set up Supabase

1. Create a project at [database.new](https://database.new).
2. Apply the schema (12 migrations, in order):

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   Alternatively, paste each file from `supabase/migrations/` (sorted by filename) into the SQL editor, then run `supabase/seed.sql` for starter templates.

3. Configure auth (Dashboard → Authentication):
   - **URL Configuration** — Site URL: `http://localhost:3000` (your production URL later). Add `http://localhost:3000/auth/callback` to the redirect allow list.
   - **Providers → Google** (optional) — add your Google OAuth client ID/secret. The authorized redirect URI on the Google side is `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Optional: point email templates at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...` — both the code and token-hash flows are supported.

## 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in at minimum:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>            # Project Settings → API
SUPABASE_SERVICE_ROLE_KEY=<service role key>        # same page — keep secret
NVIDIA_API_KEY=<nvidia key>                         # real AI generation (free)
```

Everything else is optional — see the [environment variable reference](environment-variables.md).

## 5. Run

```bash
npm run dev        # development
# or
npm run build && npm run start   # production build locally
```

Sign up at `/signup` — the database trigger creates your `users` row automatically. To use the admin dashboard, promote yourself once in the SQL editor:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

(`role` is deliberately not client-writable, so this must be done in SQL or with the service key.)

## 6. Verify the installation

- **Auth**: sign up, sign out, sign back in; try Google if configured
- **Build**: create a project, run **Build app**, confirm files persist in the Code tab after a refresh
- **AI chat**: send a message — with `NVIDIA_API_KEY` set you get real streaming responses
- **Billing**: `/billing` shows your Free plan usage meters
- **Admin**: `/admin` renders live aggregates (admin role required)

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| "Supabase is not connected" banner | `NEXT_PUBLIC_SUPABASE_*` vars missing — env vars are read at build time in Next.js, so restart/rebuild after editing `.env.local` |
| Sign-up succeeds but no `users` row | Migrations not applied in order — re-run `npx supabase db push` and check the `on_auth_user_created` trigger exists |
| AI chat returns a canned demo response | `NVIDIA_API_KEY` not set |
| AI fails with "credit balance is too low" | The optional Anthropic tier is switched on — remove `ANTHROPIC_ENABLED` (or set it to `false`) to run on NVIDIA's free models only |
| 402 "You've used all … AI requests" | Plan limit reached — upgrade to Pro or raise the limits in `src/lib/constants.ts` |
| Subscription upgrade fails with "requires the service-role key" | Set `SUPABASE_SERVICE_ROLE_KEY` — billing writes are service-role-only by design |
| WebContainer preview stuck on "Booting" | WebContainers need a Chromium-based browser, cross-origin isolation (served automatically on that route), and network access to the StackBlitz runtime CDN |
| Google login redirects to an error | Callback URL missing from Supabase's redirect allow list, or wrong redirect URI on the Google OAuth client |
