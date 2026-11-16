# BuildRx App Template Library

BuildRx provides two different starting points for vibe coders, both available from
**New project**.

## 1. Choose an app idea — 24 editable briefs

Use the search box or category picker to find a working specification for:
online shops, booking, courses, CRM, research, SaaS, inventory/POS,
restaurants, schools, church administration, event ticketing, rentals,
invoicing, delivery services, academic printing, jobs, scholarships,
NGO programs, clinic scheduling, hotel bookings, real estate, communities,
creator studios and local business directories.

Each brief preloads real requirements: user roles, pages, workflow,
database tables, validation, accessibility, privacy controls and
testable acceptance criteria. The brief is **not** a deployed app.
Choose one, adjust the specification, create the project and run the AI build.

## 2. Clone reviewed GitHub code — five pinned sources

BuildRx also offers **Clone to my project** for these reviewed MIT-licensed
Next.js repositories. Sources are pinned to their audited commit, not a moving branch:

| BuildRx name | Upstream | License | Additional setup |
| --- | --- | --- | --- |
| Editorial Blog | [Vercel blog-starter](https://github.com/vercel/next.js/tree/cc65c414d283e22e587828c94770d9b12522bbb4/examples/blog-starter) | MIT | Content, images, dependency review |
| Login & Database Starter | [Vercel with-supabase](https://github.com/vercel/next.js/tree/cc65c414d283e22e587828c94770d9b12522bbb4/examples/with-supabase) | MIT | User-owned Supabase credentials and callback configuration |
| AI Chatbot & Tools | [shadcn-ui chatbot-template](https://github.com/shadcn-ui/chatbot-template/tree/4106041b1bc9bab44e81ffd2764aa2b6f100e2b0) | MIT | Next.js 16, AI SDK 7, an authorized server-only model/Gateway key |
| Tool-Using AI Agent | [thorchh/agent-starter](https://github.com/thorchh/agent-starter/tree/b6edd7621637781fd84c01dac022e9a0c33d3672) | MIT | Next.js 16, selected LLM/tools providers, scoped credentials and action safety |
| AI Business SaaS | [AdityaKodez/gridly](https://github.com/AdityaKodez/gridly/tree/4f52ab299242ad380c559e077bd660c516e2fa65) | MIT | Next.js 16, Prisma + Postgres, Better Auth, optional AI and Polar billing |

These templates contain **real third-party source code**, copied from the
immutable Git commits above rather than generated from a text prompt.
BuildRx preserves the upstream MIT license notice (root LICENSE or parent license.md)
and creates
`BUILD-RX-SOURCE.md` with the source URL and commit for attribution.

### Clone workflow

1. Sign in to BuildRx with persistent storage enabled.
2. Click **New project → Clone real open-source code from GitHub**.
3. Choose a source and click **Clone to my project**.
4. BuildRx saves approved UTF-8 code files into a new private **Draft**
   project. Open the file editor, review dependencies and customize.
5. Add missing assets and required application credentials through
   secure provider settings. Test your app before enabling a live deployment.

No personal GitHub token is needed to read these public examples.

## Safeguards and limits

- The server accepts only catalog template IDs. Repository, commit, path and
  license are pinned server-side; arbitrary user-supplied URLs cannot be
  cloned through this endpoint. Root repositories and Next.js monorepo examples
  have separately restricted source paths.
- Third-party source is never executed on the BuildRx web server.
- `.env`, local credentials, editor settings, GitHub Actions workflows, package-manager
  lockfiles, generated build directories and binaries are not imported.
  The SaaS template preserves `.prisma` schemas and `.sql` migrations as text;
  database migrations are NOT executed by BuildRx.
  A scan blocks recognized embedded credentials and installation hooks.
- Each text file is limited to 90 kB, the import to 140 editable source
  files and 1.5 MB, and projects respect existing account creation limits.
- Binary photographs, fonts and videos are not stored by the current
  text-only virtual file editor; missing assets must be added separately.
- GitHub API requests retrieve pinned commit/tree metadata and license notices.
  Source files are downloaded from pinned raw URLs and checked against each
  Git blob SHA-1, reducing API quota use. An optional **server-only**
  `GITHUB_TEMPLATE_READ_TOKEN` raises authorized API metadata capacity;
  never expose it to the browser.
- A clone does not establish working authentication, payments, databases,
  email or a deployed Worker. Imported projects begin as **Draft**, not Ready.
- Agentic templates need their own provider/model keys, rate limits, tool
  permissions and human approval for high-impact or external actions.
  The importer does not make AI API usage free or configure these integrations.
- Advanced templates (such as Gridly) may require separate database services
  and builds that are not compatible with BuildRx's current Cloudflare OpenNext
  export adapter; validate locally before choosing a hosting target.
- Upstream dependencies may be newer than BuildRx's editor/runtime; review
  security advisories, accessibility, third-party component licenses and
  deployment compatibility before publication.

## Adding future GitHub code templates

Before adding another source, verify its repository origin, complete license,
direct file list, source integrity, dependencies, external-service needs
and application router structure. Pin a specific Git commit and test an
import. Do not copy unlicensed or unknown third-party repositories into
BuildRx or expose arbitrary URL cloning.
