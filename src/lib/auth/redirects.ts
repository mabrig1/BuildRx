/**
 * Only allow same-origin relative paths as post-auth redirect targets.
 *
 * Rejects absolute URLs, protocol-relative URLs (`//host`), and
 * backslash variants (`/\host` — browsers normalize `\` to `/`, which
 * would turn it into a protocol-relative redirect).
 */
export function sanitizeNextPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return "/dashboard";
  }
  return next;
}
