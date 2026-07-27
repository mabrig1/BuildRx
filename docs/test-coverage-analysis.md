# Test coverage analysis

_Baseline as of `fa56e89`._

## Where we stand

There is no test coverage. Not "low" — zero:

| Signal | State |
| --- | --- |
| Test framework | none installed (no vitest/jest/playwright in `package.json`) |
| Test files | 0 (`*.test.*`, `*.spec.*`, `__tests__/`) |
| `npm test` script | absent |
| CI workflows | no `.github/` directory |
| Coverage tooling | none |

The only automated quality gate is `next lint` and `tsc` during `next build`.

For scale, what is currently unguarded:

- ~14,350 lines of TypeScript under `src/` (excluding `components/ui/` primitives)
- 32 API route handlers
- 10 pipeline agents plus an orchestrator
- 25 SQL migrations, almost entirely RLS policy definitions
- 2 payment providers with webhook endpoints that grant paid plans

Because `tsc` runs during build, type errors are caught. Nothing else is —
including every behavior below, all of which is logic a type checker cannot
see.

---

## Priorities

Ordered by `blast radius × defect probability`, not by how easy the code is to
reach. Everything in P0 and P1 is a pure or near-pure function, so the cost of
covering it is low.

### P0 — Payment integrity

`src/lib/billing/providers.ts`, `src/lib/billing/service.ts`,
`src/app/api/billing/webhooks/*/route.ts`, `src/app/api/billing/verify/route.ts`

These endpoints grant paid plans. They have no tests at all.

**Signature verification** (`paystackVerifySignature`,
`flutterwaveVerifySignature`, `constantTimeEquals`) is the only thing standing
between an unauthenticated POST and a free Pro subscription. Cover:

- a correct HMAC-SHA512 over the raw body is accepted
- a wrong signature, a truncated signature, and a signature of different length
  are all rejected (the length-mismatch path returns early and never reaches
  `timingSafeEqual` — that early return must stay `false`)
- **missing `PAYSTACK_SECRET_KEY` / `FLUTTERWAVE_SECRET_HASH` fails closed.**
  Both functions currently return `false` when the secret is unset, which is
  correct. It is also exactly the line a well-meaning refactor inverts.
- the handler verifies against the **raw** body, not a re-serialized object

**Amount is never validated against the plan price.** Both webhook handlers
accept whatever `amount` arrives and activate Pro:

```ts
// paystack/route.ts
if (event.event === "charge.success" && event.data?.metadata?.user_id) {
  await activateProSubscription({ amount: (event.data.amount ?? 0) / 100, ... });
}
```

A signed `charge.success` for 1 kobo activates a full Pro subscription, and
`amount` defaults to `0` when absent. A test asserting "activation requires an
amount matching the Pro plan price" pins the invariant and documents whether
under-payment should be rejected or merely flagged.

**Replay is not idempotent.** `activateProSubscription` upserts `subscriptions`
with `current_period_end` recomputed as `now + 30 days` on every call. The
invoice insert *is* idempotent (`onConflict: "reference", ignoreDuplicates`),
but the subscription period is not — replaying one captured webhook N times
extends the subscription by 30 days each time. Test: same `reference` applied
twice must not move `current_period_end`.

**`getBillingSummary` leaks invoices across users.** In
`src/lib/billing/service.ts`, the projects and usage queries are deliberately
owner-scoped, with a comment explaining why:

> Scope to the user's own rows — visible rows under RLS also include
> public/team projects (and everything, for admins), which would misreport
> usage against the personal plan limits shown here.

The invoices query in the same `Promise.all` has no `.eq("user_id", userId)`,
and `20260715001200_billing_providers.sql` defines an explicit
`"Admins can view all invoices"` SELECT policy. So an admin opening `/billing`
sees the platform's invoices rendered as their own billing history. The
adjacent comments anticipate this class of bug; a test would have caught it.

### P0 — Auth and authorization boundaries

`src/lib/auth/redirects.ts`, `src/lib/health/admin-guard.ts`,
`src/lib/supabase/middleware.ts`, `src/lib/ai/route-helpers.ts`

`sanitizeNextPath` is nine lines guarding against open redirect and is used on
every post-auth navigation. Table test: `//evil.com`, `/\evil.com`,
`https://evil.com`, `javascript:alert(1)`, `null`, `""`, `/dashboard?next=x`,
and the encoded forms (`%2f%2fevil.com`) — the last group determines whether
decoding happens before or after the check, which is currently unpinned.

`requireAdmin` **fails open by design**:

