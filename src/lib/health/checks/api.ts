import { classifyThrown } from "@/lib/health/error-response";
import type { CheckResult, HealthStatus } from "@/lib/health/types";

const PING_TIMEOUT_MS = 5000;

/** A representative sample of the app's own API surface (GET-safe routes). */
const PROBE_ROUTES = ["/api/chat", "/api/ai/models"];

function appUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

async function probeRoute(base: string, route: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${route}`, {
      method: "GET",
      signal: controller.signal,
    });
    return { route, ok: response.status < 500, status: response.status };
  } catch (error) {
    return { route, ok: false, status: null, error: classifyThrown(error, "api").cause };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * API Agent: confirms the app's own API layer is actually serving
 * requests (as opposed to the marketing/app shell, checked separately
 * by the Deployment Agent) by hitting a small set of representative
 * GET-safe routes on the live deployment.
 */
export async function checkApi(): Promise<{ result: CheckResult }> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const base = appUrl();

  if (!base) {
    return {
      result: {
        subsystem: "api",
        label: "API",
        status: "degraded",
        summary: "NEXT_PUBLIC_APP_URL is not set — cannot probe the API surface from outside the request.",
        checkedAt,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const probes = await Promise.all(PROBE_ROUTES.map((route) => probeRoute(base, route)));
  const failing = probes.filter((p) => !p.ok);

  const status: HealthStatus =
    failing.length === 0 ? "healthy" : failing.length === probes.length ? "down" : "degraded";
  const summary =
    failing.length === 0
      ? `${probes.length} API route(s) responding.`
      : `${failing.length}/${probes.length} API route(s) failing: ${failing.map((p) => p.route).join(", ")}.`;

  return {
    result: {
      subsystem: "api",
      label: "API",
      status,
      summary,
      detail: { probes },
      checkedAt,
      durationMs: Date.now() - startedAt,
    },
  };
}
