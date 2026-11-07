import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Source contract: same-origin generated HTML must not regain parent origin privileges. */
it("keeps generated static preview scripts in an opaque sandbox", () => {
  const panel = readFileSync(join(process.cwd(), "src/components/preview/preview-panel.tsx"), "utf8");
  expect(panel).toContain('sandbox="allow-scripts"');
  expect(panel).not.toContain('allow-same-origin');
  expect(panel).toContain("event.source === previewFrameRef.current?.contentWindow");
});