```ts
if (!isSupabaseConfigured()) {
  return { ok: true, userId: null };
}
```

That is intentional for demo mode, but it means a single typo'd
`NEXT_PUBLIC_SUPABASE_URL` in production opens `/api/health/*` and
`/api/admin/*` to anonymous callers. Test both branches explicitly so the
trade-off is a recorded decision rather than an accident.

`updateSession` in the middleware has untested branches on every request:
prefix matching for `protectedPrefixes` (`/admin` requires *a session*, not the
admin role — page-level checks carry that weight), the signed-in bounce off
`authPages`, and the entire `hostRedirect` split-domain state machine
(app-host root → `/dashboard`, marketing paths → apex, apex app-paths → app
host, and the no-op when `NEXT_PUBLIC_APP_HOST` is unset).

`authorizeAiRequest` is the shared gate for every AI endpoint and has four
distinct failure modes that callers depend on: 401 unauthenticated, 402 quota
exhausted, 429 rate limited, 504 on DB timeout — plus the ordering between
them and the IP-keyed fallback in demo mode.

### P0 — Path traversal

`isSafeFilePath` in `src/lib/agents/llm.ts` is the single guard between
LLM-generated paths and both the database and the export zip. It is called from
`parseFileBlocks`, `assertSafePath` (all filesystem writes), and
`/api/files`. Six lines, one boolean, three call sites, zero tests.

Cases: `../../etc/passwd`, leading `/`, `..` anywhere, backslashes, NUL bytes,
201-character paths, empty string, and the legitimate paths that must survive
(`src/app/page.tsx`, `preview/index.html`, `a.b..c.txt`). Worth deciding
explicitly whether `C:/foo` and unicode-normalized traversal should be
rejected — today they are not.

### P1 — LLM output parsing

`extractJson`, `repairTruncatedJson`, `pendingClosers`, `parseFileBlocks` in
`src/lib/agents/llm.ts`

This is roughly 90 lines of hand-rolled character-by-character state machine
parsing untrusted model output, and it is the highest defect-density code in
the repo: string-escape tracking, brace balancing, `<think>` block stripping,
fence extraction, and truncation repair. It is also completely dependency-free,
so tests are pure input/output.

Cover: fenced and unfenced JSON; prose on both sides; a `<think>` block
containing draft JSON with braces (the case the code was written for); braces
and brackets inside string *values*; escaped quotes and escaped backslashes;
truncation mid-array, mid-object, and mid-string; input with no `{` at all
(must throw); and `repairTruncatedJson` returning `null` when there is no
complete element to fall back to.

For `parseFileBlocks`: CRLF line endings, an empty file body, a block missing
its `===END===`, multiple consecutive blocks, and — importantly — that a block
whose path fails `isSafeFilePath` is silently dropped rather than written.

### P1 — Time budget arithmetic

`remainingBudgetMs`, `stepBudgetMs`, `canCallModel`, `outOfTimeNote`,
`fallbackReason` in `src/lib/agents/llm.ts`; `AGENT_WEIGHTS` and
`pipelineBudgetMs` in `src/lib/agents/orchestrator.ts`

