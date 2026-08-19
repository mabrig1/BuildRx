# Google Sign-In (Supabase OAuth)

The app implements Google sign-in with Supabase Auth's current PKCE flow:

1. The **Continue with Google** button (`src/components/auth/google-button.tsx`)
   calls the `signInWithGoogle` server action (`src/app/(auth)/actions.ts`),
   which calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: <origin>/auth/callback?next=... } })`
   and redirects the browser to Google.
2. Google redirects to **Supabase's** callback
   (`https://<project-ref>.supabase.co/auth/v1/callback`), which redirects
   back to the **app's** callback (`/auth/callback`).
3. `src/app/auth/callback/route.ts` exchanges the code for a session
   (`exchangeCodeForSession`, sets the auth cookies) and redirects to the
   `next` path (default `/dashboard`).

No Google credentials live in this repo or its env vars — the OAuth client
ID/secret are configured **in the Supabase dashboard**. The only env vars
the app needs are `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy
`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## One-time dashboard setup (required)

Sign-in fails with **"Unsupported provider: provider is not enabled"**
until this is done.

### 1. Google Cloud Console

[console.cloud.google.com](https://console.cloud.google.com) →
**APIs & Services → Credentials → Create credentials → OAuth client ID**:

- Application type: **Web application**
- Authorized JavaScript origins: your app origins, e.g.
  `https://www.buildrx.online`, `https://app.buildrx.online`,
  `http://localhost:3000`
- Authorized redirect URI (exactly one, the **Supabase** callback):

  ```
  https://<project-ref>.supabase.co/auth/v1/callback
  ```

Configure the OAuth consent screen (app name, support email) if prompted.

### 2. Supabase dashboard — enable the provider

**Authentication → Sign In / Providers → Google**: toggle **Enable**, paste the
**Client ID** and **Client Secret** from step 1, save.

### 3. Supabase dashboard — URL configuration

**Authentication → URL Configuration**:

- **Site URL**: your primary production origin, e.g.
  `https://www.buildrx.online`
- **Redirect URLs** (allow list) — add every origin the app runs on, with
  the app callback path:

  ```
  http://localhost:3000/auth/callback
  https://buildrx.online/auth/callback
  https://www.buildrx.online/auth/callback
  https://app.buildrx.online/auth/callback
  https://*-<vercel-team-slug>.vercel.app/auth/callback
  ```

  The last (wildcard) entry covers Vercel preview deployments. If a
  `redirectTo` isn't on this list, Supabase silently falls back to the
  Site URL — which looks like "Google sign-in redirects to the wrong
  domain / localhost".

## Development vs production

- **Development** (`npm run dev` on `http://localhost:3000`): works with the
  same Supabase project as long as `http://localhost:3000/auth/callback` is
  in the redirect allow list (step 3).
- **Production**: the server action builds `redirectTo` from the request's
  `Origin` header (falling back to `NEXT_PUBLIC_APP_URL`), so each domain
  returns to itself — every production domain must be allow-listed.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Sign-in failed: ... provider is not enabled` on /login | Google provider not enabled in Supabase (step 2). |
| `redirect_uri_mismatch` page from Google | The Supabase callback URL (step 1) is missing/wrong in the Google OAuth client. |
| After Google, you land on the wrong domain or localhost | The originating domain's `/auth/callback` isn't in the Supabase redirect allow list (step 3). |
| Lands on `/login?error=auth` with a code exchange error | PKCE cookie mismatch — usually starting the flow on one domain and finishing on another; keep the flow on a single origin. |

Auth service logs: Supabase dashboard → **Logs → Auth** (or the MCP
`get_logs` tool with service `auth`).
