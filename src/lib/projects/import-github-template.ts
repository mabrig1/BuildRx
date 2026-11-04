import { Buffer } from "node:buffer";

import { fileWithEmbeddedCredential, isDeploymentSourcePath } from "@/lib/deploy/source";
import { isSafeFilePath } from "@/lib/agents/llm";
import type { GithubAppTemplate } from "@/lib/projects/github-app-templates";

/**
 * Fetch a FIXED, reviewed public GitHub repository subdirectory as editable
 * text project files. This never runs imported scripts or checks out code on
 * the BuildRx server. The source commit is pinned by the server-side catalog.
 */
const GITHUB_API = "https://api.github.com";
const MAX_SOURCE_FILES = 140;
const MAX_SINGLE_FILE_BYTES = 90_000;
const MAX_TOTAL_BYTES = 1_500_000;
const ALLOWED_EXTENSIONS = /\.(?:ts|tsx|js|jsx|mjs|cjs|json|css|scss|html|md|mdx|txt|svg|yml|yaml|toml|graphql|gql)$/i;

type TreeItem = {
  path: string;
  type: "blob" | "tree" | string;
  sha: string;
  size?: number;
};

export type GithubImportedFile = { path: string; content: string };
export type GithubImportedProject = {
  files: GithubImportedFile[];
  skippedBinary: number;
  sourceUrl: string;
};

export class GithubTemplateImportError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
    this.name = "GithubTemplateImportError";
  }
}

function validateSourceRef(template: GithubAppTemplate) {
  if (template.repository !== "vercel/next.js" ||
      !/^[a-f0-9]{40}$/.test(template.commit) ||
      !/^examples\/[a-z0-9-]+$/.test(template.subdirectory) ||
      template.license !== "MIT") {
    throw new GithubTemplateImportError("This template is not approved for import.");
  }
}

export function isAllowedGithubTemplateFile(path: string): boolean {
  if (!isSafeFilePath(path) || !isDeploymentSourcePath(path)) return false;
  if (/(^|\/)(?:\.github|\.git|\.vercel|\.next|node_modules|\.turbo|coverage)(?:\/|$)/i.test(path)) return false;
  if (/\.(?:lock|map|min\.js)$/i.test(path)) return false;
  // Binary assets cannot be represented in the editable text file system.
  if (path === ".gitignore" || path === ".env.example" ||
      path === ".prettierrc" || path === ".eslintrc" ||
      path === ".prettierrc.json") return true;
  return ALLOWED_EXTENSIONS.test(path);
}

async function githubGet<T>(endpoint: string): Promise<T> {
  const token = process.env.GITHUB_TEMPLATE_READ_TOKEN;
  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "force-cache", // Source paths contain an immutable Git commit.
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 403 || response.status === 429) {
    throw new GithubTemplateImportError(
      "GitHub temporarily limited template downloads. Please try again later.", 503
    );
  }
  if (!response.ok) {
    throw new GithubTemplateImportError(
      "The upstream GitHub template cannot be retrieved safely at the moment.", 502
    );
  }
  return (await response.json()) as T;
}

async function gitTree(repository: string, sha: string, recursive = false) {
  return githubGet<{tree: TreeItem[]; truncated: boolean}>(
    `/repos/${repository}/git/trees/${sha}${recursive ? "?recursive=1" : ""}`
  );
}

async function readGitBlob(repository: string, sha: string): Promise<Buffer> {
  const result = await githubGet<{ encoding: string; content: string; size?: number }>(
    `/repos/${repository}/git/blobs/${sha}`
  );
  if (result.encoding !== "base64") {
    throw new GithubTemplateImportError("GitHub returned an unsupported template file.");
  }
  const bytes = Buffer.from(result.content.replace(/\s/g, ""), "base64");
  if (bytes.byteLength > MAX_SINGLE_FILE_BYTES) {
    throw new GithubTemplateImportError("A template file exceeded the import safety limit.");
  }
  if (bytes.includes(0) || Buffer.from(bytes.toString("utf8"), "utf8").compare(bytes) !== 0) {
    throw new GithubTemplateImportError("A template file was binary or not UTF-8.");
  }
  return bytes;
}

