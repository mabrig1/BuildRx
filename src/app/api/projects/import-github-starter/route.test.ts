import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/github/service", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/billing/limits", () => ({ checkProjectLimit: vi.fn() }));

import { getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";
import { checkProjectLimit } from "@/lib/billing/limits";
import { POST } from "./route";

const PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";
const request = (payload: unknown) => new Request("https://buildrx.example/api/projects/import-github-starter", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Origin": "https://buildrx.example", "Host": "buildrx.example" },
  body: JSON.stringify(payload),
});

function mockDb(failFiles = false) {
  const saveProject = {
    single: vi.fn(async () => ({ data: { id: PROJECT_ID }, error: null })),
    select: vi.fn().mockReturnThis(),
  };
  const removeProject = {
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => void) => resolve({ error: null }),
  };
  const projectTable = {
    insert: vi.fn(() => saveProject),
    delete: vi.fn(() => removeProject),
  };
  const fileTable = {
    insert: vi.fn(async (rows: Array<{ project_id: string; path: string; content: string }>) => ({
      error: failFiles || rows.length === 0 || rows.some(row => row.project_id !== PROJECT_ID)
        ? new Error("test storage failure") : null,
    })),
  };
  const chatTable = { insert: vi.fn(async () => ({ error: null })) };
  const from = vi.fn((table: string) => {
    if (table === "projects") return projectTable;
    if (table === "project_files") return fileTable;
    if (table === "chat_messages") return chatTable;
    throw new Error("Unexpected table access: " + table);
  });
  vi.mocked(createClient).mockResolvedValue({ from } as never);
  return { from, projectTable, fileTable, chatTable, removeProject };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSession).mockResolvedValue({ demo: false, userId: "owner" });
  vi.mocked(checkProjectLimit).mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("beginner clone API safeguards", () => {
  it("never accepts unknown repositories or custom URL / SHA selection", async () => {
    const db = mockDb();
    for (const data of [
      { templateId: "https://github.com/evil/malware" },
      { templateId: "../blog", repository: "evil/repo" },
      { templateId: "github-basic-css", repository: "evil/repo" },
      { templateId: "github-basic-css", commit: "a".repeat(40) },
    ]) {
      const response = await POST(request(data));
      expect(response.status).toBe(400);
    }
    expect(db.from).not.toHaveBeenCalled();
  });

  it("refuses cross-origin requests and demo sessions before reading code", async () => {
    const db = mockDb();
    const requestBody = { templateId: "beginner-task-planner" };
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await POST(request(requestBody))).status).toBe(401);
    vi.mocked(getSession).mockResolvedValue({ demo: false, userId: "owner" });
    const badOrigin = new Request("https://buildrx.example/api/projects/import-github-starter", {
      method: "POST",
      headers: { Host: "buildrx.example", Origin: "https://attacker.example" },
      body: JSON.stringify(requestBody),
    });
    expect((await POST(badOrigin)).status).toBe(403);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("creates a private Draft containing real checked source, license, and original provenance", async () => {
    const db = mockDb();
    const network = vi.fn(async () => { throw new Error("Never fetch GitHub for BuildRx original"); });
    vi.stubGlobal("fetch", network);
    const response = await POST(request({ templateId: "beginner-task-planner" }));
    const output = await response.json();
    expect(response.status).toBe(201);
    expect(output).toMatchObject({
      projectId: PROJECT_ID, imported: true, verified: false,
      deployed: false, sourceKind: "buildrx-original",
    });
    expect(output.securityPreflight.status).toBe("no-indicators-observed");
    expect(output.files).toBe(7);
    expect(db.projectTable.insert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: "owner", status: "draft",
    }));
    const savedFiles = db.fileTable.insert.mock.calls.flatMap(([rows]) => rows);
    expect(savedFiles.map(f => f.path)).toEqual(expect.arrayContaining(["LICENSE", "README.md", "BUILD-RX-SOURCE.md"]));
    expect(network).not.toHaveBeenCalled();
  });

  it("rolls back the private draft when any file batch fails", async () => {
    const db = mockDb(true);
    const response = await POST(request({ templateId: "beginner-business-website" }));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toMatch(/full GitHub template|full/);
    expect(db.projectTable.delete).toHaveBeenCalled();
    expect(db.removeProject.eq).toHaveBeenCalledWith("owner_id", "owner");
  });

  it("enforces account project creation limits before storing source", async () => {
    const db = mockDb();
    vi.mocked(checkProjectLimit).mockResolvedValue("Free project limit reached.");
    const response = await POST(request({ templateId: "beginner-stock-list" }));
    expect(response.status).toBe(402);
    expect(db.projectTable.insert).not.toHaveBeenCalled();
  });
});
