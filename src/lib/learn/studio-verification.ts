import type { TrainingTrackId } from "@/lib/learn/labs";

/**
 * Additive, reviewed verification files generated ONLY in the user's
 * downloaded ZIP. BuildRx never dispatches Actions runs or executes
 * student source on the BuildRx server.
 */
export const VERIFICATION_WORKFLOW_PATH = ".github/workflows/buildrx-training-verify.yml";
export const VERIFICATION_SCRIPT_PATH = "scripts/verify-training.mjs";
export const VERIFICATION_GUIDE_PATH = "VERIFICATION-GUIDE.md";

export type VerificationFiles = Readonly<Record<string, string>>;

export function trainingVerificationFiles(trackId: TrainingTrackId): VerificationFiles {
  if (trackId !== "fullstack-web" && trackId !== "software-engineering") return {};

  const isWeb = trackId === "fullstack-web";
  const command = isWeb ? "npm run build" : "npm test";
  const required = isWeb
    ? ["src/app/page.tsx", "src/app/layout.tsx", "src/app/globals.css"]
    : ["src/lib/issues.ts", "src/lib/issues.test.ts"];

  const workflow = `# Read-only training verification; no secrets, production deploy or elevated PR permission.
# This workflow runs code IN YOUR OWN GitHub repository after you choose to
# commit and review it. Never use pull_request_target for untrusted training PRs.
name: BuildRx training verification
on:
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 12
    env:
      CI: "true"
      NEXT_TELEMETRY_DISABLED: "1"
    steps:
      - name: Check out reviewed source
        uses: actions/checkout@v4
        with:
          persist-credentials: false
      - name: Use Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: "22"
      - name: Inspect training package structure
        run: node scripts/verify-training.mjs
      - name: Install reviewed dependencies without lifecycle scripts
        run: npm install --ignore-scripts --no-audit --no-fund
      - name: TypeScript checks
        run: npm run typecheck
      - name: ${isWeb ? "Compile Next.js learning app" : "Run Vitest training unit tests"}
        run: ${command}
`;

  const script = `// Generated BuildRx training structure check (read-only).
// Does not compile or evaluate source, execute packages or contact servers.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const required = ${JSON.stringify(["package.json", "tsconfig.json", ...required])};
let failure = false;
for (const path of required) {
  if (!existsSync(resolve(process.cwd(), path))) {
    console.error("MISSING REQUIRED FILE: " + path);
    failure = true;
  } else {
    console.log("FOUND: " + path);
  }
}
if (existsSync("package.json")) {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    for (const script of ["typecheck", ${JSON.stringify(isWeb ? "build" : "test")}]) {
      if (typeof pkg.scripts?.[script] !== "string") {
        console.error("MISSING SCRIPT: npm run " + script);
        failure = true;
      }
    }
  } catch {
    console.error("package.json is not valid JSON.");
    failure = true;
  }
}
if (failure) process.exitCode = 1;
else console.log("Training structure check passed. Source has NOT been compiled or tested yet.");
`;

  const guide = `# BuildRx Training Verification — ${isWeb ? "Next.js web" : "TypeScript/Vitest"} starter

> This ZIP includes a **proposed CI workflow** but BuildRx has not run it.
> GitHub Actions runs only after YOU put the files in your OWN repository
> and open a pull request or manually start workflow_dispatch (available
> after this workflow is on the repository default branch).

## Start safely

1. Review the source code and \`package.json\`; remove secrets and unwanted packages.
2. Verify Node.js 22 or a currently supported compatible release is installed.
3. In the extracted training folder, run \`node scripts/verify-training.mjs\`.
4. Review dependencies, then run \`npm install --ignore-scripts --no-audit --no-fund\`.
5. Run \`npm run typecheck\`, then \`${command}\`.
6. Fix the **first actual failing step**; rerun checks. A passing build is not a live-app test.
7. If you decide to use GitHub, push the complete training folder to your own repository and open a pull request.
8. Under Actions, inspect **BuildRx training verification** and confirm it tested the intended commit SHA.
9. Verify actual user workflows, identity isolation, database writes and the public URL separately before any real launch.

## Security & rollback

- GitHub Actions has only \`contents: read\` and never uses \`pull_request_target\`.
- The job has a 12-minute timeout. Install lifecycle scripts are disabled during dependency installation.
- This is a *training* workflow; code run by scripts/build steps still executes on GitHub-hosted runners and may make network requests. Review it before committing.
- No BuildRx API keys, customer information, deployment keys or hosting credentials are required.
- CI does not automatically push, merge, bill external providers, deploy to production, or issue certificates.
- If checks fail, preserve the logs without secrets and revert the smallest bad commit or change.
- If GitHub Actions is restricted or disabled, run the same commands locally instead.

## Do not confuse build with release

A green Actions check only confirms the listed commands completed at a particular SHA. It does NOT prove an app has a working API, real data persistence, secure RLS, a deployed Worker, or an installable Expo application.
`;

  return {
    [VERIFICATION_WORKFLOW_PATH]: workflow,
    [VERIFICATION_SCRIPT_PATH]: script,
    [VERIFICATION_GUIDE_PATH]: guide,
  };
}
