# Provider budget recovery and honest verification

Observed screenshot: a request asked for 4000 output tokens while OpenRouter
reported an affordable ceiling of 2276; a generated ErrorFixer preview appeared
inside ResearchStat Pro QA alongside success claims.

## Changes

- Shared OpenRouter request handling retries a rejected 402 once only when its
  message contains a viable lower affordable ceiling. It uses 90% of that ceiling
  (2048 for this screenshot) and the original AbortSignal deadline. No model,
  credentials, account limits or provider settings change. A second rejection,
  exhausted balance or unusably small ceiling remains an error.
- Natural repair commands enter the saved-project repair route, preserving its
  brief, plan and source snapshot instead of acting as a new product brief.
- The workflow records essential planner/UI/database/coding degradation. A persisted
  product with those blockers fails verification even when source checks pass.
- QA, repair, authentication and preview completion messages distinguish static
  evidence from runtime behavior. Saving HTML is no longer described as a verified
  external deployment.

## Validation

555 tests passed across 38 files; TypeScript typecheck passed. New regressions cover
4000/2276 recovery, a fixed retry bound and shared deadline, unrecoverable budgets,
natural repair intent, and failed generation preventing ready status.

This change has not been pushed or deployed. No paid provider call was made.
The user's existing saved generated project and actual production runtime were not
modified. A follow-up preview should reproduce the reported user task and inspect
its plan before any production release. This patch does not claim to repair every
runtime or semantic defect automatically.
