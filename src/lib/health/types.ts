/**
 * Shared types for the self-healing platform core: health checks,
 * structured errors, and the fix-proposal approval workflow.
 */

export type HealthStatus = "healthy" | "degraded" | "down";

export type Subsystem =
  | "database"
  | "auth"
  | "api"
  | "deployment"
  | "storage"
  | "ai"
  | "jobs";

export interface CheckResult {
  subsystem: Subsystem;
  label: string;
  status: HealthStatus;
  summary: string;
  /** Extra machine-readable detail, shown expanded on the dashboard. */
  detail?: Record<string, unknown>;
  checkedAt: string;
  /** Time the check itself took, for spotting slow/degraded dependencies. */
  durationMs: number;
}

export interface HealthReport {
  overallStatus: HealthStatus;
  checks: CheckResult[];
  takenAt: string;
}

export type FixProposalStatus =
  | "pending"
  | "approved"
  | "applied"
  | "rejected"
  | "failed";

export interface FixProposal {
  id: string;
  subsystem: Subsystem;
  code: string;
  title: string;
  description: string;
  sqlFix: string | null;
  status: FixProposalStatus;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  result: string | null;
}

/** A candidate fix a check can surface when it finds something broken. */
export interface FixCandidate {
  code: string;
  title: string;
  description: string;
  sqlFix: string | null;
}

/**
 * Structured shape every classified error carries — this is what
 * replaces "Something went wrong" everywhere it's surfaced.
 */
export interface DiagnosedError {
  message: string;
  code: string;
  subsystem: Subsystem;
  cause: string;
  suggestedFix: string;
  retryable: boolean;
}
