# BuildRx Learning Center and AI Tutor

This is an additive beginner learning path on top of PR #54's contextual **What next?** journey, **not** a replacement for the paid Tech+ premium course.

## Free, offline-first knowledge base

- Authenticated route: `/learn`; direct deep links `/learn?lesson=cloudflare-launch`, `?lesson=github-basics`.
- Ten curated BuildRx-specific lessons: AI prompt → real app vs preview → GitHub → Vercel or Cloudflare → MongoDB/Supabase → secrets → error repair → release checks.
- Search, category filters, practical steps, common mistakes, official documentation links, and an answer-checked self-study quiz.
- Progress is saved in the current browser only and explicitly labelled **not an official certificate**.
- Lessons work even when OpenRouter/NVIDIA is offline or account AI quota is used up.

## AI-generated training (opt-in)

- `POST /api/learn/coach`: only signed-in users, only allowlisted lesson IDs. Generates a single guided lesson or a five-day practical mini-course based on the selected topic and user's stated experience.
- Uses the existing OpenRouter → NVIDIA → opt-in Anthropic provider chain. No fake generated lesson on AI-provider errors.
- Existing `authorizeAiRequest` enforces authentication, monthly entitlement and per-minute throttling; metered `recordAiUsage` logs successful and failed AI requests.
- Input is strictly validated (max 160 character learner goal); rejects likely passwords, tokens and MongoDB URI patterns. Never requests secrets; avoids logging the goal on the server.
- Model is grounded in curated tutorial steps, common pitfalls and official documentation; cannot execute commands or claim production deployment has succeeded.
- API has no store headers; generated results remain in page memory (no server-side conversation persistence).
- Model may still be wrong: show an explicit verify-against-docs warning.

## Explicit limitations and gates

- No automation in this PR creates a GitHub repo, publishes a Worker, configures MongoDB or changes Cloudflare/Vercel settings.
- Self-reported quiz results are not credentialed proof.
- AI output is educational and does not validate live app functionality.
- Cloudflare Workers release needs real tenant isolation, quotas, rollback, and verified hostname tests before BuildRx can call it one-click. Existing BuildRx issue #42 remains open.
- Paid Tech+ stays on `/course` and requires verified enrollment; no accidental bypass.

## Verification

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and generated-app certification. Test unauthorized and quota-exceeded response behavior on `/api/learn/coach`; verify no AI-provider configured response does not display fabricated training; inspect responsive layout at 360px.
