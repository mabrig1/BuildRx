/**
 * Read-only, bounded diagnostic of one saved generated project.
 * Findings are static evidence only: do not claim runtime/hosting success.
 * No model calls or file writes are performed by this module.
 */
import { runStaticChecks } from "@/lib/agents/checks";
import type { AppPlan, CheckFinding, GeneratedFile, WorkflowContext } from "@/lib/agents/types";
import { scanDevShieldSource } from "@/lib/security/devshield-preflight";

export type DoctorSeverity = "blocker" | "warning";
export type DoctorAction = "build" | "repair" | "security" | "preview" | "launch";
export interface ProjectDoctorFinding {
  id: string;
  severity: DoctorSeverity;
  title: string;
  explanation: string;
  location?: string;
  repairable: boolean;
}
export interface ProjectDoctorReport {
  projectStatus: string;
  inspectedFiles: number;
  blockers: number;
  warnings: number;
  state: "needs-build" | "needs-repair" | "review-source" | "review-preview";
  nextAction: DoctorAction;
  nextTitle: string;
  nextExplanation: string;
  findings: ProjectDoctorFinding[];
  checks: Array<{ label: string; result: "pass" | "fail" | "review"; detail: string }>;
  limitations: string;
}

const MAX_FINDINGS = 12;
const LOCATION = /^[\w.\-/()[\]@]+$/;
const defaultPlan: AppPlan = {
  appName: "Saved application",
  summary: "Audit only",
  pages: [],
  components: [],
  dataModel: [],
  features: [],
};
const LABELS: Record<string, { title: string; explanation: string }> = {
  "missing-preview": { title: "Preview file is missing", explanation: "The generated preview HTML is absent. A repair should regenerate it before claiming the preview works." },
  "missing-home-page": { title: "Application homepage is missing", explanation: "The expected Next.js route src/app/page.tsx is absent." },
  "missing-layout": { title: "Application layout is missing", explanation: "The Next.js app needs a root layout." },
  "missing-globals-css": { title: "Global stylesheet missing", explanation: "Check that the app styling is imported and visible in the real preview." },
  "missing-package-json": { title: "Package manifest missing", explanation: "Without package.json a standard package build cannot be verified." },
  "invalid-package-json": { title: "Package manifest is invalid", explanation: "The project's package.json is not valid JSON." },
  "missing-build-script": { title: "Build command missing", explanation: "A hosting provider usually needs a documented build script." },
  "missing-import": { title: "Code imports a missing local file", explanation: "The source references a local file that is not present in the saved project snapshot." },
  "undeclared-dependency": { title: "Dependency not declared", explanation: "A source file imports a package that package.json does not declare." },
  "broken-file": { title: "Source structure needs review", explanation: "Static checks found malformed or incomplete code." },
  "shallow-preview": { title: "Preview lacks a real workflow", explanation: "The preview is insufficient to demonstrate the app's intended functionality." },
  "placeholder-page": { title: "Generated page is a placeholder", explanation: "A route is too shallow to demonstrate the intended workflow." },
  "missing-api-route": { title: "API handler is missing", explanation: "A planned data operation lacks an API endpoint." },
  "missing-schema": { title: "Database schema is missing", explanation: "The recorded app plan includes saved data, but the schema is absent." },
  "missing-schema-table": { title: "Planned database table missing", explanation: "The schema needs review against the intended app workflow." },
  "missing-rls-policies": { title: "Private data needs access policies", explanation: "Database tables must enforce per-user permissions, not only login checks." },
  "ephemeral-data-layer": { title: "Data may disappear on restart", explanation: "The source appears to use process-memory arrays instead of persistent storage." },
  "platform-key-reference": { title: "Platform key referenced in generated app", explanation: "Generated customer code should never depend on the BuildRx platform's secret API key." },
  "public-secret-env": { title: "Secret exposed to browser configuration", explanation: "A NEXT_PUBLIC_ variable should never contain a private service credential." },
  "hardcoded-secret-key": { title: "Possible embedded secret", explanation: "Review the saved code securely and rotate any exposed credential before continuing." },
  "hardcoded-nvidia-key": { title: "Possible embedded provider key", explanation: "Review the saved code securely and rotate any exposed credential before continuing." },
  "hardcoded-jwt": { title: "Possible embedded token", explanation: "Review the saved code securely and revoke or rotate exposed tokens before continuing." },
  "eval-usage": { title: "Dynamic code execution", explanation: "Avoid dynamic evaluation of untrusted strings; use explicit logic." },
};

function safeLocation(input: string | undefined): string | undefined {
  return input && input.length <= 180 && LOCATION.test(input) ? input : undefined;
}

function staticFinding(f: CheckFinding): ProjectDoctorFinding {
  const mapped = LABELS[f.rule] ?? {
    title: "Source verification needs attention",
    explanation: "A deterministic build check reported an issue. Review the generated source before publishing.",
  };
  const secret = /secret|token|jwt|key-reference|public-secret/.test(f.rule);
  return {
    id: f.rule,
    title: mapped.title,
    explanation: mapped.explanation,
    severity: f.severity === "error" ? "blocker" : "warning",
    location: secret ? undefined : safeLocation(f.file),
    repairable: f.fix !== "none" && !secret,
  };
}

