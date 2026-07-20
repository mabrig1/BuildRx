import { describe, expect, it } from "vitest";

import { detectFramework } from "@/lib/deploy/framework";

describe("detectFramework", () => {
  it("detects Next.js from a dependencies entry", () => {
    const files = [
      { path: "package.json", content: JSON.stringify({ dependencies: { next: "^15.0.0" } }) },
    ];
    expect(detectFramework(files)).toBe("nextjs");
  });

  it("detects Next.js from a devDependencies entry", () => {
    const files = [
      { path: "package.json", content: JSON.stringify({ devDependencies: { next: "^15.0.0" } }) },
    ];
    expect(detectFramework(files)).toBe("nextjs");
  });

  it("returns null when there's no package.json", () => {
    expect(detectFramework([{ path: "index.html", content: "<html></html>" }])).toBeNull();
  });

  it("returns null when package.json has no next dependency", () => {
    const files = [
      { path: "package.json", content: JSON.stringify({ dependencies: { react: "^19.0.0" } }) },
    ];
    expect(detectFramework(files)).toBeNull();
  });

  it("returns null for malformed package.json rather than throwing", () => {
    expect(detectFramework([{ path: "package.json", content: "{not valid json" }])).toBeNull();
  });
});
