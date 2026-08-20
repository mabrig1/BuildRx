import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

describe("Supabase routing middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("serves the public homepage without contacting Supabase", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("NEXT_PUBLIC_APP_HOST", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await updateSession(
      new NextRequest("https://www.buildrx.online/")
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders login without an auth round trip for signed-out visitors", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("NEXT_PUBLIC_APP_HOST", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await updateSession(
      new NextRequest("https://www.buildrx.online/login")
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("redirects a signed-out protected request without reporting an outage", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("NEXT_PUBLIC_APP_HOST", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await updateSession(
      new NextRequest("https://www.buildrx.online/dashboard")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.buildrx.online/login?next=%2Fdashboard"
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("clamps the configurable auth timeout without affecting signed-out routing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("NEXT_PUBLIC_APP_HOST", "");
    vi.stubEnv("SUPABASE_AUTH_TIMEOUT_MS", "25000");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await updateSession(
      new NextRequest("https://www.buildrx.online/projects")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.buildrx.online/login?next=%2Fprojects"
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
