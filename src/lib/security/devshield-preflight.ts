/**
 * BuildRx in-memory adapter for MABRIG DevShield's repository malware preflight.
 * Rule provenance: mabrig1/mabrig-devshield-ai@92a54b59170ff150387f63e1bfeb92a0151964f5
 * Source is treated as data. This module NEVER runs, imports, compiles, clones,
 * downloads, uploads or evaluates submitted project code.
 *
 * This is a bounded static check, not an antivirus or a "safe to execute" verdict.
 */
import { Buffer } from "node:buffer";

export interface DevShieldSourceFile {
  path: string;
  content: string;
}
export interface DevShieldFinding {
  id: string;
  severity: "critical" | "high" | "medium";
  path: string;
  line: number;
  message: string;
}
export interface DevShieldPreflightReport {
  engine: "devshield-repository-preflight";
  ruleVersion: "2026-11-07";
  status: "blocked" | "review" | "no-indicators-observed" | "incomplete";
  complete: boolean;
  checkedFiles: number;
  skippedNonExecutableFiles: number;
  findings: DevShieldFinding[];
  errors: string[];
}
const MAX_FILES = 500;
const MAX_FILE_BYTES = 1_500_000;
const MAX_TOTAL_BYTES = 5_000_000;
const MAX_FINDINGS = 150;
// Never report a successful scan of a binary or path that could contain executable code.
const executable = /\.(?:csproj|vbproj|fsproj|targets|props|suo|ps1|psm1|psd1|bat|cmd|py|go|js|mjs|cjs|jsx|ts|tsx|json|ya?ml|sh|bash|zsh|php|rb)$/i;
const dangerousBinary = /\.(?:exe|dll|msi|com|scr|jar|class|so|dylib|wasm|node|appx|ps1xml|zip|7z|rar|tar|tgz|gz|iso)$/i;
const msbuild = /\.(?:csproj|vbproj|fsproj|targets|props)$/i;
const ioc = /\b(?:muckanthropic(?:\.|\[\.\])com|muckcoding(?:\.|\[\.\])com|muckdeveloper(?:\.|\[\.\])com|muckduck(?:\.|\[\.\])duckdns(?:\.|\[\.\])org|130(?:\.|\[\.\])12(?:\.|\[\.\])182(?:\.|\[\.\])172)\b/i;
const severityRank = { medium: 1, high: 2, critical: 3 };

function validPath(value: string): boolean {
  if (typeof value !== "string" || !value || value.length > 300 ||
      value.includes("\\") || value.includes("\0") ||
      value.startsWith("/") || /^[A-Za-z]:/.test(value)) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== ".." &&
    !/[\x00-\x1f]/.test(segment));
}

function lineNumber(source: string, index: number): number {
  let lines = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) lines++;
  return lines;
}
function collect(source: string, file: string, output: DevShieldFinding[],
  regex: RegExp, id: string, severity: DevShieldFinding["severity"], message: string) {
  const match = regex.exec(source);
  if (!match || output.length >= MAX_FINDINGS) return;
  output.push({ id, severity, path: file, line: lineNumber(source, match.index), message });
}

