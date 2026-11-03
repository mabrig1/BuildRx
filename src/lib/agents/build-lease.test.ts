import { describe, expect, it } from "vitest";

import { acquireBuildLease } from "@/lib/agents/build-lease";

describe("build lease", () => {
  it("blocks two simultaneous builds of the same user's project", () => {
    const release = acquireBuildLease("project-a", "alice");
    expect(release).toBeTypeOf("function");
    expect(acquireBuildLease("project-a", "alice")).toBeNull();
    release?.();
    const next = acquireBuildLease("project-a", "alice");
    expect(next).toBeTypeOf("function");
    next?.();
  });

  it("does not block a different user's or project's builds", () => {
    const a = acquireBuildLease("project-a", "alice");
    const b = acquireBuildLease("project-b", "alice");
    const c = acquireBuildLease("project-a", "bob");
    expect(a).toBeTypeOf("function");
    expect(b).toBeTypeOf("function");
    expect(c).toBeTypeOf("function");
    a?.();
    b?.();
    c?.();
  });

  it("is safe to release twice without unlocking a newer build", () => {
    const first = acquireBuildLease("project-c", null);
    first?.();
    const second = acquireBuildLease("project-c", null);
    first?.();
    expect(acquireBuildLease("project-c", null)).toBeNull();
    second?.();
    const third = acquireBuildLease("project-c", null);
    expect(third).toBeTypeOf("function");
    third?.();
  });
});
