# StoreLaunch business templates and API-Anything-inspired connector

Four **complete independent Cloudflare Worker** StoreLaunch apps can be imported as editable projects through BuildRx's New Project dialog.
Select Restaurant, Supermarket, Gadgets, or Services and upload the corresponding ZIP, or the complete four-edition kit.

## What importing does

- Validates ZIP entry counts, canonical paths, source sizes, required files and Cloudflare edition identity.
- Detects likely embedded secrets and performs BuildRx DevShield preflight.
- Saves the selected edition's Worker, owner dashboard, D1 schema, API bridge and tests into the signed-in user's project.
- Seeds project guidance and returns a draft project only. No dependencies are installed or code executed.

## What it does NOT do

- BuildRx's Next.js preview is not a Cloudflare Worker runtime. Read the imported SETUP.md for deployment.
- Uploading does not create D1, configure Paystack, send Resend emails, enable OpenRouter, activate charges, or deploy.
- The import does not copy credentials or access other businesses' websites.

## Original API-Anything-inspired features

The source ZIPs contain original StoreLaunch API Bridge logic that applies useful design principles from
https://github.com/goodnight000/api-anything (MIT project; no source code copied).
StoreLaunch exposes an operation registry, OpenAPI 3.1, structured health and diagnostics, key scopes and revocation,
authenticated order reads, and idempotent product-stock updates.
Payment status is controlled only by the existing verified Paystack flow.

The separately offered Website-to-API Connector card is an **editable build specification**, not a preinstalled
browser automation product. Permissioned external website discovery and automated repair are not enabled by the import.

## Test and release checklist

1. Run BuildRx tests and typecheck against the feature branch.
2. Upload each of the four ZIPs and verify the source tree imports without entering production credentials.
3. Verify missing, mismatched and malformed archives are rejected.
4. In the imported Worker project, run its Node tests, then a Wrangler dry-run against a test D1 binding.
5. Test Paystack with sandbox/test keys and keep ENABLE_LIVE_PAYMENTS off until the owner approves.
6. Only merge/deploy after review; deleting the draft rolls back the BuildRx import without changing third-party accounts.
