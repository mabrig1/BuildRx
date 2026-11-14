# BuildRx Capstone — Public GitHub Evidence Check (November 12, 2026)

**Feature branch**: stacked follow-up to Capstone Evidence Portfolio PR #63. No earlier PR is merged automatically and no production deployment is requested.

## What's new

Learners preparing a capstone can **opt in** to a narrow, read-only public evidence check at `/learn/capstone`.

After they enter a canonical HTTPS GitHub repository, full 40-character SHA, and optionally a same-repo Actions run, they must explicitly accept the external GitHub privacy notice and click **Check GitHub evidence**. The browser then makes at most **three GET requests** directly to `api.github.com`:

1. `/repos/{owner}/{repo}` — check that the public API reports the expected repository as publicly accessible.
2. `/repos/{owner}/{repo}/git/commits/{fullSHA}` — confirm GitHub reports that exact public commit object.
3. `/repos/{owner}/{repo}/actions/runs/{numericRunId}` (optional) — match the run ID, returned repository and `head_sha` to the exact learner-submitted commit; display GitHub's `status` and `conclusion` verbatim.

Use the *same* validated inputs to compose all three allowlisted endpoints; no user-provided arbitrary URL is fetched. All HTTP requests use `credentials: omit`, `redirect: error`, no referrer, no cache, and no GitHub token. The check is browser-triggered only; there is no hidden scheduled polling, repository write, server proxy, or database persistence.

## Safety, consent and privacy

- The external request transmits only the **public repo name, commit SHA, optional numeric run ID and the learner's browser IP metadata** to GitHub. It does not send private code, student notes, learner profiles, attached files, passwords, GitHub integration tokens, or BuildRx-authenticated cookies.
- **Opt-in every time the submitted source references change.** The panel is keyed to the tracked repo/SHA/run and remounts, invalidating previous snapshots; it does not automatically refetch on edits. Revoking consent aborts an in-progress request and clears the snapshot.
- Public evidence checks are ephemeral browser UI state. They do not alter the local capstone JSON, server state, graduation status, review packet, qualifications, points, privileges or quotas.
- An `AbortController` limits checking time. Any timeout, CORS/privacy extension failure, GitHub API access restriction, GitHub rate limit (anonymous requests share an IP-based quota), 404 or invalid metadata is disclosed as **unavailable or unconfirmed**, never proof that a repo is nonexistent.
- No raw exception objects or third-party response bodies are displayed. No reading repository files, executing student source, CI reruns, or automatic hosting operations.
- The check refuses a repo mismatch, wrong commit, run ID or repo for the CI run. A completed GitHub run's `conclusion=success` reports *GitHub's status only*—not test validity, application correctness, project ownership, or a working deployment.
- Private repositories, OAuth/GitHub App scope grants, and private user identity verification are explicitly out of scope.
- GitHub's public API may require compatibility testing with browser CORS and site CSP/extension policies. If unavailable, **fail closed** instead of adding a privileged server fallback.

## Verified versus not verified

| Data | What the tool can report | What it cannot conclude |
| --- | --- | --- |
| Repository metadata | Public repo name was returned by GitHub | Learner owns the repository, that it is private/available under another login |
| Git commit object | A public object has the submitted SHA | That its files meet the rubric, it is the default branch, or that it represents the learner's work |
| Actions run | Run ID, source repository and HEAD commit match; status/conclusion reported | Tests were comprehensive, signed artifacts exist or a GitHub result proves production readiness |
| Demo URL | Not checked here | Any app is live, secure or storing data |
| Certificate | None issued or earned by the check | Instructor approval, competence assessment or educational accreditation |

## Automated tests

`src/lib/learn/public-github-evidence.test.ts` mocks the external requests. No live GitHub calls during CI. Cases cover:
- Exactly three allowlisted GETs, credential-free fetch options, and correct repo/SHA/run matching.
- Optional CI omitted; malformed links rejected before any network request.
- API 403/404/429 denied/rate-limited handling; commit metadata mismatch; wrong run repository or SHA.
- In-progress, failing and unavailable CI runs never described as passing verified tests.
- Network/CORS failure and no accidental successful status.

## Required manual release checks

1. Test opt-in behavior with an accessible public repository, public commit and read-only Actions run; compare output with GitHub website.
2. Test invalid URL, private repo, deliberate SHA mismatch, 404, GitHub rate limits and CORS failure. Confirm no false green status.
3. Inspect browser Network tab: **zero** metadata requests before clicking, at most 3 GitHub GET requests after opt-in and no Authorization header or BuildRx session cookies.
4. Check that editing repo/SHA/run, switching tracks or revoking consent clears/aborts the previous result; no auto-check.
5. Confirm private evidence notes and JSON exports never change when clicking Check GitHub.
6. Test mobile/keyboard and disabled-CORS/offline behavior before allowing production rollout.

**References**: GitHub REST API `Get a commit object` — https://docs.github.com/en/rest/git/commits ; `Get a workflow run` — https://docs.github.com/en/rest/actions/workflow-runs ; public API limits — https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api .

## Later improvements (not implemented here)

Authenticated private-repo verification could be built with an audited GitHub App authorization grant, read-only scopes, consent, per-tenant quotas, security logs and explicit token revocation. Formal grades would additionally require identified independent reviewers, isolated source builds, reliable test artifact provenance, human sign-off and appeals. **This first slice deliberately does none of those things.**
