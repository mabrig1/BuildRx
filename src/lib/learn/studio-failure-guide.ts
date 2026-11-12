/**
 * Read-only, offline, beginner diagnostics for truncated build output.
 * Neither the input nor derived result is sent to a server or model.
 * Patterns suggest a FIRST INVESTIGATION, not a confirmed root cause.
 */
export const MAX_DIAGNOSTIC_LOG = 12_000;

export type StudioFailureAdvice = {
  code: string;
  title: string;
  likelyCause: string;
  steps: readonly string[];
  note: string;
  recognized: boolean;
  sensitive: boolean;
};

type Rule = {
  code: string;
  pattern: RegExp;
  title: string;
  likelyCause: string;
  steps: readonly string[];
  note: string;
};

const RULES: readonly Rule[] = [
  {
    code: "npm-arborist-edgesout",
    pattern: /(?:Cannot read properties of null.*edgesOut|arborist.*edgesOut)/i,
    title: "npm dependency resolution crashed",
    likelyCause: "Some npm 10 versions can crash while resolving Vitest/Vite peer dependencies. This error happens before application tests begin.",
    steps: [
      "Confirm the failed command is npm install and check npm --version.",
      "If using npm 10 on a supported Node release, retry with npm 11.6 or later (for example npm@11.19.1).",
      "Reinstall dependencies inside an isolated development folder and check the first new error.",
      "Keep the reviewed lockfile when one is available; do not hide peer conflicts with --force or blind --legacy-peer-deps.",
    ],
    note: "This points to npm's dependency tree, not proof that your React or TypeScript code is broken.",
  },
  {
    code: "npm-peer-conflict",
    pattern: /(?:npm ERR! ERESOLVE|npm error ERESOLVE|unable to resolve dependency tree|Conflicting peer dependency)/i,
    title: "Conflicting package versions",
    likelyCause: "Two dependencies may request incompatible peer dependency versions.",
    steps: [
      "Find the first named pair of incompatible packages in the install log.",
      "Compare package.json and the lockfile from the same commit.",
      "Choose a documented compatible version pair in a separate branch.",
      "Regenerate the lockfile intentionally and rerun the tests and build.",
    ],
    note: "Avoid --force or --legacy-peer-deps unless you have reviewed the specific peer conflict and its consequences.",
  },
  {
    code: "missing-package-json",
    pattern: /(?:ENOENT[^\n]{0,160}package\.json|Could not read package\.json|Missing script: "(?:dev|build|test)")/i,
    title: "The command is running in the wrong project folder or the package is incomplete",
    likelyCause: "npm cannot find the expected package manifest or script.",
    steps: [
      "Check the terminal's current folder and list its files.",
      "Open the extracted Project Studio ZIP, not the BuildRx builder repository.",
      "For web/TypeScript ZIPs, confirm package.json exists beside the src folder.",
      "Run npm install first and then use one of the scripts actually listed in package.json.",
    ],
    note: "The Expo export is a source overlay, not a standalone npm package. Create a real Expo project first.",
  },
  {
    code: "missing-module",
    pattern: /(?:TS2307|Module not found: Can't resolve|Cannot find module|ERR_MODULE_NOT_FOUND)/i,
    title: "A file or dependency cannot be resolved",
    likelyCause: "The compiler cannot locate an import, often because a source path, filename case or package differs from the project.",
    steps: [
      "Inspect the exact missing import and the file that references it.",
      "Check filename capitalization, relative paths and whether the file exists.",
      "If it is a third-party package, verify it is explicitly listed in package.json and compatible with your framework.",
      "Run npm install from the correct project root, then typecheck again.",
    ],
    note: "Do not install an arbitrary package solely because a model guessed its name.",
  },
  {
    code: "typescript-error",
    pattern: /(?:error TS\d{4}|Type error:|Type '\w+' is not assignable|Property '\w+' does not exist on type)/i,
    title: "TypeScript found a source-code or typing mismatch",
    likelyCause: "A specific file may be using a value, import, or property with the wrong type.",
    steps: [
      "Locate the first TypeScript error and read its filename and line number.",
      "Inspect the real type definition and the code at that line.",
      "Make the smallest code correction, rather than turning off strict checks.",
      "Run npm run typecheck, unit tests, and a production build on the same commit.",
    ],
    note: "A TypeScript fix is not proof that API calls, authentication or stored data work.",
  },
  {
    code: "next-missing-build",
    pattern: /(?:Could not find a production build in the '\.next' directory|Production build not found|ENOENT.*\.next)/i,
    title: "Next.js production output has not been built",
    likelyCause: "The start command expects compiled .next output that was not generated in this project folder.",
    steps: [
      "Confirm this is a complete Next.js project, not an HTML-only UI preview.",
      "Run npm install, then npm run build in the project root.",
      "Read and fix the first build error if compilation fails.",
      "Run npm run start only after the production build succeeds.",
    ],
    note: "A successful Next.js build still does not validate database and login functionality.",
  },
  {
    code: "cloudflare-build",
    pattern: /(?:wrangler\.jsonc|wrangler deploy|Could not resolve.*workerd|nodejs_compat|Cloudflare Workers.*error)/i,
    title: "Cloudflare build or Worker configuration needs investigation",
    likelyCause: "The Worker build may be missing a required configuration, compatible adapter, or Node compatibility setting.",
    steps: [
      "Confirm the GitHub source repository and branch belong to the generated app, not BuildRx itself.",
      "Find the first Cloudflare or wrangler error; separate repository code from dashboard variables and secrets.",
      "Compare the project framework and adapter with current official Cloudflare Next.js instructions.",
      "Check the configuration in a nonproduction branch and run a dry-run/build before publishing.",
    ],
    note: "Cloudflare preparation or a green GitHub check does not mean a deployed Worker was functionally tested.",
  },
  {
    code: "preview-not-found",
    pattern: /(?:preview returned HTTP 404|Preview renders.*404|404 NOT_FOUND|GET \/api\/preview\/[^\s]+.*404)/i,
    title: "Preview endpoint returned 404",
    likelyCause: "The URL may be wrong, the requested preview may be private, or the deployment may not contain the latest generated snapshot.",
    steps: [
      "Check whether the preview is opened from the signed-in owner session.",
      "Confirm the project's preview file and exact project ID are saved.",
      "Inspect the route and deployed commit; do not assume the repository was never generated.",
      "Use a read-only diagnostic or a controlled preview repair before changing hosting credentials.",
    ],
    note: "An HTTP 404 on a private preview does not by itself establish that the app's source is missing.",
  },
  {
    code: "placeholder",
    pattern: /(?:^|\n)\s*Hello world\s*(?:\n|$)/i,
    title: "The displayed page still contains the starter placeholder",
    likelyCause: "The active deployment may be serving an old app route, wrong repository/root, or a placeholder page.",
    steps: [
      "Open the exact route and compare it with the actual generated app source.",
      "Verify which GitHub repository, branch and commit the hosting provider built.",
      "Confirm the hosting project's root directory points to the generated app.",
      "Look at the last successful deployment and compare its source commit before making a reversible change.",
    ],
    note: "This is an investigation checklist, not proof of a specific Vercel or Cloudflare configuration failure.",
  },
];

const SECRET_PATTERNS = [
  /(?:mongodb(?:\+srv)?:\/\/[^\s]+)/i,
  /(?:postgres(?:ql)?:\/\/[^\s]+)/i,
  /(?:github_pat_|ghp_|ghs_|sk-[a-z0-9_-]{8,}|nvapi-[a-z0-9_-]{8,})/i,
  /(?:Authorization:\s*Bearer\s+[^\s]+)/i,
  /(?:PRIVATE KEY-----)/i,
  /(?:api[_-]?key|client[_-]?secret|password|access[_-]?token)\s*[:=]\s*["']?\S{8,}/i,
];

export function containsStudioLogSecret(log: string): boolean {
  return SECRET_PATTERNS.some(pattern => pattern.test(log));
}

export function diagnoseStudioLog(input: string): StudioFailureAdvice {
  if (!input.trim()) return {
    code: "empty", title: "Paste a build error to begin",
    likelyCause: "This guide works entirely in your browser and does not open your GitHub or cloud account.",
    steps: ["Copy the first failed command and the lines around its earliest actionable error.", "Remove passwords, tokens, private URLs and customer information before pasting."],
    note: "No log text is stored, transmitted or used to run commands.", recognized: false, sensitive: false,
  };
  if (containsStudioLogSecret(input)) return {
    code: "sensitive", title: "Possible secret detected — clear this log",
    likelyCause: "The text may contain a credential or database connection string.",
    steps: [
      "Clear the pasted log and remove credentials at the source.",
      "If you exposed a real token in a shared log, revoke or rotate it using the provider's security controls.",
      "Copy only the first failing step and sanitized error message, then try again.",
    ],
    note: "The raw text is not echoed or sent anywhere by this diagnostic tool.",
    recognized: false, sensitive: true,
  };
  const log = input.slice(0, MAX_DIAGNOSTIC_LOG);
  for (const rule of RULES) {
    if (rule.pattern.test(log)) {
      return { ...rule, recognized: true, sensitive: false };
    }
  }
  return {
    code: "unknown",
    title: "The first blocker is not yet identified",
    likelyCause: "The pasted text did not match a known failure category. Generic status messages alone are not enough to confirm a root cause.",
    steps: [
      "Open the failed GitHub Action, Vercel deployment, or Cloudflare build.",
      "Identify the first failed step and its earliest exact error line.",
      "Compare the failed commit with the last passing one.",
      "Classify repository code, external configuration and provider/secrets issues separately.",
      "Make the smallest reversible correction and repeat the same checks.",
    ],
    note: "This guide does not make changes, and it will not guess at deployment status.",
    recognized: false, sensitive: false,
  };
}
