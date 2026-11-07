import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/github/service", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/files/manager", () => ({ getFileSystem: vi.fn() }));

import { getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";
import { getFileSystem } from "@/lib/files/manager";
import { GET } from "./route";

const projectId = "550e8400-e29b-41d4-a716-446655440000";
const request = () => new Request(
  "https://buildrx.example/api/projects/security-preflight?projectId=" + projectId
);
const normal = [
  { path: "package.json", content: '{"scripts":{"build":"next build"},"dependencies":{"next":"15.5.20"}}' },
  { path: "app/page.tsx", content: "export default function Page() { return null; }" },
];

function mockOwner(project: { id: string; status: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: project, error: null });
  const eq = vi.fn().mockReturnThis();
  const select = vi.fn().mockReturnValue({ eq, maybeSingle });
  const from = vi.fn().mockReturnValue({ select });
  vi.mocked(createClient).mockResolvedValue({ from } as never);
  return { from, eq, maybeSingle };
}

function mockFiles(files: Array<{path:string;content:string}>) {
  const read = vi.fn(async (path: string) => files.find(file => file.path === path) ?? null);
  const list = vi.fn(async () => files.map(file => ({
    path: file.path, size: file.content.length, language: null, updatedAt: null,
  })));
  vi.mocked(getFileSystem).mockReturnValue({ list, read } as never);
  return { list, read };
}

beforeEach(() => vi.mocked(getSession).mockResolvedValue({ userId: "owner-id", demo: false }));
afterEach(() => vi.clearAllMocks());

describe("owner-scoped read-only DevShield API", () => {
  it("rejects anonymous and demo sessions before file reads", async () => {
    for (const session of [null, { demo: true, userId: null }]) {
      vi.mocked(getSession).mockResolvedValue(session);
      const response = await GET(request());
      expect(response.status).toBe(401);
      expect(getFileSystem).not.toHaveBeenCalled();
    }
  });

  it("denies another tenant before opening project source", async () => {
    mockOwner(null);
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(getFileSystem).not.toHaveBeenCalled();
  });

  it("scans owned files and returns only static status, never matched source", async () => {
    mockOwner({ id: projectId, status: "ready" });
    mockFiles(normal);
    const response = await GET(request());
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(data.securityPreflight.status).toBe("no-indicators-observed");
    expect(data.securityCheckPassed).toBe(true);
    expect(data.deployed).toBe(false);
  });

  it("shows redacted findings for suspicious source without granting publication", async () => {
    mockOwner({ id: projectId, status: "ready" });
    mockFiles([...normal, {
      path: "config.ts",
      content: 'const host = "muckdeveloper.com"; const password = "DO_NOT_EXPOSE_THIS";',
    }]);
    const response = await GET(request());
    const raw = await response.text();
    const data = JSON.parse(raw);
    expect(data.securityPreflight.status).toBe("blocked");
    expect(data.securityCheckPassed).toBe(false);
    expect(raw).not.toContain("DO_NOT_EXPOSE_THIS");
    expect(raw).toContain("drweb-2026-campaign-ioc");
  });

  it("refuses a source snapshot that changes during reading", async () => {
    mockOwner({ id: projectId, status: "draft" });
    mockFiles(normal);
    vi.mocked(getFileSystem).mockReturnValue({
      list: vi.fn(async () => normal.map(file => ({ path: file.path }))),
      read: vi.fn(async () => null),
    } as never);
    const response = await GET(request());
    expect(response.status).toBe(409);
  });
});
