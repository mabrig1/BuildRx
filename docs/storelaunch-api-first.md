# StoreLaunch business templates and API-Anything-inspired connector

Six **complete independent Cloudflare Worker** StoreLaunch apps can be imported as editable projects through BuildRx's New Project dialog.
Select Restaurant, Supermarket, Gadgets, Services, Pharmacy + AI Agents, or EstateSmart Real Estate and upload the corresponding ZIP, or the complete four-edition kit.

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

## Fifth edition: PharmaSmart (regulated shop preview)

`05_Pharmacy` is a standalone Cloudflare Worker shop with demo wellness items, D1, a pharmacist contact queue, expiry/stock/restriction safety agents and optional OpenRouter aggregate-only summaries. It is imported through the **Pharmacy + AI Agents** card using the separately supplied ZIP. Its owner-only agent endpoints are inside the imported Worker, not the BuildRx server. Customer messages are not sent to external AI. Prescription-only and controlled medicines cannot be automatically checked out. E-pharmacy registration, independent PCN verification, pharmacist oversight, privacy and provider setup are operator responsibilities. No production activation or deployment is part of importing. See `PHARMACY_COMPLIANCE.md` in the pharmacy ZIP.

## Sixth edition: EstateSmart property marketplace

`06_RealEstate` is a standalone Cloudflare Worker + D1 marketplace for house, apartment, shop, office and warehouse rental, land purchase/lease and property sales. Unlike ordinary goods, real properties are never instant checkout items: deposits, land transfers, rent collection and escrow are unavailable. Customers search and request human-confirmed viewings; owners manage genuine authorised listings, evidence checklists, private lead contact information and agent tasks. AI Operations uses deterministic duplicate/missing-evidence/staleness/follow-up scans; optional `openrouter/free` receives aggregate-only counts. The independent title verification process is described in `REAL_ESTATE_DUE_DILIGENCE.md`. The ZIP includes browser UI, dashboard, OpenAPI, 25 Node integration/unit tests and setup guidance. Source remains draft when imported into BuildRx.