export function validateImportedGithubFiles(files: GithubImportedFile[]) {
  const names = new Set(files.map((file) => file.path));
  if (!names.has("package.json") ||
      !(names.has("src/app/page.tsx") || names.has("app/page.tsx")) ||
      !(names.has("src/app/layout.tsx") || names.has("app/layout.tsx"))) {
    throw new GithubTemplateImportError(
      "The selected GitHub example is not a complete supported Next.js App Router project."
    );
  }
  const pkgFile = files.find((file) => file.path === "package.json")!;
  let pkg: { dependencies?: Record<string, unknown>; scripts?: Record<string, unknown> };
  try {
    pkg = JSON.parse(pkgFile.content);
  } catch {
    throw new GithubTemplateImportError("The GitHub template has an invalid package.json.");
  }
  if (!pkg.dependencies || typeof pkg.dependencies.next !== "string") {
    throw new GithubTemplateImportError("The GitHub template is not a Next.js project.");
  }
  for (const dangerous of ["preinstall", "install", "postinstall", "prepare", "prepack", "postpack"]) {
    if (pkg.scripts && Object.hasOwn(pkg.scripts, dangerous)) {
      throw new GithubTemplateImportError(
        "The template requires installation hooks, so it cannot be cloned automatically."
      );
    }
  }
  const leaked = fileWithEmbeddedCredential(files);
  if (leaked) {
    throw new GithubTemplateImportError(
      `Potential credential found in ${leaked}. This template is not safe to import.`
    );
  }
}

export async function importGithubTemplateSource(
  template: GithubAppTemplate
): Promise<GithubImportedProject> {
  validateSourceRef(template);

  let subtreeSha = template.commit;
  for (const part of template.subdirectory.split("/")) {
    const parent = await gitTree(template.repository, subtreeSha);
    if (parent.truncated) throw new GithubTemplateImportError("Template directory listing was truncated.");
    const child = parent.tree.find((item) => item.path === part && item.type === "tree");
    if (!child || !/^[0-9a-f]{40}$/.test(child.sha)) {
      throw new GithubTemplateImportError("This GitHub starter folder is no longer available.");
    }
    subtreeSha = child.sha;
  }

  const tree = await gitTree(template.repository, subtreeSha, true);
  if (tree.truncated) throw new GithubTemplateImportError("Template listing is incomplete.");
  const blobs = tree.tree.filter((entry) => entry.type === "blob");
  if (blobs.length > 300) throw new GithubTemplateImportError("This template is too large for one-click import.");
  const allowed = blobs.filter((entry) => isAllowedGithubTemplateFile(entry.path));
  if (allowed.length < 3 || allowed.length > MAX_SOURCE_FILES) {
    throw new GithubTemplateImportError("This template has too many or too few editable files.");
  }
  const skippedBinary = blobs.length - allowed.length;
  if (allowed.some((entry) =>
    typeof entry.size !== "number" || entry.size > MAX_SINGLE_FILE_BYTES)) {
    throw new GithubTemplateImportError(
      "The GitHub template has source files exceeding the editable-file limit."
    );
  }
  const totalBytes = allowed.reduce((total, item) => total + (item.size ?? 0), 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new GithubTemplateImportError("The GitHub template exceeds the safe source import limit.");
  }

  // Four simultaneous requests avoid stressing the public GitHub API.
  const files: GithubImportedFile[] = [];
  for (let i = 0; i < allowed.length; i += 4) {
    const batch = allowed.slice(i, i + 4);
    const imported = await Promise.all(batch.map(async (entry) => ({
      path: entry.path,
      content: (await readGitBlob(template.repository, entry.sha)).toString("utf8"),
    })));
    files.push(...imported);
  }

  // The parent repository's MIT license governs these examples. Keep the
  // complete original notice with every cloned project for attribution.
  const licenseContents = await githubGet<{ encoding: string; content: string }>(
    `/repos/${template.repository}/contents/license.md?ref=${template.commit}`
  );
  if (licenseContents.encoding !== "base64") {
    throw new GithubTemplateImportError("Could not verify the GitHub source license.");
  }
  const license = Buffer.from(licenseContents.content.replace(/\s/g, ""), "base64").toString("utf8");
  if (!/The MIT License \(MIT\)/.test(license)) {
    throw new GithubTemplateImportError("The upstream MIT license could not be verified.");
  }
  if (!files.some((file) => /^license(?:\.[a-z]+)?$/i.test(file.path))) {
    files.push({ path: "LICENSE", content: license });
  }
  files.push({
    path: "BUILD-RX-SOURCE.md",
    content: [
      "# GitHub template attribution",
      "",
      `Imported from: ${template.sourceUrl}`,
      `Repository: ${template.repository}`,
      `Snapshot commit: ${template.commit}`,
      `License: ${template.license} (see LICENSE)`,
      "",
      "This is an original third-party example imported as editable code.",
      "No external credentials, databases, payments, or hosting were connected.",
      "Review dependencies, authentication, assets, and build checks before publishing.",
      "Binary assets are not imported by the current BuildRx text-only editor.",
      template.setupNote,
      "",
    ].join("\n"),
  });
  validateImportedGithubFiles(files);
  return { files, skippedBinary, sourceUrl: template.sourceUrl };
}
