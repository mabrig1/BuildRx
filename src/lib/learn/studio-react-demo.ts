import type { TrainingTrackId } from "@/lib/learn/labs";

export const REACT_DEMO_ENTRY = "src/lab/App.jsx";
export const REACT_DEMO_STYLE = "src/lab/styles.css";
export const REACT_DEMO_TRACK: TrainingTrackId = "fullstack-web";

/**
 * Deliberately a separate React UI training example — NOT a Next.js
 * application, API route, database integration or hosted production app.
 * Only these two reviewed paths can be transferred to the Sandpack preview.
 */
export const REACT_DEMO_APP = `import React, { useState } from "react";
import "./styles.css";

export default function App() {
  const [visits, setVisits] = useState(["Morning demo appointment"]);
  const [name, setName] = useState("");

  function addDemo(event) {
    event.preventDefault();
    const next = name.trim();
    if (!next) return;
    setVisits((items) => [...items, next]);
    setName("");
  }

  return (
    <main className="app">
      <h1>My booking practice app</h1>
      <p className="notice">UI demonstration only: these entries are in memory, not saved to a database.</p>
      <form onSubmit={addDemo}>
        <label htmlFor="visitor">Appointment note</label>
        <input id="visitor" value={name} required
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter your demo appointment" />
        <button type="submit">Add demo entry</button>
      </form>
      <h2>Temporary demo entries</h2>
      <ul>{visits.map((visit, index) =>
        <li key={index}>{visit}</li>
      )}</ul>
      <p className="notice">Refresh resets the entries. This is not an authenticated booking application.</p>
    </main>
  );
}
`;

export const REACT_DEMO_CSS = `* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #f6f8fb; color: #15243b; }
.app { max-width: 560px; margin: 24px auto; padding: 24px; background: white; border-radius: 16px; box-shadow: 0 4px 24px #12223a12; }
h1 { font-size: 1.5rem; }
h2 { font-size: 1.1rem; }
form { display: flex; gap: 10px; flex-wrap: wrap; }
label { width: 100%; font-weight: 600; }
input { flex: 1 1 200px; min-width: 0; padding: 10px; border: 1px solid #b9c4d6; border-radius: 8px; }
button { background: #185da8; color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; }
li { padding: 8px; }
.notice { color: #58657b; font-size: 0.9rem; }
`;

export type ReactDemoFiles = Readonly<Record<"/App.js" | "/styles.css", string>>;
export type ReactPreviewSnapshot =
  | { ok: true; files: ReactDemoFiles; title: string }
  | { ok: false; reason: string };

export function prepareReactDemoPreview(input: {
  trackId: string;
  files: Readonly<Record<string, string>>;
  containsSecrets: boolean;
}): ReactPreviewSnapshot {
  if (input.trackId !== REACT_DEMO_TRACK) {
    return { ok: false, reason: "React UI preview is currently available for the full-stack web training track only." };
  }
  if (input.containsSecrets) {
    return { ok: false, reason: "Remove possible tokens and private connection strings before sending demo code to the sandbox." };
  }
  const app = input.files[REACT_DEMO_ENTRY];
  const css = input.files[REACT_DEMO_STYLE];
  if (typeof app !== "string" || typeof css !== "string") {
    return { ok: false, reason: "This track is missing the React UI demo files. Restore the starter or add them before previewing." };
  }
  if (!app.trim() || app.length > 12_000 || css.length > 8_000) {
    return { ok: false, reason: "React demo files must contain code and stay within the preview size limits." };
  }
  // Defensive source screening only. A third-party iframe sandbox does NOT
  // certify arbitrary code as safe, and network cannot be assumed blocked.
  if (/(?:\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\bsendBeacon\b|\blocalStorage\b|\bsessionStorage\b|\bdocument\s*\.\s*cookie\b|\beval\s*\(|\bimport\s*\(|\brequire\s*\(|\bwindow\s*\.\s*open\s*\(|\bprocess\s*\.\s*env\b|@import\b|\burl\s*\()/i.test(app + css)) {
    return { ok: false, reason: "The introductory UI preview does not accept network, browser storage or dynamic code-evaluation APIs." };
  }
  if (/https?:\/\//i.test(app + css)) {
    return { ok: false, reason: "Remove absolute network URLs from this beginner React demonstration." };
  }
  // React template uses only its bundled dependencies; no user-provided
  // package.json or Next.js server routes are transferred.
  if (/\b(?:from|import)\s*["'](?!react["']|react\/jsx-runtime["']|\.\/styles\.css["'])/m.test(app)) {
    return { ok: false, reason: "The preview supports React and the local styles.css only; extra packages or imports are not installed." };
  }
  if (/<(?:iframe|script)\b/i.test(app)) {
    return { ok: false, reason: "Script and iframe elements are outside this introductory UI demo." };
  }
  return {
    ok: true,
    title: "React UI practice (no Next.js backend or database)",
    files: { "/App.js": app, "/styles.css": css },
  };
}
