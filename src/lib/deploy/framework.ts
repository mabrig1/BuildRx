/**
 * Detects which framework a generated project uses from its
 * package.json, so deployToVercel can tell Vercel to actually build
 * the app (framework-aware) instead of serving it as a static site.
 * Pure — no network/filesystem access.
 */

export interface DeployFile {
  path: string;
  content: string;
}

/** Vercel's `projectSettings.framework` id — see https://vercel.com/docs/deployments/configure-a-build#framework-preset. `null` means "static, no build". */
export type VercelFrameworkId = "nextjs" | null;

export function detectFramework(files: DeployFile[]): VercelFrameworkId {
  const packageJson = files.find((file) => file.path === "package.json");
  if (!packageJson) return null;

  let parsed: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    parsed = JSON.parse(packageJson.content);
  } catch {
    return null;
  }

  const hasNext = Boolean(parsed.dependencies?.next ?? parsed.devDependencies?.next);
  return hasNext ? "nextjs" : null;
}
