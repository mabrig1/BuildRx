import { describe, expect, it } from "vitest";

import {
  fileWithEmbeddedCredential,
  isDeploymentSourcePath,
} from "@/lib/deploy/source";

describe("isDeploymentSourcePath", () => {
  it("keeps source and the non-secret environment contract", () => {
    expect(isDeploymentSourcePath("src/app/page.tsx")).toBe(true);
    expect(isDeploymentSourcePath(".env.example")).toBe(true);
  });

  it.each([".env", ".env.local", ".env.production", "apps/web/.env.local"])(
    "excludes secret env file %s",
    (path) => {
      expect(isDeploymentSourcePath(path)).toBe(false);
    }
  );

  it("excludes the static preview from a full source deploy", () => {
    expect(isDeploymentSourcePath("preview/index.html")).toBe(false);
  });

  it("identifies a credential-bearing file without returning its value", () => {
    const secret = `nvapi-${"x".repeat(24)}`;
    expect(
      fileWithEmbeddedCredential([
        { path: "src/server.ts", content: `const key = "${secret}"` },
      ])
    ).toBe("src/server.ts");
  });
});
