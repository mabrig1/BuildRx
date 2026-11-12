/**
 * Deterministic, client-side Build Doctor. It never fetches private projects,
 * executes code, requests credentials, uploads logs or calls an AI provider.
 * Recommendations are hypotheses grounded only in the text the learner pastes.
 */
export type BuildFailureArea =
  | "TypeScript" | "Dependencies" | "Tests" | "Build"
  | "Preview" | "Cloudflare" | "Configuration" | "Unknown";

export interface BuildDoctorResult {
  area: BuildFailureArea;
  title: string;
  confidence: "evidence in pasted log" | "possible only";
  firstRelevantLine: string | null;
  why: string;
  nextSteps: string[];
  limitation: string;
}

export const BUILD_DOCTOR_MAX_CHARS = 12_000;

const genericSteps = [
  "Identify the exact failed repository, branch, commit SHA and first red step.",
  "Open the failing job logs (or hosting build logs) and copy the first actionable error, excluding credentials.",
  "Fix only that first error in a new reversible commit, then rerun the same check.",
  "Do not merge or deploy until the real build, runtime and user workflows are verified.",
];

type DoctorRule = {
  area: BuildFailureArea;
  title: string;
  pattern: RegExp;
  why: string;
  steps: string[];
};

const RULES: DoctorRule[] = [
  {
    area: "Dependencies",
    title: "npm ci cannot find a matching lockfile",
    pattern: /(?:npm ci.*(?:lockfile|package-lock)|(?:npm ERR!|npm error).*npm ci.*(?:lockfile|package-lock)|npm ci.*can only install packages)/i,
    why: "The log indicates an npm ci / lockfile requirement, not a confirmed hosting outage.",
    steps: [
      "Confirm package.json exists and that npm ci is the failing command.",
      "In a reviewed local training folder, run npm install to generate a lockfile, then inspect changes.",
      "Commit package-lock.json alongside package.json; rerun npm ci on the same branch.",
      "Keep installation scripts and dependencies under review before enabling deployments.",
    ],
  },
  {
    area: "TypeScript",
    title: "TypeScript compilation or typing error",
    pattern: /\berror TS\d{4}:|\bTS\d{4}:|Type '.*' is not assignable to type/i,
    why: "A TypeScript error line in the pasted log is a repository source/type problem unless further evidence says otherwise.",
    steps: [
      "Open the path, line number and TS error code shown in the first TypeScript diagnostic.",
      "Correct the reported type, import or interface without weakening checks globally.",
      "Run npm run typecheck locally and add a small regression test where appropriate.",
      "Verify CI on the exact patched commit before reviewing deployment logs.",
    ],
  },
  {
    area: "Dependencies",
    title: "Import or dependency is not available",
    pattern: /Module not found:|Cannot find module|ERR_MODULE_NOT_FOUND|Can't resolve ['"]/i,
    why: "The referenced module or local file is not resolving in this build environment.",
    steps: [
      "Find the first missing module path and the importing file in the log.",
      "Confirm filename case, relative path and dependency declaration in package.json.",
      "Avoid blind upgrades. Install only a reviewed missing dependency or fix the path.",
      "Run npm run typecheck and npm run build before attempting any release.",
    ],
  },
  {
    area: "Tests",
    title: "Vitest mock initialization failure",
    pattern: /Cannot access ['"][^'"]+['"] before initialization|vi\.hoisted|error when mocking a module/i,
    why: "The test output suggests a hoisted mock or initialization-order issue.",
    steps: [
      "Inspect the first failing test file, especially vi.mock factories and top-level variables.",
      "Initialize shared mock state with vi.hoisted where appropriate or restructure the module mock.",
      "Run just the failing test, then the complete test suite.",
      "Do not change production service configuration to address a test-only initialization failure.",
    ],
  },
  {
    area: "Tests",
    title: "A test assertion failed",
    pattern: /AssertionError:|expect\(.*\).*to(Equal|Be|Contain)|Tests\s+\d+ failed/i,
    why: "An assertion in the test suite failed; this does not alone prove the application is unavailable.",
    steps: [
      "Read the first failed test name, expected value, actual value and code location.",
      "Decide whether product behavior or the test's expectation is wrong using the acceptance criteria.",
      "Make the smallest reviewed correction and rerun that test plus the full suite.",
      "Keep failing tests as a release gate; do not delete them merely to make CI green.",
    ],
  },
  {
    area: "Cloudflare",
    title: "Cloudflare Wrangler or Worker build issue",
    pattern: /wrangler.*(?:error|failed|not found)|No wrangler configuration|wrangler\.jsonc.*(?:missing|not found)|Workers Builds.*failed/i,
    why: "The log points at a Cloudflare Worker configuration or build command; that is distinct from Vercel deployment.",
    steps: [
      "Check the Worker project's root directory and the actual wrangler.jsonc / wrangler.toml path.",
      "Check runtime compatibility and the first reported Cloudflare build error.",
      "Test a non-deploying Wrangler validation or dry run on the branch when supported.",
      "Confirm required secrets separately in Cloudflare settings without copying their values into a log.",
      "After an authorized deployment, test the real Worker URL and user workflows.",
    ],
  },
  {
    area: "Configuration",
    title: "A required environment setting is missing",
    pattern: /(?:missing|required|undefined|not set).{0,70}(?:environment variable|ENV|API_KEY|DATABASE_URL|MONGODB_URI|SUPABASE_URL)|(?:ENV|DATABASE_URL|MONGODB_URI|SUPABASE_URL).{0,70}(?:missing|required|undefined|not set)/i,
    why: "A configuration name is reported as absent. This does not reveal whether the actual value is correct.",
    steps: [
      "Record the required VARIABLE NAME only, not its value.",
      "Compare the variable name and environment scope (preview versus production) with the app's documented requirements.",
      "Ask an authorized owner to configure the value using the host's encrypted environment settings.",
      "Rerun the build and separately test the actual service connection without exposing credentials.",
    ],
  },
  {
    area: "Preview",
    title: "A preview route could not be found",
    pattern: /\b404\b.{0,100}(?:preview|not found)|(?:preview|deploy).{0,100}\b404\b|Hello[ -]?world/i,
    why: "A 404 or starter 'Hello World' screen can mean a wrong route, wrong deployment source, stale commit or preview access issue; the log alone does not establish which.",
    steps: [
      "Compare the deployed project name, repository, branch, commit SHA and root directory with the generated app's actual files.",
      "Check the route in the source and whether the preview requires an authenticated owner session.",
      "Inspect the hosting provider's deployment logs and served URL before making code changes.",
      "Verify the real app route and its data operations; avoid assuming a green deployment means a working application.",
    ],
  },
  {
    area: "Build",
    title: "Application build failed",
    pattern: /(?:Build failed|Failed to compile|next build.*failed|Build error|Error occurred prerendering)/i,
    why: "The pasted text reports a build failure, but may omit the underlying error that caused it.",
    steps: [
      "Scroll earlier in the same build log to find the FIRST specific TypeScript, import or runtime error.",
      "Run npm run typecheck and npm run build on the same commit locally.",
      "Change only the implicated file or configuration and record a rollback commit.",
      "After a green build, independently check deployed routes and any server-side operations.",
    ],
  },
];

