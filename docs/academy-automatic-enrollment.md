# BuildRx Academy automatic paid enrollment

**Administrator:** `victoryonline1@gmail.com` is already an email-verified Supabase `admin` user in the connected BuildRx project. This change does not assign privileges based on an email string.

## Payment to training access

- A signed-in user chooses Paystack or Flutterwave and pays **₦100,000 NGN**.
- The server creates a unique `techplus_<authenticated-user-id>_<randomUUID>` reference, with immutable course metadata stored at the provider checkout.
- On success, the signed webhook signals BuildRx; the server **verifies the payment directly with the provider**, checks successful status, correct course slug/type, authenticated user UUID, issued-reference prefix, amount, currency, and provider timestamp, then creates one `course_enrollments` row via a server-only Supabase service-role client.
- Browser checkout return uses the same verification and activation path. Provider retries and callback races are idempotent.
- Paid learners with `active` or `completed` status automatically enter `/course` and `/learn/engineering`. An authenticated user with an existing administrator database role can review the full course without paying.
- `refunded` and `revoked` rows are not reactivated by retries; human review is required. Any actual refunds must also update enrollment status through an authorised back-office operation; refund automation is not part of this release.
- Paid course charges do not activate BuildRx Pro subscriptions.
- No customer-facing UI or query parameter can grant enrollment without verification.

## Production Supabase

Apply `supabase/migrations/20260913063000_add_course_enrollments.sql`. It had not been applied to the connected BuildRx Supabase project on Nov 14. The migration was applied and verified: table exists, RLS is on, `authenticated` has SELECT but not INSERT/UPDATE/DELETE, `service_role` can insert. Do not introduce a second table or overwrite enrollment rows.

## Provider setup checklist

Ensure existing provider secrets are configured **server-side**:
- `PAYSTACK_SECRET_KEY`
- `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH`
- `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and public/publishable Supabase key
- `NEXT_PUBLIC_APP_URL=https://www.buildrx.online` for correct checkout callbacks

Configure Paystack webhooks to `https://www.buildrx.online/api/billing/webhooks/paystack` and Flutterwave webhooks to `https://www.buildrx.online/api/billing/webhooks/flutterwave`. These routes handle both course and SaaS products, distinguished by provider-verified metadata. Verify provider console configuration; no secrets should be pasted into chat or source.

## Verification and manual release gates

1. Run CI lint, TS, Vitest, production build, generated app certification and security scan.
2. Verify Paystack and Flutterwave simulated signed payloads route to the course handler without granting Pro; malformed/underpriced/currency-mismatch cases fail closed.
3. Confirm live `course_enrollments` RLS and grants, signed-in administrator access, a legitimate test-mode provider payment, automatic enrollment when callback is not visited, duplicate webhook idempotence, unpaid course lockout, and any provider retry handling.
4. Do not claim full live payment automation until both provider dashboards and a paid sandbox test are verified. No real charge or refund should be used for smoke tests.
5. No grants of role/admin privileges in this change. Course completion remains browser-local learning progress, not staff-certified evidence.

