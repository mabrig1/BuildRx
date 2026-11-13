import { describe, expect, it, vi } from "vitest";
import { dispatchApp, type DispatchEnv } from "../../../platform/dispatcher/src/index";

const domain = "apps.buildrx.example";
const WORKER = "brx-" + "a".repeat(36);
const RELEASE = "f".repeat(64);

function mockEnv(route: unknown): DispatchEnv {
  return {
    APP_BASE_DOMAIN: domain,
    APP_ROUTES: { get: vi.fn(async () => route) },
    TENANT_WORKERS: {
      get: vi.fn(() => ({ fetch: vi.fn(async () => new Response("owned-app", { status: 200 })) }))
    }
  };
}
const req = (host = "hello." + domain) => new Request("https://" + host + "/dashboard");

describe("Workers for Platforms dynamic dispatch routing", () => {
  it("routes only a trusted active route to its exact tenant worker name", async () => {
    const env = mockEnv({ workerName: WORKER, status: "live", releaseId: RELEASE });
    const response = await dispatchApp(req(), env);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("owned-app");
    expect(env.APP_ROUTES.get).toHaveBeenCalledWith("hello." + domain, { type: "json" });
    expect(env.TENANT_WORKERS.get).toHaveBeenCalledWith(WORKER);
  });

  it("rejects unsanctioned hosts, nested tenants, HTTP, missing DNS config", async () => {
    for (const host of [
      "not-" + domain,
      "app." + domain + ".attacker.invalid",
      "foo.bar." + domain,
      domain,
      "x_" + "." + domain,
    ]) {
      const env = mockEnv({ workerName: WORKER, status: "live", releaseId: RELEASE });
      const res = await dispatchApp(req(host), env);
      expect(res.status).toBe(404);
      expect(env.APP_ROUTES.get).not.toHaveBeenCalled();
    }
    const disabled = mockEnv({ workerName: WORKER, status: "live", releaseId: RELEASE });
    disabled.APP_BASE_DOMAIN = "";
    expect((await dispatchApp(req(), disabled)).status).toBe(404);
    const insecure = mockEnv({ workerName: WORKER, status: "live", releaseId: RELEASE });
    expect((await dispatchApp(new Request("http://hello." + domain + "/"), insecure)).status).toBe(404);
  });

  it("never dispatches staging, disabled, invalid or absent routes", async () => {
    for (const route of [
      null, {}, { status: "staging", workerName: WORKER, releaseId: RELEASE },
      { status: "disabled", workerName: WORKER, releaseId: RELEASE },
      { status: "live", workerName: "../other", releaseId: RELEASE },
      { status: "live", workerName: WORKER, releaseId: "../forged" },
    ]) {
      const env = mockEnv(route);
      const response = await dispatchApp(req(), env);
      expect(response.status).toBe(404);
      expect(env.TENANT_WORKERS.get).not.toHaveBeenCalled();
    }
  });

  it("does not trust forwarded host headers or user-chosen worker name", async () => {
    const env = mockEnv({ workerName: WORKER, status: "live", releaseId: RELEASE });
    const request = new Request("https://wrong.invalid/", {
      headers: {
        "x-forwarded-host": "hello." + domain,
        "host": "hello." + domain,
        "x-worker-name": WORKER,
      }
    });
    expect((await dispatchApp(request, env)).status).toBe(404);
    expect(env.APP_ROUTES.get).not.toHaveBeenCalled();
  });

  it("returns a private generic failure on namespace or worker outages", async () => {
    const env = mockEnv({ workerName: WORKER, status: "live", releaseId: RELEASE });
    env.APP_ROUTES.get = vi.fn(async () => { throw new Error("secret-kv-auth"); });
    const first = await dispatchApp(req(), env);
    expect(first.status).toBe(503);
    expect(await first.text()).not.toContain("secret");
    const secondEnv = mockEnv({ workerName: WORKER, status: "live", releaseId: RELEASE });
    secondEnv.TENANT_WORKERS.get = vi.fn(() => { throw new Error("secret-durable"); });
    const second = await dispatchApp(req(), secondEnv);
    expect(second.status).toBe(502);
    expect(await second.text()).toBe("App unavailable");
  });
});
