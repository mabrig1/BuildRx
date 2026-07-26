/**
 * Static verification suite — the QA Agent's "build and test".
 *
 * Runs against the virtual filesystem and targets the failure classes
 * LLM codegen actually produces: imports of files that don't exist,
 * packages used but never declared, broken structure (no layout, no
 * default export in a page), invalid package.json, planned routes and
 * tables with no implementation, and security violations. Deterministic,
 * free, and fast — every finding carries how the Repair Agent may act
 * on it.
 */
import type {
  AppPlan,
  CheckFinding,
  GeneratedFile,
  WorkflowContext,
} from "@/lib/agents/types";
import { inspectSchema, listFiles } from "@/lib/agents/tools";

const CODE_EXT = /\.(tsx?|jsx?)$/;

/** Node builtins and packages the generated stack always provides. */
const PROVIDED_PACKAGES = new Set([
  "next",
  "react",
  "react-dom",
  "fs",
  "path",
  "crypto",
  "url",
  "util",
]);

/** import/require specifiers in one file. */
function importSpecifiers(content: string): string[] {
  const out: string[] = [];
  const pattern =
    /(?:import\s[\s\S]*?from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) out.push(match[1]);
  return out;
}

/** Resolve a local specifier to the VFS paths it could mean. */
function candidatePaths(specifier: string, fromPath: string): string[] {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = `src/${specifier.slice(2)}`;
  } else if (specifier.startsWith(".")) {
    const dir = fromPath.split("/").slice(0, -1);
    for (const part of specifier.split("/")) {
      if (part === "." || part === "") continue;
      if (part === "..") dir.pop();
      else dir.push(part);
    }
    base = dir.join("/");
  } else {
    return []; // bare package — handled by the dependency check
  }
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.css`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];
}

function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** Cheap structural sanity for one code file. */
function fileStructureIssues(file: GeneratedFile): string[] {
  const issues: string[] = [];
  if (file.content.trim().length === 0) {
    issues.push("file is empty");
    return issues;
  }
  const opens = (file.content.match(/\{/g) ?? []).length;
  const closes = (file.content.match(/\}/g) ?? []).length;
  if (opens !== closes) {
    issues.push(`unbalanced braces (${opens} '{' vs ${closes} '}')`);
  }
  if (
    /\/page\.tsx$/.test(file.path) &&
    !/export\s+default\s/.test(file.content)
  ) {
    issues.push("page file has no default export");
  }
  return issues;
}

/** Patterns that must never appear in generated code. */
const SECRET_PATTERNS: Array<{ rule: string; pattern: RegExp; message: string }> = [
  {
    rule: "hardcoded-nvidia-key",
    pattern: /nvapi-[A-Za-z0-9_-]{20,}/,
    message: "hardcoded NVIDIA API key",
  },
  {
    rule: "hardcoded-secret-key",
    pattern: /sk-[A-Za-z0-9_-]{20,}/,
    message: "hardcoded secret key",
  },
  {
    rule: "hardcoded-jwt",
    pattern: /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
    message: "hardcoded JWT/service token",
  },
];

/** Full static pass. Order: structure → imports → deps → coverage. */
export function runStaticChecks(
  context: WorkflowContext,
  plan: AppPlan
): CheckFinding[] {
  const findings: CheckFinding[] = [];
  const paths = new Set(listFiles(context));
  const files = [...context.files.values()];

  // --- required project structure -----------------------------------
  if (!paths.has("preview/index.html")) {
    findings.push({
      rule: "missing-preview",
      severity: "error",
      message: "preview/index.html is missing — nothing to render",
      fix: "auto",
    });
  }
  if (!paths.has("src/app/page.tsx")) {
    findings.push({
      rule: "missing-home-page",
      severity: "error",
      message: "src/app/page.tsx is missing",
      fix: "auto",
    });
  }
  if (!paths.has("src/app/layout.tsx")) {
    findings.push({
      rule: "missing-layout",
      severity: "error",
      message: "src/app/layout.tsx is missing",
      fix: "auto",
    });
  }
  if (!paths.has("src/app/globals.css")) {
    findings.push({
      rule: "missing-globals-css",
      severity: "warning",
      message: "src/app/globals.css is missing",
      fix: "auto",
    });
  }

  // --- package.json --------------------------------------------------
  const pkgFile = context.files.get("package.json");
  let dependencies: Record<string, string> = {};
  if (!pkgFile) {
    findings.push({
      rule: "missing-package-json",
      severity: "error",
      message: "package.json is missing",
      fix: "auto",
    });
  } else {
    try {
      const pkg = JSON.parse(pkgFile.content);
      dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
      if (!pkg.scripts?.build) {
        findings.push({
          rule: "missing-build-script",
          severity: "warning",
          file: "package.json",
          message: 'package.json has no "build" script',
          fix: "auto",
        });
      }
    } catch {
      findings.push({
        rule: "invalid-package-json",
        severity: "error",
        file: "package.json",
        message: "package.json is not valid JSON",
        fix: "auto",
      });
    }
  }

  // --- per-file structure, imports, and security ---------------------
  for (const file of files) {
    if (CODE_EXT.test(file.path)) {
      for (const issue of fileStructureIssues(file)) {
        findings.push({
          rule: "broken-file",
          severity: "error",
          file: file.path,
          message: issue,
          fix: "llm",
        });
      }

      for (const specifier of importSpecifiers(file.content)) {
        const candidates = candidatePaths(specifier, file.path);
        if (candidates.length > 0) {
          if (!candidates.some((candidate) => paths.has(candidate))) {
            findings.push({
              rule: "missing-import",
              severity: "error",
              file: file.path,
              message: `imports "${specifier}" but no such file exists`,
              fix: "auto",
            });
          }
        } else {
          const name = packageName(specifier);
          if (
            !PROVIDED_PACKAGES.has(name) &&
            !name.startsWith("node:") &&
            !dependencies[name]
          ) {
            findings.push({
              rule: "undeclared-dependency",
              severity: "error",
              file: file.path,
              message: `uses package "${name}" but package.json does not declare it`,
              fix: "auto",
            });
          }
        }
      }
    }

    // Security: secrets and dangerous patterns in ANY generated file.
    for (const { rule, pattern, message } of SECRET_PATTERNS) {
      if (pattern.test(file.content)) {
        findings.push({
          rule,
          severity: "error",
          file: file.path,
          message: `${message} found in generated code`,
          fix: "auto",
        });
      }
    }
    if (CODE_EXT.test(file.path)) {
      if (/\beval\s*\(/.test(file.content)) {
        findings.push({
          rule: "eval-usage",
          severity: "warning",
          file: file.path,
          message: "uses eval() — replace with explicit logic",
          fix: "llm",
        });
      }
      if (/NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|API_KEY)/.test(file.content)) {
        findings.push({
          rule: "public-secret-env",
          severity: "error",
          file: file.path,
          message: "a secret is exposed through a NEXT_PUBLIC_ variable",
          fix: "llm",
        });
      }
      // The platform's provider key must never appear in generated apps.
      if (/NVIDIA_API_KEY/.test(file.content) && !file.path.endsWith(".env.example")) {
        findings.push({
          rule: "platform-key-reference",
          severity: "error",
          file: file.path,
          message: "generated code references the platform's NVIDIA_API_KEY",
          fix: "llm",
        });
      }
    }
  }

  // --- plan coverage: pages, API routes, schema ----------------------
  for (const page of plan.pages) {
    const path =
      page.path === "/" ? "src/app/page.tsx" : `src/app${page.path}/page.tsx`;
    if (!paths.has(path)) {
      findings.push({
        rule: "missing-page",
        severity: "error",
        message: `planned page "${page.name}" (${page.path}) has no file at ${path}`,
        fix: "auto",
      });
    }
  }
  const schemaTables = new Set(inspectSchema(context));
  for (const table of plan.dataModel) {
    if (!paths.has(`src/app/api/${table.table}/route.ts`)) {
      findings.push({
        rule: "missing-api-route",
        severity: "error",
        message: `table "${table.table}" has no API route`,
        fix: "auto",
      });
    }
    if (paths.has("supabase/schema.sql") && !schemaTables.has(table.table)) {
      findings.push({
        rule: "missing-schema-table",
        severity: "warning",
        file: "supabase/schema.sql",
        message: `planned table "${table.table}" is not in schema.sql`,
        fix: "llm",
      });
    }
  }

  return findings;
}

/** True when nothing error-severity remains. */
export function checksPass(findings: CheckFinding[]): boolean {
  return !findings.some((finding) => finding.severity === "error");
}
