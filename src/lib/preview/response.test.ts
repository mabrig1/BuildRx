import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/preview/[projectId]/route";
import { verifyPreviewResponds } from "@/lib/agents/tools";

const session = vi.hoisted(() => ({ user: "owner", storageError: false }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      expect(table).toBe("project_files");
      const filters = new Map<string, string>();
      const query = {
        select: () => query,
        eq: (key: string, value: string) => { filters.set(key, value); return query; },
        maybeSingle: async () => {
          expect(filters.get("project_id")).toBe("private-project");
          expect(filters.get("path")).toBe("preview/index.html");
          const data = session.user === "owner"
            ? { path: "preview/index.html", content: "<html><body>Owner preview</body></html>", language: "html" }
            : null;
          return session.storageError ? { data: null, error: { message: "offline" } } : { data, error: null };
        },
      };
      return query;
    },
  }),
}));

const request = () => GET(new Request("https://buildrx.test"), {
  params: Promise.resolve({ projectId: "private-project" }),
});
afterEach(() => { session.user = "owner"; session.storageError = false; vi.unstubAllGlobals(); });

it("serves and verifies the saved private preview under its owner and denies an anonymous reader", async () => {
  const network = vi.fn().mockRejectedValue(new Error("Unexpected anonymous probe"));
  vi.stubGlobal("fetch", network);
  expect((await verifyPreviewResponds("private-project")).ok).toBe(true);
  const ownerResponse = await request();
  expect(await ownerResponse.text()).toContain("Owner preview");
  expect(ownerResponse.headers.get("Content-Security-Policy")).toContain("sandbox allow-scripts");
  expect(ownerResponse.headers.get("Content-Security-Policy")).toContain("form-action 'none'");
  expect(ownerResponse.headers.get("Content-Security-Policy")).toContain("base-uri 'none'");

  session.user = "anonymous";
  const denied = await request();
  expect(denied.status).toBe(404);
  expect(await denied.text()).not.toContain("Owner preview");
  expect((await verifyPreviewResponds("private-project")).ok).toBe(false);
  expect(network).not.toHaveBeenCalled();
});

it("reports a storage outage separately from a missing file", async () => {
  session.storageError = true;
  expect((await request()).status).toBe(503);
  expect(await verifyPreviewResponds("private-project")).toMatchObject({ ok: false, detail: expect.stringContaining("503") });
});
