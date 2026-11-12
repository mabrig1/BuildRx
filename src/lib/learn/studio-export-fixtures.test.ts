import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { buildStudioExport } from "./studio-export-kit";
import { newStudioWorkspace } from "./studio-workspace";

/**
 * Executed only when the certification workflow explicitly opts in.
 *
 * This writes two REVIEWED BASELINE training packages to an isolated GitHub
 * Actions temporary directory. It does not read student files, import
 * arbitrary GitHub source, execute user code, or upload the fixture.
 * The workflow separately installs/builds the generated packages without
 * any production secrets or cloud tokens.
 */
describe("BuildRx reviewed starter export fixtures", () => {
  it.skipIf(!process.env.BUILDRX_STUDIO_CERTIFY_DIR)(
    "materializes trusted web and TypeScript baseline source packages for CI",
    async () => {
      const root = process.env.BUILDRX_STUDIO_CERTIFY_DIR;
      if (!root || !path.isAbsolute(root)) throw new Error("Isolated absolute fixture directory required");

      for (const trackId of ["fullstack-web", "software-engineering"] as const) {
        // Factory makes only reviewed in-repo starter code. Never accept a
        // project archive or student-provided source in this CI operation.
        const fixture = buildStudioExport(newStudioWorkspace(trackId));
        if (!fixture.ok) throw new Error(fixture.reason);
        const directory = path.join(root, trackId);
        const allowedRoot = directory + path.sep;
        for (const [relativePath, source] of Object.entries(fixture.files)) {
          const outputPath = path.resolve(directory, relativePath);
          if (!outputPath.startsWith(allowedRoot)) throw new Error("Unsafe fixture export path");
          await mkdir(path.dirname(outputPath), { recursive: true });
          await writeFile(outputPath, source, { encoding: "utf8", flag: "wx" });
        }
        expect(Object.keys(fixture.files)).toContain("package.json");
        expect(Object.keys(fixture.files)).toContain("tsconfig.json");
        expect(Object.keys(fixture.files)).toContain("README-TRAINING.md");
      }
    },
  );
});