The two most recent merges ("give models time to answer", "READY must mean
verified") both changed this logic, which is a good signal that it will change
again. The floor/ceiling clamping, the "already past the deadline" case
(negative remaining), the `MIN_LLM_BUDGET_MS` cutoff that decides whether a
step calls a model or falls back to a scaffold, and the weighted re-split of
remaining budget across the ten agents are all deterministic given a fake
clock. Use `vi.useFakeTimers()` and table-drive them.

`fallbackReason` is an ordered regex chain, so precedence matters: a message
containing both `429` and `timed out` currently resolves to the timeout branch
because it is tested first. That is fine — but it should be an assertion, not
an accident of line order.

### P1 — Resilience primitives

`src/lib/health/retry.ts`, `src/lib/rate-limit.ts`

`withRetry`: attempt counts, the `isRetryable` short-circuit that rethrows
immediately, exponential growth capped at `maxDelayMs`, and the fact that full
jitter (`Math.random() * backoff`) can produce a near-zero delay — seed or stub
`Math.random` so the test is deterministic.

`withTimeout`: rejects with the labeled message, clears its timer on the
success path (a leaked timer keeps a serverless function alive), and does not
cancel the underlying work — that last one is documented behavior and should be
asserted so nobody "fixes" it into a breaking change.

`CircuitBreakerRegistry`: the full `closed → open → half-open → closed` cycle,
`resetAfterMs` expiry, and the behavior when a half-open probe fails
(`failureCount` is never reset on the half-open transition, so the next failure
takes it from 3 to 4 and re-opens immediately — intended, currently unwritten).

`rateLimit` has a latent cross-limiter bug worth pinning before it bites: the
periodic cleanup pass evicts stale keys using **the current call's `windowMs`**,
applied to every key in the shared module-level map. All callers happen to use
60s today, so it is benign — the moment a second limiter with a different
window is added, one limiter starts evicting the other's live entries. Also
cover the sliding-window boundary, `remaining` after a rejected request, and
`reset` derived from the oldest surviving timestamp.

### P2 — Model resolution and configuration

`src/lib/ai/models.ts`, `src/lib/ai/nvidia.ts`, `src/lib/config/validate.ts`

`validModelId` exists because of a real incident — an API key pasted into a
model-name variable made every request 404 while the pipeline silently degraded
to scaffolds. Test the `nvapi-` prefix heuristic, the `bearer ` heuristic, the
120-character ceiling, the `vendor/model-name` shape, and that a rejected value
is logged **by variable name only, never by value**. Note `REJECTED_MODEL_VARS`
is module-level mutable state that must be reset between tests.

`resolveModelForRole`: precedence (valid env override wins outright > strongest
available candidate > built-in default), the 10-minute catalog TTL, the
single-flight guard, and that an empty catalog response caches nothing so the
next call retries. `listAvailableModels` swallows all errors and returns `[]`,
so the fallback path is reachable — assert it resolves to the static default
rather than throwing.

`validateConfiguration` is a pure env → report function: severity rollup
(`fail` beats `warn` beats `ok`), `canGenerate` only when the key is present
*and* the base URL is https, and the `ANTHROPIC_ENABLED` warning that exists to
stop the paid tier from being switched on silently.

### P2 — Static check suite

`src/lib/agents/checks.ts` (335 lines)

`runStaticChecks` is deterministic and drives the automated repair loop, so a
false negative ships a broken generated app and a false positive burns repair
rounds. Natural fit for golden fixtures: a small in-memory `WorkflowContext`
plus an expected findings list. Cover import resolution across the eight
candidate extensions, `@/` alias mapping, relative `..` traversal, the
bare-package path deferring to the dependency check, `PROVIDED_PACKAGES`
exclusions, brace-balance detection, missing default export in `page.tsx`,
malformed `package.json`, and each `SECRET_PATTERNS` rule (which should be
tested with obviously-fake keys).

### P3 — Integration and end-to-end

**RLS policies.** 25 migrations define the actual authorization model, and much
of the application code deliberately delegates to them — several routes have no
explicit ownership check because RLS is expected to scope the query. That
assumption is entirely unverified. A pgTAP suite or a seeded Supabase branch
running "user A cannot read user B's `project_files` / `messages` / `invoices` /
`subscriptions`" would test the security model rather than the code that trusts
it. This is the single highest-value item in the whole document; it is P3 only
because it needs infrastructure the other tiers do not.

**One E2E smoke path.** Chromium and Playwright are already available in the
web/CI container. Signup → create project → run build → preview renders → export
zip would catch the whole-app breakage that unit tests structurally cannot.

---

## Suggested setup

Vitest, node environment, with the `@/` alias mirrored from `tsconfig.json`:

```jsonc
// package.json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Everything in P0–P2 runs in this config with no database, no network, and no
React renderer — the modules were written as pure functions with their I/O
pushed to the edges, which is why the cost here is low. Component and route
tests would need `environment: "jsdom"` and a `next/headers` mock; they can wait.

Add a GitHub Actions workflow running `npm run lint`, `npx tsc --noEmit`, and
`npm test` on pull requests. The type check is currently only enforced during a
full `next build`, so a PR can go green on lint alone today.

## Suggested order

1. `sanitizeNextPath`, `isSafeFilePath`, `validModelId` — ~30 assertions, all
   security-relevant, done in an afternoon. Establishes the harness.
2. Billing signature verification and webhook activation, including the amount
   and replay invariants above.
3. `extractJson` / `parseFileBlocks` — highest defect density in the repo.
4. Budget math and resilience primitives under fake timers.
5. `runStaticChecks` golden fixtures.
6. RLS integration suite.
7. One Playwright smoke path.

Steps 1–5 are pure-function tests with no infrastructure. They would also have
caught the two concrete defects this analysis turned up (cross-user invoice
leakage, non-idempotent subscription renewal), which is the argument for
starting there.
