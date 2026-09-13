# Live Integration Certification

This workflow validates BuildRx against real external providers without reusing production records or long-lived application data.

## What it tests

1. Generates a disposable app through the BuildRx orchestrator.
2. Pushes that generated source to a temporary GitHub branch using the Git Data API.
3. Creates a Vercel preview deployment from the exact generated files and verifies the preview reaches `READY` and answers HTTP.
4. Connects to MongoDB Atlas, performs create/read/update/delete in a dedicated certification collection, then removes the record.
5. Creates a disposable Supabase auth user, signs in with the public key, performs authenticated RLS CRUD against `projects`, verifies the private row is hidden from an anonymous client, then deletes the project/user.
6. Sends one minimal request to OpenRouter or NVIDIA and verifies a real model response.
7. Deletes the Vercel deployment and temporary GitHub branch even when a later assertion fails.

The workflow runs nightly and can be triggered manually.

## Required scoped credentials

Use dedicated certification credentials, not broad production credentials.

| Secret | Scope |
| --- | --- |
| `LIVE_CERT_VERCEL_TOKEN` | Vercel token allowed to deploy/delete previews for the certification project |
| `LIVE_CERT_VERCEL_TEAM_ID` | Team containing the certification project |
| `LIVE_CERT_VERCEL_PROJECT_ID` | Dedicated Vercel project for generated-app previews |
| `LIVE_CERT_MONGODB_URI` | MongoDB Atlas user limited to the certification database |
| `LIVE_CERT_SUPABASE_URL` | Dedicated Supabase certification project using the BuildRx schema |
| `LIVE_CERT_SUPABASE_PUBLISHABLE_KEY` or `LIVE_CERT_SUPABASE_ANON_KEY` | Public auth key for the certification project |
| `LIVE_CERT_SUPABASE_SERVICE_ROLE_KEY` | Service role for disposable test-user creation/deletion only |
| `LIVE_CERT_OPENROUTER_API_KEY` or `LIVE_CERT_NVIDIA_API_KEY` | Low-limit AI key used only for a tiny connectivity prompt |

Optional:
- `LIVE_CERT_VERCEL_AUTOMATION_BYPASS_SECRET` when deployment protection is enabled.
- Repository variables `LIVE_CERT_MONGODB_DATABASE`, `LIVE_CERT_OPENROUTER_MODEL`, and `LIVE_CERT_NVIDIA_MODEL`.

## Safety boundary

The test uses unique run IDs, deletes its Vercel preview and GitHub branch in cleanup, deletes the MongoDB document, and deletes the Supabase project/user. The normal deterministic Generated App Certification Matrix remains the release build gate; this live workflow is a separate provider-health and integration layer.
