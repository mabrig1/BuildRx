import { describe, expect, it } from "vitest";

import {
  prepareReactDemoPreview, REACT_DEMO_APP, REACT_DEMO_CSS,
  REACT_DEMO_ENTRY, REACT_DEMO_STYLE,
} from "./studio-react-demo";
import { newStudioWorkspace, parseStudioWorkspace } from "./studio-workspace";

function preview(files?: Record<string, string>, trackId = "fullstack-web", containsSecrets = false) {
  const baseline = newStudioWorkspace("fullstack-web");
  return prepareReactDemoPreview({
    trackId, files: files ?? baseline.files, containsSecrets,
  });
}

describe("explicit opt-in React UI sandbox handoff", () => {
  it("seeds an isolated demo alongside unchanged Next.js source", () => {
    const workspace = newStudioWorkspace("fullstack-web");
    expect(workspace.files["src/app/page.tsx"]).toContain("Booking Lab");
    expect(workspace.files[REACT_DEMO_ENTRY]).toBe(REACT_DEMO_APP);
    expect(workspace.files[REACT_DEMO_STYLE]).toBe(REACT_DEMO_CSS);
    const checked = parseStudioWorkspace(workspace, "fullstack-web");
    expect(checked.ok).toBe(true);
  });

  it("transfers precisely two UI-only files, not full project source or user secrets", () => {
    const workspace = newStudioWorkspace("fullstack-web");
    workspace.files["src/app/api/private/route.ts"] = "server-only training placeholder";
    workspace.files["src/app/private.tsx"] = "confidential local-only demo text";
    const snapshot = preview(workspace.files);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) throw new Error("Expected valid demo snapshot");
    expect(Object.keys(snapshot.files).sort()).toEqual(["/App.js", "/styles.css"]);
    expect(snapshot.files["/App.js"]).not.toContain("confidential local-only");
    expect(snapshot.files["/App.js"]).toContain("UI demonstration only");
  });

  it("does not accept mobile/system training files or missing demo files", () => {
    expect(preview(undefined, "mobile-app").ok).toBe(false);
    expect(preview({ "src/app/page.tsx": "some Next code" }).ok).toBe(false);
    expect(preview(undefined, "fullstack-web", true).ok).toBe(false);
  });

  it("rejects browser/network access, external imports and credential-shaped demo code", () => {
    const initial = newStudioWorkspace("fullstack-web").files;
    for (const dangerous of [
      "fetch('/api/projects')",
      "localStorage.getItem('buildrx')",
      "document.cookie",
      "navigator.sendBeacon('https://example.org', 'x')",
      "new WebSocket('wss://example.org')",
      "import('private-code')",
      "const lib = require('child_process')",
      "window.open('https://example.org')",
      "import privateData from './secret.js'",
      "<iframe src=\"https://example.org\" />",
      "const image = 'https://example.org/exfil'",
    ]) {
      const files = { ...initial, [REACT_DEMO_ENTRY]: REACT_DEMO_APP + "\n" + dangerous };
      expect(preview(files).ok, dangerous).toBe(false);
    }
  });

  it("rejects empty or oversized UI snippets", () => {
    const initial = newStudioWorkspace("fullstack-web").files;
    expect(preview({ ...initial, [REACT_DEMO_ENTRY]: "" }).ok).toBe(false);
    expect(preview({ ...initial, [REACT_DEMO_STYLE]: "a".repeat(8001) }).ok).toBe(false);
    expect(preview({ ...initial, [REACT_DEMO_ENTRY]: "a".repeat(12001) }).ok).toBe(false);
  });
});