const sourceMatchesPlaceholder = (content: string) => {
  const body = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]+/g, "");
  return /(?:<h1[^>]*>\s*hello[\s-]?world\s*<\/h1>|welcome to next\.js|edit (?:src\/app\/page|app\/page)\.tsx to get started)/i.test(body);
};

export function auditSavedApp(files: GeneratedFile[], projectStatus: string): ProjectDoctorReport {
  const limitations = "Read-only static checks of saved files. No npm build, browser interactions, real deployment, login, database writes, external provider logs or live URL were tested. Repair requires an explicit owner action.";
  if (!files.length) {
    return {
      projectStatus, inspectedFiles: 0, blockers: 1, warnings: 0,
      state: "needs-build", nextAction: "build", nextTitle: "Create your first working build",
      nextExplanation: "No saved generated code was found. Describe the app's users and main workflow, then start the AI build.",
      findings: [{
        id: "empty-project", title: "No source files saved", explanation: "This workspace has no generated app files yet.",
        severity: "blocker", repairable: false,
      }],
      checks: [{ label: "Generated app source", result: "fail", detail: "No saved files found" }],
      limitations,
    };
  }
  const context: WorkflowContext = {
    projectId: "audit-only", userId: null, prompt: "", persist: false,
    files: new Map(files.map(file => [file.path, file])),
  };
  const rawChecks = runStaticChecks(context, defaultPlan);
  const findings = rawChecks.map(staticFinding);
  const home = files.find(f => f.path === "src/app/page.tsx");
  if (home && sourceMatchesPlaceholder(home.content)) {
    findings.unshift({
      id: "starter-placeholder", severity: "blocker", title: "Still showing Hello World or a starter page",
      explanation: "The actual saved homepage resembles a default starter instead of the finished app. Review the product brief and run a targeted repair.",
      location: "src/app/page.tsx", repairable: true,
    });
  }
  const security = scanDevShieldSource(files);
  if (!security.complete || security.status === "blocked") {
    findings.unshift({
      id: "security-preflight",
      severity: "blocker",
      title: security.complete ? "Security indicators need manual investigation" : "Security review could not finish",
      explanation: security.complete
        ? "The security preflight found high-risk indicators. Do not run untrusted code or publish it. Review safely and rotate exposed credentials if necessary."
        : "Not all saved source was eligible for the bounded security scan. No safety clearance was issued.",
      repairable: false,
    });
  } else if (security.status === "review") {
    findings.unshift({
      id: "security-review", severity: "warning",
      title: "Security preflight needs human review",
      explanation: "Static indicators were found. Review the flagged files before executing or deploying the app.",
      repairable: false,
    });
  }
  const blockers = findings.filter(f => f.severity === "blocker").length;
  const warnings = findings.length - blockers;
  const blockedBySecurity = findings.some(f => f.id === "security-preflight");
  const state: ProjectDoctorReport["state"] = blockedBySecurity ? "review-source" :
    blockers > 0 || projectStatus === "error" ? "needs-repair" : "review-preview";
  let nextAction: DoctorAction = "preview";
  let nextTitle = "Test the real app preview";
  let nextExplanation = "Static checks found no blocking issue, but you still need to test navigation, buttons, sign-in and data saving. Then follow What next? to publish.";
  if (blockedBySecurity) {
    nextAction = "security";
    nextTitle = "Review the security findings first";
    nextExplanation = "Don't automatically execute suspicious source. Inspect the code and environment settings before attempting repairs or hosting.";
  } else if (state === "needs-repair") {
    nextAction = "repair";
    nextTitle = "Review and repair the first blocker";
    nextExplanation = projectStatus === "error" && blockers === 0
      ? "The previous build did not complete. Open the repair pipeline to retry using the saved brief and files."
      : "Use the existing BuildRx repair agents to correct the diagnosed source issues, then scan again. No changes occur until you approve the repair run.";
  }
  const allFindings = findings.slice(0, MAX_FINDINGS);
  return {
    projectStatus, inspectedFiles: files.length, blockers, warnings, state, nextAction,
    nextTitle, nextExplanation, findings: allFindings,
    checks: [
      { label: "Saved app source", result: "pass", detail: files.length + " file(s) inspected" },
      { label: "Source structure & imports", result: rawChecks.some(f => f.severity === "error") ? "fail" : rawChecks.length ? "review" : "pass",
        detail: rawChecks.length ? rawChecks.length + " deterministic finding(s)" : "No supported static error signature detected" },
      { label: "Source security indicators", result: !security.complete || security.status === "blocked" ? "fail" : security.status === "review" ? "review" : "pass",
        detail: security.complete ? security.status.replaceAll("-", " ") : "Incomplete — not cleared" },
      { label: "Running app behavior", result: "review", detail: "Requires preview and human workflow tests" },
      { label: "Public deployment", result: "review", detail: "Check What next? for GitHub, host and live verification" },
    ],
    limitations,
  };
}
