import { isSafeFilePath } from "@/lib/agents/llm";
import { fileWithEmbeddedCredential } from "@/lib/deploy/source";
import { DeployError } from "@/lib/deploy/providers";

export interface SourceFile { path: string; content: string }

const ADAPTER = "@opennextjs/cloudflare@1.20.15";
const WRANGLER = "wrangler@4.156.1";

/**
 * Prepare a real Next.js source tree for Cloudflare Workers (not a static
 * HTML preview). Deploy still requires an authenticated Cloudflare account.
 */
export function prepareCloudflareSource(
  source: SourceFile[],
  name: string
): { workerName: string; files: SourceFile[] } {
  if (source.length < 3 || source.length > 500) {
    throw new DeployError("Generate a complete app (up to 500 files) before preparing Cloudflare.");
  }
  const reserved = new Set([
    "open-next.config.ts", "open-next.config.mjs",
    "wrangler.json", "wrangler.jsonc", "wrangler.toml",
    ".github/workflows/cloudflare-deploy.yml",
  ]);
  const paths = new Set<string>();
  let total = 0;
  for (const file of source) {
    if (!isSafeFilePath(file.path) || paths.has(file.path)) {
      throw new DeployError("Invalid or repeated generated project file.");
    }
    if (reserved.has(file.path)) {
      throw new DeployError(`Your project already defines ${file.path}. Review its Cloudflare setup before preparing to avoid overwriting it.`);
    }
    if (file.path.startsWith(".github/") || file.path.startsWith(".git/")) {
      throw new DeployError("Generated GitHub workflow files are not accepted for deployment.");
    }
    if (/(^|\/)(\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.npmrc|\.pnp\.cjs)$/i.test(file.path)) {
      throw new DeployError("Private configuration files cannot be uploaded for deployment.");
    }
    paths.add(file.path);
    total += Buffer.byteLength(file.content, "utf8");
  }
  if (total > 3_000_000) {
    throw new DeployError("Generated source is larger than the 3 MB preparation limit.");
  }
  const credentials = fileWithEmbeddedCredential(source);
  if (credentials) throw new DeployError(`Credential-like content found in ${credentials}. Remove it and use encrypted Cloudflare secrets.`);

  const packageFile = source.find(file => file.path === "package.json");
  if (!packageFile || !paths.has("src/app/page.tsx") || !paths.has("src/app/layout.tsx")) {
    throw new DeployError("A real Next.js App Router project is required. Build the app before preparing Workers.");
  }
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(packageFile.content) as Record<string, unknown>;
  } catch {
    throw new DeployError("Generated package.json is not valid JSON.");
  }
  if (!pkg || typeof pkg !== "object" || !pkg.dependencies ||
      typeof pkg.dependencies !== "object" ||
      typeof (pkg.dependencies as Record<string, unknown>).next !== "string") {
    throw new DeployError("This project is not a supported Next.js app. Cloudflare preparation was not performed.");
  }

  const originalScripts = pkg.scripts;
  if (originalScripts && (typeof originalScripts !== "object" || Array.isArray(originalScripts))) {
    throw new DeployError("Invalid scripts in generated package.json.");
  }
  const scripts = { ...((originalScripts ?? {}) as Record<string, string>) };
  for (const key of ["cloudflare:setup", "cloudflare:build", "cloudflare:publish"]) {
    if (Object.hasOwn(scripts, key)) {
      throw new DeployError(`Project already defines ${key}. Review before replacing Cloudflare commands.`);
    }
  }
  scripts["cloudflare:setup"] =
    `npm install --no-save --no-package-lock --no-audit --no-fund ${ADAPTER} ${WRANGLER}`;
  scripts["cloudflare:build"] = "npm run cloudflare:setup && npx opennextjs-cloudflare build";
  scripts["cloudflare:publish"] = "npx opennextjs-cloudflare deploy";
  const workerName = ("buildrx-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 48).replace(/-$/g, "")) || "buildrx-app";

  const wrangler = JSON.stringify({
    name: workerName,
    main: ".open-next/worker.js",
    compatibility_date: "2026-11-03",
    compatibility_flags: ["nodejs_compat"],
    assets: { directory: ".open-next/assets", binding: "ASSETS" },
    observability: { enabled: true },
  }, null, 2) + "\n";

  const workflow = [
    "name: Deploy on Cloudflare Workers",
    "on:",
    "  workflow_dispatch:",
    "permissions:",
    "  contents: read",
    "concurrency:",
    "  group: cloudflare-workers-production",
    "  cancel-in-progress: false",
    "jobs:",
    "  deploy:",
    "    runs-on: ubuntu-latest",
    "    environment: production",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: '22'",
    "          cache: npm",
    "      - name: Install project",
    "        run: |",
    "          if [ -f package-lock.json ]; then npm ci; else npm install; fi",
    "      - name: Check Cloudflare credentials",
    "        env:",
    "          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
    "          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    "        run: |",
    "          test -n \"$CLOUDFLARE_API_TOKEN\" || { echo 'Set the CLOUDFLARE_API_TOKEN Actions secret'; exit 1; }",
    "          test -n \"$CLOUDFLARE_ACCOUNT_ID\" || { echo 'Set the CLOUDFLARE_ACCOUNT_ID Actions secret'; exit 1; }",
    "      - name: Build and publish",
    "        env:",
    "          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
    "          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    "        run: |",
    "          npm run cloudflare:build",
    "          npm run cloudflare:publish",
    "",
  ].join("\n");

  const README = [
    "# Cloudflare Workers deployment",
    "",
    "BuildRx prepared this Next.js project for OpenNext on Cloudflare Workers.",
    "This preparation pushes source to GitHub; it does NOT prove the app is live.",
    "",
    "## Choose a deployment path",
    "",
    "1. **Cloudflare Workers Builds (recommended for automatic updates):** In the",
    "   Cloudflare dashboard open Workers & Pages, import the GitHub repository,",
    "   and set Build command to `npm run cloudflare:build` and",
    "   Deploy command to `npm run cloudflare:publish`. Set Node.js 22.",
    "   Connect the GitHub repository with your Cloudflare account first.",
    "2. **GitHub Actions (manual publish):** Add repository Actions secrets",
    "   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then run",
    "   Actions > Deploy on Cloudflare Workers > Run workflow.",
    "",
    "Never commit production secrets. Configure databases, auth callback URLs,",
    "and other runtime variables in Cloudflare Worker settings before live use.",
    "Use Workers logs and your application's end-to-end tests to verify",
    "login, database writes, payments, and any integration before opening traffic.",
    "The `*.workers.dev` hostname is only available after Cloudflare confirms",
    "a successful deployment. Do not assume a custom domain is configured.",
    "",
    "OpenNext is used for existing Next.js 15 applications. Cloudflare currently",
    "recommends vinext for new Next.js 16 projects; review compatibility before",
    "switching adapters.",
    "",
  ].join("\n");

  return {
    workerName,
    files: source.map(file => file.path === "package.json"
      ? { ...file, content: JSON.stringify({ ...pkg, scripts }, null, 2) + "\n" }
      : file).concat([
        { path: "open-next.config.ts", content: 'import { defineCloudflareConfig } from "@opennextjs/cloudflare";\nexport default defineCloudflareConfig();\n' },
        { path: "wrangler.jsonc", content: wrangler },
        { path: ".github/workflows/cloudflare-deploy.yml", content: workflow },
        { path: "CLOUDFLARE-DEPLOY.md", content: README },
      ]),
  };
}
