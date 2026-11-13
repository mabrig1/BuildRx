/**
 * Example dynamic dispatch Worker for an operator-managed Workers for Platforms
 * account. This is a **standalone platform Worker**, NOT an active route.
 *
 * No routing record is created by BuildRx yet. A trusted release promotion
 * service must publish verified, live-only route records after HTTPS smoke tests.
 * This Worker never takes a caller-supplied worker name or Forwarded-Host.
 */
export interface DispatchRoute {
  workerName: string;
  status: "live" | "staging" | "disabled";
  releaseId: string;
}

export interface DispatchEnv {
  APP_BASE_DOMAIN: string;
  APP_ROUTES: {
    get(key: string, options: { type: "json" }): Promise<unknown>;
  };
  TENANT_WORKERS: {
    get(workerName: string): { fetch(request: Request): Promise<Response> };
  };
}

function fail(status: number, message: string): Response {
  return new Response(message, {
    status, headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const WORKER = /^brx-[a-f0-9]{36}$/;
const RELEASE = /^[a-f0-9]{64}$/;
const DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/;

function hostnameFor(request: Request, base: string): string | null {
  if (!DOMAIN.test(base) || base.length > 200) return null;
  try {
    const u = new URL(request.url);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    const suffix = "." + base;
    if (!host.endsWith(suffix)) return null;
    const subdomain = host.slice(0, -suffix.length);
    // No wildcard, nested tenant names, host-header spoofed suffixes, etc.
    return /^[a-z0-9][a-z0-9-]{0,62}$/.test(subdomain) ? host : null;
  } catch {
    return null;
  }
}

export async function dispatchApp(request: Request, env: DispatchEnv): Promise<Response> {
  // A disabled/missing application map may never fall back to a shared
  // Worker. No route until release promotion writes a trusted mapping.
  const base = env.APP_BASE_DOMAIN?.toLowerCase().trim() ?? "";
  const host = hostnameFor(request, base);
  if (!host) return fail(404, "App not found");

  let route: unknown;
  try {
    route = await env.APP_ROUTES.get(host, { type: "json" });
  } catch {
    return fail(503, "App routing unavailable");
  }
  if (!route || typeof route !== "object") return fail(404, "App not found");
  const record = route as Partial<DispatchRoute>;
  if (record.status !== "live" || !record.workerName ||
      !WORKER.test(record.workerName) || !record.releaseId ||
      !RELEASE.test(record.releaseId)) {
    return fail(404, "App not found");
  }
  try {
    const tenant = env.TENANT_WORKERS.get(record.workerName);
    if (!tenant?.fetch) return fail(503, "App unavailable");
    return await tenant.fetch(request);
  } catch {
    return fail(502, "App unavailable");
  }
}

export default { fetch: dispatchApp };
