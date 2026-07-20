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
   ANTHROPIC_API_KEY=...
   ```

   Add the optional groups (NVIDIA, PostHog, Paystack, Flutterwave) as needed — the [environment variable reference](environment-variables.md) explains each one. `NEXT_PUBLIC_*` values are baked in at build time, so **redeploy after changing them**.
3. Deploy. Preview deployments work too, but OAuth and payment callbacks will only round-trip cleanly on domains listed in your Supabase redirect allow list.

### Function duration limits

The AI routes declare `maxDuration` of 120–300 seconds (`/api/chat` and `/api/agents/run` are 300s). On Vercel's free (Hobby) tier functions cap lower, so long agent builds may be cut off — Pro is recommended for production use, or trim `maxDuration` to your plan's ceiling.

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
- [ ] AI chat streams real responses (not the demo-labeled mock)
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

## Appendix: the in-product Deploy panel (deploying *users'* generated apps)

Everything above is about deploying BuildRx itself. This is about the "Deploy" button inside a project's workspace — what it actually does per provider, since the three aren't equivalent:

- **Vercel** ships the project's full generated source tree (the same files `GET /api/projects/{id}/export` zips up — `package.json`, `src/app`, everything) via Vercel's Deployments API, with the framework auto-detected from `package.json` so Vercel's own pipeline runs a real `next build`. A generated app with a genuine bug can fail to build on Vercel — that's surfaced as a `failed` deployment with the build error in its log, which is correct: it means the app doesn't actually build, not that deployment is broken.
- **Netlify** only ever receives the static `preview/index.html` snapshot (a self-contained rendered preview of the home page, not the full app). Netlify's digest-deploy API — the one this integration uses — is a static-file-serving endpoint; it doesn't run an arbitrary build command the way a git-linked Netlify site or a `netlify.toml`+zip deploy would. Wiring up a real Netlify build would mean switching to zip-based deploys with a Next.js Runtime plugin — not done here.
- **Railway** doesn't accept an upload at all through this integration — it deploys from a connected GitHub repository, so the adapter just hands back a "new service from this repo" URL for the user to finish in Railway's own UI.

No rollback/redeploy-a-previous-version yet (deployment history stores metadata and logs, not a file snapshot per deployment), and no DNS verification for custom domains (the domain field is just passed to the provider's "add domain" API and stored — no TXT/CNAME/SSL-status checking).
