# BuildRx Template-first Free AI Design Swarm

## New builder behavior
1. Match the app to one of seven original local reusable UI design kits.
2. Compose responsive HTML preview and editable React/Tailwind pages before calling any AI model.
3. Run twelve *deterministic* design checks, not twelve separately billed LLM requests.
4. Make at most one optional OpenRouter free router call for creative hero copy.
5. Keep the template even when free inference is unavailable or rate-limited.
6. Continue backend generation, security, QA, certification and owner-approved publishing.

## Free inference
BuildRx generation uses the model ID openrouter/free and freeOnly provider flag by default. Paid provider/model routing requires the owner's explicit BUILDRX_ALLOW_PAID_AI=true. No payment credentials or environment settings are changed by this branch. Free inference is rate-limited and is not guaranteed to answer every request.

## Provenance and licensing
All seven instantiated kits are original locally authored BuildRx React/HTML sources. No remote repository is cloned or executed during generation. The existing GitHub starter importer remains available for reviewed, pinned MIT sources. Shadcn UI open-source blocks are useful for optional future integration, subject to license verification.

## Honesty boundaries
The courier demo uses sample shipments, mocked route locations, local browser storage and demo status changes. It does not provide live GPS, actual rider assignments, payments, messaging, database persistence or production verification. No UI preview is a certificate of running backend functionality.

## Release gate
Require lint, typecheck, unit tests, production build, generated-app certification, source security, and an authenticated browser smoke test. Do not merge/deploy until checks pass and the correct Vercel project is accessible.