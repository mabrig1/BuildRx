# BuildRx Beginner App Template Vault

BuildRx now has **three distinct starting points**, with clear labels so beginners know what is real source code versus an app idea.

Open **App Templates** in the BuildRx sidebar or **Projects → Browse code templates** to search, filter and copy a project. The **New project** dialog also offers starter cloning.

## 1. Original, editable beginner apps (4)

These are small, original MIT-licensed Next.js App Router projects with real code and a beginner README. They are built into BuildRx, require no GitHub requests, and import offline. There is **no external account or paid API** required to clone or try the example.

| Template | What already works | What needs development |
| --- | --- | --- |
| Business Website | Responsive service cards, contact-by-email link, CSS | Replace contact placeholders; add true bookings or payment if wanted |
| Personal Portfolio | Responsive biography, project cards, email contact | Replace content; add real project links/media |
| My Task Planner | Add, complete and delete tasks; local browser storage | Real authentication, cloud sync and backend database |
| Small Shop Stock List | Add products; adjust counts and display low stock; browser storage | Database, role permissions, transaction safety and real POS integrations |

Browser storage is only a **local demo** on one device, not a production database. No sensitive personal information or financial accounts should use this data store. Cloned projects include `README.md`, `BUILD-RX-SOURCE.md`, and `LICENSE`.

Each template imports as a **private Draft**. Cloning does not execute npm scripts or initiate deployment.

## 2. Approved, commit-pinned GitHub clones (4)

All four sources originate from **Vercel's official MIT-licensed Next.js examples** at immutable commit
`cc65c414d283e22e587828c94770d9b12522bbb4`. These were checked for App Router structure and have no install-time hooks in their example `package.json`.

| Template | Repository subtree | Level | Dependency |
| --- | --- | --- | --- |
| Editorial Blog | `examples/blog-starter` | Beginner | Content, images and dependency review |
| Login & Database | `examples/with-supabase` | Intermediate | **Your own** Supabase credentials and configuration |
| Simple Website | `examples/basic-css` | Beginner | No external service; learn CSS Modules |
| Interactive Counter | `examples/with-context-api` | Beginner | No external service; shared React Context state |

Source: https://github.com/vercel/next.js/tree/cc65c414d283e22e587828c94770d9b12522bbb4/examples

**Security measures:** the importer accepts **catalog IDs only**; user-supplied repository URLs, branches, commits and file paths cannot control the source. It traverses an immutable commit and refuses truncated trees, excessive file sizes, malformed/binary files, secrets, install-time hooks and suspicious source via DevShield. Each clone includes the original upstream license and immutable GitHub link in `BUILD-RX-SOURCE.md`.

The text-only workspace omits binary images, fonts, lockfiles and GitHub Actions workflows. Some third-party examples therefore need assets restored and dependencies reviewed before they will build correctly. **An approved catalog entry is not a guarantee of malware-free or production-ready code.** No imported source is compiled or executed on the BuildRx web server.

GitHub may rate-limit unauthenticated downloads; `GITHUB_TEMPLATE_READ_TOKEN` is an optional **server-only** read token for operators and is not needed by customers. Avoid exposing it to the browser.

## 3. Original app idea briefs (24)

These are **editable written specifications**, not source code or deployed apps. Select school management, inventory, bookings, print hub, scholarships, CRM, ministry administration, creator studio and other use cases. BuildRx seeds the prompt into the new workspace where the AI build workflow must still generate and test the app.

## Beginner journey

1. Open **App Templates** and choose **Beginner**.
2. Filter between **BuildRx originals** (no network required to prepare files) and **Pinned GitHub** (real upstream source).
3. Choose a template and click **Clone to my project**.
4. Sign in to save a **private Draft**. BuildRx checks source and saves the files with their origin/license details.
5. Edit `app/page.tsx` (or `src/app/page.tsx`) and styling to make the project yours.
6. Follow the README, review package dependencies and add any necessary service integrations.
7. Use existing BuildRx build and security verification before publishing. A clone alone is never a live URL.
8. When desired, export your own project as a ZIP using the existing project export workflow.

## Guardrails and scope

- Catalog selection is server-side allowlisted, with existing account project limits and owner-scoped persistence.
- Before creating a project, BuildRx screens the entire editable source snapshot with DevShield.
- A failed import removes its partial private draft; no permission or data grants are made by cloning.
- Third-party dependency vulnerabilities are not fully covered by static pattern scanning; dependencies need separate review.
- A source clone is not a payment, a deployed app or proof of a verified database.
- Adding another external repo requires origin verification, a compatible license and preserved attribution, an **immutable commit**, checking every imported editable file, realistic user instructions and regression tests.
- Do **not** enable arbitrary URL cloning, untrusted build hooks, uploaded binary files, or automatic deployment as a shortcut.

All additions are reversible and require no new secrets, migrations, paid APIs, Cloudflare resources or production data updates.
