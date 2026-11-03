/**
 * Prevent two build requests for the same project from colliding inside one
 * server process (for example, concurrent tabs or Chat + Build panel).
 *
 * This is deliberately only a process-local guard: multi-instance deployments
 * need a durable, atomic database lease before claiming global exclusivity.
 */
const active = new Map<string, symbol>();

export function acquireBuildLease(projectId: string, userId: string | null): (() => void) | null {
  const key = JSON.stringify([userId ?? "demo", projectId]);
  if (active.has(key)) return null;
  const token = Symbol("build-run");
  active.set(key, token);
  return () => {
    if (active.get(key) === token) active.delete(key);
  };
}
