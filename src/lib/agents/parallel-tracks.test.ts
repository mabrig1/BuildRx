import { describe, expect, it } from "vitest";
import { isTrackOwnedPath, mergeIndependentTracks } from "@/lib/agents/parallel-tracks";
import type { GeneratedFile } from "@/lib/agents/types";

const f = (path: string, content: string): GeneratedFile => ({ path, content });
const map = (...items: GeneratedFile[]) => new Map(items.map((item) => [item.path, item]));

describe("parallel subagent isolation", () => {
  it("allows only source paths owned by each specialist", () => {
    expect(isTrackOwnedPath("ui", "src/app/[projectId]/page.tsx")).toBe(true);
    expect(isTrackOwnedPath("ui", "src/app/api/records/route.ts")).toBe(false);
    expect(isTrackOwnedPath("database", "supabase/schema.sql")).toBe(true);
    expect(isTrackOwnedPath("database", "src/app/page.tsx")).toBe(false);
  });
  it("deterministically merges isolated UI and schema edits", () => {
    const base = map(f("docs/SDLC-WORKFLOW.md", "human approvals"));
    const result = mergeIndependentTracks(base, [
      { track: "ui", files: map(...base.values(), f("src/app/page.tsx", "UI")) },
      { track: "database", files: map(...base.values(), f("supabase/schema.sql", "SQL")) },
    ]);
    expect(result.rejected).toEqual([]);
    expect(result.files.get("src/app/page.tsx")?.content).toBe("UI");
    expect(result.files.get("supabase/schema.sql")?.content).toBe("SQL");
    expect(result.files.get("docs/SDLC-WORKFLOW.md")?.content).toBe("human approvals");
    expect(base.size).toBe(1);
  });
  it("rejects rogue API edits, foreign output and deletion attempts", () => {
    const base = map(f("docs/SDLC-WORKFLOW.md", "approval"));
    const result = mergeIndependentTracks(base, [
      { track: "ui", files: map(
        f("src/app/api/private/route.ts", "delete everything"),
        f("supabase/schema.sql", "DROP SCHEMA public"),
      ) },
      { track: "database", files: map(
        ...base.values(),
        f("src/app/page.tsx", "rogue"),
      ) },
    ]);
    expect(result.files.get("docs/SDLC-WORKFLOW.md")?.content).toBe("approval");
    expect(result.files.has("src/app/api/private/route.ts")).toBe(false);
    expect(result.files.has("supabase/schema.sql")).toBe(false);
    expect(result.files.has("src/app/page.tsx")).toBe(false);
    expect(result.rejected.length).toBeGreaterThanOrEqual(3);
  });
});
