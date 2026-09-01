# Deployment guide

This guide covers deploying **App-Creator itself** to production. (Deploying the apps your users generate is built into the product — the Deploy panel pushes them to Vercel, Netlify, or Railway.)

The recommended host is [Vercel](https://vercel.com); any Node 20+ host that runs `next build` / `next start` works the same way.

## 1. Prepare Supabase for production

1. Apply migrations to your production project (if you haven't already):

   ```bash
   npx supabase link --project-ref <prod-project-ref>
   npx supabase db push
   ```

2. In **Authentication → URL Configuration**:
   - Set **Site URL** to your production origin, e.g. `https://app.example.com`
   - Add `https://app.example.com/auth/callback` to the **Redirect URLs** allow list (keep the localhost entry if you still develop locally against the same project)
3. If Google login is enabled, make sure the Google OAuth client's authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback` (it points at Supabase, not your domain, so it doesn't change per deployment).

## 2. Deploy to Vercel

1. Push the repository to GitHub and **Import Project** in Vercel (or run `vercel` from the CLI). The defaults are correct: framework **Next.js**, build command `next build`, Node 20+.
2. Add environment variables (Project → Settings → Environment Variables). Minimum for a connected deployment:

   ```
   NEXT_PUBLIC_APP_URL=https://app.example.com
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...        ← required for billing to activate
   OPENROUTER_API_KEY=...               ← recommended primary AI provider
   NVIDIA_API_KEY=...                   ← optional fallback (free at build.nvidia.com)
   MONGODB_URI=...                      ← durable agent/build-run checkpoints
   CLOUDFLARE_ACCOUNT_ID=...
   CLOUDFLARE_API_TOKEN=...
   CLOUDFLARE_R2_BUCKET=...
   CLOUDFLARE_R2_ACCESS_KEY_ID=...
   CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
   ```

   Add the optional groups (PostHog, Paystack, Flutterwave) as needed — the [environment variable reference](environment-variables.md) explains each one. `NEXT_PUBLIC_*` values are baked in at build time, so **redeploy after changing them**.
3. Deploy. Preview deployments work too, but OAuth and payment callbacks will only round-trip cleanly on domains listed in your Supabase redirect allow list.

### Provider boundaries

- **Vercel** runs the Next.js control plane and generated-app deployments. The Deploy panel uploads the complete generated source tree by SHA digest; secret `.env*` files are excluded.
- **Supabase** is the only authority for authentication, project ownership, relational records, generated source files, and RLS.
- **MongoDB Atlas** stores only document-shaped `build_runs` checkpoints. Do not replicate users, entitlements, or project authorization into it.
- **Cloudflare** owns DNS/edge protection and private R2 ZIP artifacts. It is not a second application runtime.

Create the MongoDB and R2 resources first, then copy their server-only values into Vercel. Never put connection strings, service-role keys, API tokens, or R2 secrets in a `NEXT_PUBLIC_` variable.

### Function duration limits

The AI routes declare `maxDuration` of 120–300 seconds (`/api/chat` and `/api/agents/run` are 300s). On Vercel's free (Hobby) tier functions can cap lower than that. The build pipeline budgets itself against `AGENT_PIPELINE_BUDGET_MS` (default 270s) and hands each step a slice of it, so a slow model degrades that step to its built-in scaffold rather than stalling the run — but the budget still has to fit inside the platform's ceiling. If your plan caps functions below 300s, set `AGENT_PIPELINE_BUDGET_MS` to roughly (cap − 30s) so the pipeline finishes and saves its files before the platform kills the function.

### Cross-origin isolation (WebContainers)

The WebContainer preview route needs cross-origin isolation. `next.config.ts` already sends the required headers, scoped to just that route:

```
/preview/:projectId/container
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

No platform configuration is needed — but if you put a proxy/CDN in front of the app, make sure it forwards these headers. WebContainers also require a Chromium-based browser and access to StackBlitz's runtime CDN from the visitor's network.

## 3. Register payment webhooks

Webhooks make subscription activation robust: even if a user closes the tab before the `/api/billing/verify` callback runs, the provider still notifies you. Both handlers verify signatures and are idempotent (an invoice reference is only recorded once).

**Paystack** — Dashboard → Settings → API Keys & Webhooks:

```
Webhook URL: https://app.example.com/api/billing/webhooks/paystack
```

Requests are authenticated by the `x-paystack-signature` header (HMAC-SHA512 of the raw body with your `PAYSTACK_SECRET_KEY`).

**Flutterwave** — Dashboard → Settings → Webhooks:

```
URL:         https://app.example.com/api/billing/webhooks/flutterwave
Secret hash: <the value you set as FLUTTERWAVE_SECRET_HASH>
```

Requests are authenticated by the `verif-hash` header matching `FLUTTERWAVE_SECRET_HASH`.

Use each provider's dashboard test tools (or test-mode keys) to send a test event and confirm a `200` response before going live.

## 4. Split-domain architecture (optional)

BuildRx can serve the marketing site and the product on separate hosts from **one deployment**:

```
buildrx.online          → Home, Features, Pricing, Docs (+ redirects app routes)
app.buildrx.online      → Dashboard, Chat, Editor, Preview, Deploy, auth
```

1. In Vercel, add **both** domains to the project (Settings → Domains): the apex (`buildrx.online`, plus `www` if you want it) and `app.buildrx.online` (CNAME to `cname.vercel-dns.com`).
2. Set `NEXT_PUBLIC_APP_HOST=app.buildrx.online` for the **Production** environment only (previews should stay single-host) and redeploy.

Middleware then routes by host: app routes requested on the apex redirect to the subdomain, marketing pages requested on the subdomain redirect to the apex, and `app.buildrx.online/` lands on the dashboard. Auth cookies live on the app subdomain, so login/signup always happen there. Leave the variable unset to serve everything on one host.

## 5. Custom domain

Add your domain in Vercel (Project → Settings → Domains) and point DNS at it. Then update, in this order:

1. `NEXT_PUBLIC_APP_URL` to the new origin (redeploy)
2. Supabase Site URL + redirect allow list
3. Paystack / Flutterwave webhook URLs

## 6. Post-deploy checklist

- [ ] Landing page loads; `/login` and `/signup` work
- [ ] Sign up with a fresh email — the `users` row is created (trigger)
- [ ] Google login round-trips through `/auth/callback` (if enabled)
- [ ] Create a project, run **Build app**, files persist after refresh
- [ ] The build log includes **FounderOps Agent**, and the generated project contains all four `docs/*.md` evidence files
- [ ] AI chat streams real responses (not the demo-labeled mock)
- [ ] `/api/ai/health` reports the configured primary provider as reachable
- [ ] Admin health reports MongoDB checkpoints and Cloudflare R2 as reachable
- [ ] Export a project and confirm `X-BuildRx-Artifact: stored`
- [ ] Deploy a generated project to Vercel and confirm its Next.js routes, API routes, and persistence configuration—not only the static preview—are present
- [ ] `/billing` shows the Free plan; a test checkout completes and the invoice appears
- [ ] Provider webhook test event returns `200`
- [ ] `/admin` is reachable only by an admin user (promote yourself: `update public.users set role = 'admin' where email = '...'`)
- [ ] `/preview/<project-id>/container` boots the WebContainer preview in Chrome

## Other hosts (Railway, Fly.io, a VPS…)

Nothing is Vercel-specific:

```bash
npm ci
npm run build
npm run start   # serves on PORT (default 3000)
```

Requirements: Node 20+, HTTPS at the edge (Supabase auth cookies are `Secure`), the same env vars, and passing through the COOP/COEP headers on `/preview/:projectId/container`. Ensure your platform's request timeout allows for the long-running streaming AI routes.