function redactSensitiveLine(line: string): string {
  return line
    .replace(/mongodb(?:\+srv)?:\/\/[^\s'"]+/gi, "[REDACTED MONGODB URI]")
    .replace(/\b(?:github_pat_|gh[opsur]_|sk-|nvapi-)[a-zA-Z0-9_\-]{8,}\b/g, "[REDACTED TOKEN]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:password|secret|token|api[_-]?key)\b\s*[:=]\s*["']?[^\s'"]+/gi, "[REDACTED SETTING]");
}

function cleanLog(raw: string): string[] {
  return raw.slice(0, BUILD_DOCTOR_MAX_CHARS)
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")
    .split(/\r?\n/)
    .map(line => redactSensitiveLine(line.trim()).slice(0, 350))
    .filter(Boolean);
}

function firstErrorLikeLine(lines: string[]): string | null {
  return lines.find(line => /\b(?:error TS\d+|AssertionError|Module not found|Cannot find module|missing|required|failure|failed|404|Hello[ -]?world)\b/i.test(line)) ?? null;
}

export function diagnoseBuildLog(raw: string): BuildDoctorResult {
  const lines = cleanLog(raw);
  for (const rule of RULES) {
    const matchLine = lines.find(line => rule.pattern.test(line));
    if (!matchLine) continue;
    return {
      area: rule.area,
      title: rule.title,
      confidence: "evidence in pasted log",
      firstRelevantLine: matchLine,
      why: rule.why,
      nextSteps: rule.steps,
      limitation: "This is deterministic guidance based only on the pasted excerpt. It has not inspected your repository, checked hosting services, or applied a fix.",
    };
  }
  return {
    area: "Unknown",
    title: "Not enough evidence to confirm the first blocker",
    confidence: "possible only",
    firstRelevantLine: firstErrorLikeLine(lines),
    why: lines.length
      ? "No supported failure signature was identified in the pasted excerpt."
      : "No build output was provided.",
    nextSteps: genericSteps,
    limitation: "Do not infer production or hosting status from an incomplete log. This tool stays in your browser and does not change any system.",
  };
}