function inspectFile(file: DevShieldSourceFile, results: DevShieldFinding[], errors: string[]) {
  const path = file.path;
  const source = file.content;

  // Known indicators are triage clues, not attribution or proof of compromise.
  collect(source, path, results, ioc, "drweb-2026-campaign-ioc", "critical",
    "Source references a network indicator from the Nov 2026 fake-GitHub-project campaign.");
  if (msbuild.test(path)) {
    const event = /<(?:PreBuildEvent|PostBuildEvent)\b[^>]*>([\s\S]{0,2000}?)<\/(?:PreBuildEvent|PostBuildEvent)>/gi;
    for (const match of source.matchAll(event)) {
      if (/\b(?:powershell|pwsh|mshta|certutil|curl|wget|invoke-webrequest|downloadstring|iex)\b/i.test(match[1])) {
        if (results.length < MAX_FINDINGS) results.push({
          id: "msbuild-event-script-execution", severity: "critical", path,
          line: lineNumber(source, match.index ?? 0),
          message: "MSBuild runs a script interpreter or downloader during compilation.",
        });
      }
    }
    collect(source, path, results,
      /<Exec\b[^>]{0,1500}\bCommand\s*=\s*["'][^"']{0,1000}\b(?:powershell|pwsh|mshta|certutil)\b/i,
      "msbuild-exec-interpreter", "critical", "MSBuild Exec task launches a shell or downloader.");
  }
  if (/\.suo$/i.test(path)) {
    collect(source, path, results, /\b(?:powershell|pwsh)(?:\.exe)?\b/i,
      "visual-studio-suo-powershell", "high",
      "Visual Studio .suo text includes a PowerShell reference (heuristic).");
  }
  collect(source, path, results,
    /\b(?:powershell|pwsh)(?:\.exe)?\b[^\r\n]{0,220}-(?:encodedcommand|enc)\b/i,
    "powershell-encoded-command", "high", "PowerShell launches an encoded command.");
  collect(source, path, results,
    /(?:\biex\s*\([^\r\n]{0,140}(?:iwr|invoke-webrequest|downloadstring)\b|\b(?:iwr|invoke-webrequest|downloadstring)\b[^\r\n]{0,140}\|\s*(?:iex|invoke-expression)\b)/i,
    "powershell-download-and-execute", "critical",
    "PowerShell appears to download remote content for immediate execution.");
  if (/\.py$/i.test(path)) {
    collect(source, path, results, /[ \t]{120,}(?:exec|eval|subprocess\.|os\.system|urllib\.request|requests\.get)\b/gm,
      "python-whitespace-concealed-execution", "high",
      "Python execution or network call is obscured by unusually long whitespace.");
    collect(source, path, results,
      /\bexec\s*\(\s*(?:compile\s*\(\s*)?(?:base64\.b64decode|zlib\.decompress)\s*\(/,
      "python-decoded-payload-execution", "critical",
      "Python directly executes dynamically decoded or decompressed source.");
  }
  if (/\.go$/i.test(path)) {
    collect(source, path, results, /[ \t]{120,}(?:exec\.Command|http\.Get|base64\.StdEncoding)\b/gm,
      "go-whitespace-concealed-operation", "high",
      "Go executable/network operation follows unusually long whitespace.");
    collect(source, path, results, /\bexec\.Command(?:Context)?\s*\(\s*["'](?:powershell|pwsh)(?:\.exe)?["']/i,
      "go-powershell-execution", "high", "Go invokes PowerShell through os/exec.");
  }

  // Additional BuildRx-specific defenses for cloud builders executing package scripts.
  if (path === "package.json") {
    let pkg: unknown;
    try { pkg = JSON.parse(source); }
    catch { errors.push("Invalid package.json: cannot assess build lifecycle."); return; }
    if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
      errors.push("Invalid package.json structure."); return;
    }
    const scripts = (pkg as { scripts?: unknown }).scripts;
    if (scripts !== undefined && (!scripts || typeof scripts !== "object" || Array.isArray(scripts))) {
      errors.push("Invalid package.json scripts."); return;
    }
    for (const [key, command] of Object.entries(scripts ?? {})) {
      if (typeof command !== "string") {
        errors.push("Non-string package script."); break;
      }
      if (/^(?:preinstall|install|postinstall|prepare|prepack|postpack|prepublish|prepublishOnly)$/i.test(key)) {
        collect(source, path, results, /"scripts"\s*:\s*\{/, "npm-install-lifecycle-hook", "high",
          "Project defines an install/publish lifecycle hook that can run on a builder.");
      }
      if (/(?:\bcurl\b[^\r\n|]{0,180}\|\s*(?:bash|sh)\b|\bwget\b[^\r\n|]{0,180}\|\s*(?:bash|sh)\b|\b(?:powershell|pwsh)(?:\.exe)?\b|\bnode\s+(?:-e|--eval)\b)/i.test(command)) {
        collect(source, path, results, /"scripts"\s*:\s*\{/,
          "npm-executable-script-pattern", "critical",
          "Package script invokes an interpreter or downloads executable code.");
      }
    }
  }
}

export function scanDevShieldSource(files: DevShieldSourceFile[]): DevShieldPreflightReport {
  const report: DevShieldPreflightReport = {
    engine: "devshield-repository-preflight", ruleVersion: "2026-11-07",
    status: "incomplete", complete: false, checkedFiles: 0,
    skippedNonExecutableFiles: 0, findings: [], errors: [],
  };
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES) {
    report.errors.push("Source snapshot is empty or exceeds file-count limit.");
    return report;
  }
  const paths = new Set<string>();
  let total = 0;
  for (const file of files) {
    if (typeof file?.path !== "string" || typeof file?.content !== "string" ||
        !validPath(file.path) || paths.has(file.path.toLowerCase())) {
      report.errors.push("Invalid or duplicated source path.");
      break;
    }
    paths.add(file.path.toLowerCase());
    if (/(^|\/)(?:\.git|node_modules|\.next|\.open-next)(\/|$)/i.test(file.path) ||
        /(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.dev\.vars(?:\..*)?)$/i.test(file.path) &&
        file.path !== ".env.example") {
      report.errors.push("Private or generated source path was supplied.");
      break;
    }
    const size = Buffer.byteLength(file.content, "utf8");
    total += size;
    if (size > MAX_FILE_BYTES || total > MAX_TOTAL_BYTES) {
      report.errors.push("Source snapshot exceeds the bounded scan size.");
      break;
    }
    if (file.content.includes("\0")) {
      report.errors.push("Source contains binary/NUL data.");
      break;
    }
    if (dangerousBinary.test(file.path)) {
      report.errors.push("Executable/archive or unsupported binary source cannot be validated.");
      break;
    }
    if (!executable.test(file.path) && !/(?:^|\/)(?:Dockerfile(?:\..*)?|Makefile)$/i.test(file.path)) {
      report.skippedNonExecutableFiles++;
      continue;
    }
    report.checkedFiles++;
    inspectFile(file, report.findings, report.errors);
    if (report.errors.length > 0 || report.findings.length >= MAX_FINDINGS) {
      if (report.findings.length >= MAX_FINDINGS) report.errors.push("Finding limit exceeded.");
      break;
    }
  }
  report.complete = report.errors.length === 0;
  report.status = !report.complete ? "incomplete"
    : report.findings.some(f => severityRank[f.severity] >= severityRank.high) ? "blocked"
    : report.findings.length ? "review" : "no-indicators-observed";
  return report;
}

export class DevShieldPreflightError extends Error {
  constructor(readonly report: DevShieldPreflightReport) {
    super(!report.complete
      ? "DevShield could not finish scanning this source. No import or deployment was authorized."
      : "DevShield detected suspicious code. Review the reported source files before importing or publishing.");
    this.name = "DevShieldPreflightError";
  }
}

/** Fail closed: never downgrade incomplete scans to warnings, even if no match. */
export function enforceDevShieldPreflight(files: DevShieldSourceFile[]): DevShieldPreflightReport {
  const report = scanDevShieldSource(files);
  if (!report.complete || report.status === "blocked") throw new DevShieldPreflightError(report);
  return report;
}

/** Report metadata only — never expose source snippets, secrets or token values. */
export function devShieldPublicEvidence(report: DevShieldPreflightReport) {
  return {
    engine: report.engine,
    status: report.status,
    complete: report.complete,
    checkedFiles: report.checkedFiles,
    skippedNonExecutableFiles: report.skippedNonExecutableFiles,
    findings: report.findings.slice(0, 20),
    errors: report.errors,
  };
}
