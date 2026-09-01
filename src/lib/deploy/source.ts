/** Local env files are never deployment source; the example contract is safe. */
export function isDeploymentSourcePath(path: string): boolean {
  if (path.startsWith("preview/")) return false;
  if (path === ".env.example") return true;
  return !/(^|\/)\.env(?:\..*)?$/.test(path);
}

const CREDENTIAL_PATTERNS = [
  /nvapi-[A-Za-z0-9_-]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[A-Z0-9]{16}/,
  /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /mongodb(?:\+srv)?:\/\/[^\s:/]+:[^\s@/]+@/i,
];

/** Returns only the path; credential-like content is never echoed. */
export function fileWithEmbeddedCredential(
  files: Array<{ path: string; content: string }>
): string | null {
  return (
    files.find((file) =>
      CREDENTIAL_PATTERNS.some((pattern) => pattern.test(file.content))
    )?.path ?? null
  );
}
