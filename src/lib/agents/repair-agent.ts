import { checksPass, runStaticChecks } from "@/lib/agents/checks";
import {
  FILE_FORMAT_INSTRUCTIONS,
  canCallModel,
  parseFileBlocks,
  runAgentCompletion,
  stepBudgetMs,
} from "@/lib/agents/llm";
import {
  TOOL_LIMITS,
  ensureDependency,
  readFile,
  writeFile,
} from "@/lib/agents/tools";
import type {
  Agent,
  AppPlan,
  CheckFinding,
  EmitFn,
  WorkflowContext,
} from "@/lib/agents/types";

const SYSTEM = `You are the Repair Agent in an automated app-building pipeline. You receive files with verified defects and output CORRECTED full files. Fix only what the findings describe. For product-depth findings such as shallow-preview, placeholder-page, ephemeral-data-layer, or missing-rls-policies, replace the shallow implementation with a complete production workflow that follows the supplied product plan. Never repair persistence with module arrays or enable RLS without owner-scoped policies. Output nothing for files you cannot improve.

${FILE_FORMAT_INSTRUCTIONS}`;

function toPascal(name: string) {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Deterministic fix for one finding. Returns a short description of what
 * was done, or null when this finding needs the model (or a human).
 */
function applyAutoFix(
  context: WorkflowContext,
  plan: AppPlan,
  finding: CheckFinding
): string | null {
  switch (finding.rule) {
    case "missing-layout":
      writeFile(
        context,
        "src/app/layout.tsx",
        `import "./globals.css";

export const metadata = { title: "${plan.appName}" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
`
      );
      return "created src/app/layout.tsx";

    case "missing-globals-css":
      writeFile(context, "src/app/globals.css", `@import "tailwindcss";\n`);
      return "created src/app/globals.css";

    case "missing-home-page":
      writeFile(
        context,
        "src/app/page.tsx",
        `export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">${plan.appName}</h1>
      <p className="mx-auto mt-4 max-w-xl text-zinc-600">${plan.summary}</p>
    </main>
  );
}
`
      );
      return "created src/app/page.tsx";

    case "missing-preview":
      writeFile(
        context,
        "preview/index.html",
        `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${plan.appName}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;color:#18181b}.hero{text-align:center;padding:96px 24px}.hero p{color:#71717a;max-width:560px;margin:16px auto}</style>
</head>
<body><section class="hero"><h1>${plan.appName}</h1><p>${plan.summary}</p></section></body>
</html>
`
      );
      return "created preview/index.html";

    case "missing-package-json":
    case "invalid-package-json":
      writeFile(
        context,
        "package.json",
        `${JSON.stringify(
          {
            name: plan.appName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            version: "0.1.0",
            private: true,
            engines: { node: "22.x" },
            scripts: {
              dev: "next dev",
              build: "next build",
              start: "next start",
              typecheck: "tsc --noEmit",
            },
            dependencies: {
              "@supabase/ssr": "^0.7.0",
              "@supabase/supabase-js": "^2.50.0",
              mongodb: "^7.6.0",
              next: "^15.0.0",
              react: "^19.0.0",
              "react-dom": "^19.0.0",
            },
            devDependencies: {
              "@tailwindcss/postcss": "^4.1.0",
              "@types/node": "^20.0.0",
              "@types/react": "^19.0.0",
              "@types/react-dom": "^19.0.0",
              tailwindcss: "^4.1.0",
              typescript: "^5.0.0",
            },
          },
          null,
          2
        )}\n`
      );
      return "regenerated package.json";

    case "missing-tailwind-postcss-package":
      return ensureDependency(
        context,
        "@tailwindcss/postcss",
        "^4.1.0"
      )
        ? 'declared dependency @tailwindcss/postcss'
        : null;

    case "missing-tailwind-postcss-config":
      writeFile(
        context,
        "postcss.config.mjs",
        `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`
      );
      return "created postcss.config.mjs";

    case "missing-build-script": {
      const pkg = readFile(context, "package.json");
      if (!pkg) return null;
      try {
        const parsed = JSON.parse(pkg.content);
        parsed.scripts = {
          dev: "next dev",
          start: "next start",
          ...parsed.scripts,
          build: "next build",
        };
        writeFile(context, "package.json", `${JSON.stringify(parsed, null, 2)}\n`);
        return "added build script to package.json";
      } catch {
        return null;
      }
    }

    case "missing-import": {
      // "imports "X" but no such file exists" — create a working stub at
      // the path the import resolves to, so the build links.
      const specifier = finding.message.match(/imports "([^"]+)"/)?.[1];
      if (!specifier || !finding.file) return null;
      let target: string;
      if (specifier.startsWith("@/")) {
        target = `src/${specifier.slice(2)}`;
      } else if (specifier.startsWith(".")) {
        const dir = finding.file.split("/").slice(0, -1);
        for (const part of specifier.split("/")) {
          if (part === "." || part === "") continue;
          if (part === "..") dir.pop();
          else dir.push(part);
        }
        target = dir.join("/");
      } else {
        return null;
      }
      if (target.endsWith(".css")) {
        writeFile(context, target, "");
        return `created ${target}`;
      }
      const path = /\.(tsx?|jsx?)$/.test(target) ? target : `${target}.tsx`;
      const name = toPascal(target.split("/").pop()!.replace(/\.\w+$/, "")) || "Stub";
      writeFile(
        context,
        path,
        `/** Stub created by the Repair Agent for an unresolved import. */
export function ${name}() {
  return null;
}

export default ${name};
`
      );
      return `created stub ${path}`;
    }

    case "undeclared-dependency": {
      const name = finding.message.match(/uses package "([^"]+)"/)?.[1];
      if (!name) return null;
      return ensureDependency(context, name) ? `declared dependency ${name}` : null;
    }

    case "missing-page": {
      const match = finding.message.match(/no file at (\S+)/);
      const path = match?.[1];
      const page = plan.pages.find(
        (p) => (p.path === "/" ? "src/app/page.tsx" : `src/app${p.path}/page.tsx`) === path
      );
      if (!path || !page) return null;
      writeFile(
        context,
        path,
        `export default function ${toPascal(page.name)}Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">${page.name}</h1>
      <p className="mt-3 text-zinc-600">${page.description}</p>
    </main>
  );
}
`
      );
      return `created ${path}`;
    }

    case "missing-schema": {
      const sql = plan.dataModel
        .map((table) => {
          const ownerColumn = table.columns.some((column) => column.name === "user_id")
            ? "user_id"
            : "owner_id";
          const plannedColumns = table.columns.some((column) => column.name === ownerColumn)
            ? table.columns
            : [...table.columns, { name: ownerColumn, type: "uuid" }];
          const columns = plannedColumns
            .map((column) => {
              if (column.name === "id") {
                return "  id uuid primary key default gen_random_uuid()";
              }
              if (column.name === "created_at") {
                return "  created_at timestamptz not null default now()";
              }
              if (column.name === ownerColumn) {
                return `  ${ownerColumn} uuid not null references auth.users(id) on delete cascade`;
              }
              return `  ${column.name} ${column.type}`;
            })
            .join(",\n");
          return `-- ${table.description}
create table public.${table.table} (
${columns}
);
create index ${table.table}_${ownerColumn}_idx on public.${table.table} (${ownerColumn});
alter table public.${table.table} enable row level security;
create policy "${table.table}_select_own" on public.${table.table} for select using (auth.uid() = ${ownerColumn});
create policy "${table.table}_insert_own" on public.${table.table} for insert with check (auth.uid() = ${ownerColumn});
create policy "${table.table}_update_own" on public.${table.table} for update using (auth.uid() = ${ownerColumn}) with check (auth.uid() = ${ownerColumn});
create policy "${table.table}_delete_own" on public.${table.table} for delete using (auth.uid() = ${ownerColumn});`;
        })
        .join("\n\n");
      writeFile(context, "supabase/schema.sql", `${sql}\n`);
      return `generated supabase/schema.sql (${plan.dataModel.length} table(s))`;
    }

    case "missing-api-route": {
      const table = finding.message.match(/table "([^"]+)"/)?.[1];
      if (!table) return null;
      const type = toPascal(table);
      writeFile(
        context,
        `src/app/api/${table}/route.ts`,
        `import { NextResponse } from "next/server";
import { create${type}, list${type} } from "@/lib/data";

export async function GET() {
  try {
    return NextResponse.json({ data: await list${type}() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    return NextResponse.json({ data: await create${type}(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 500 });
  }
}

export type ${type} = Record<string, unknown>;
`
      );
      return `created src/app/api/${table}/route.ts`;
    }

    case "hardcoded-nvidia-key":
    case "hardcoded-secret-key":
    case "hardcoded-jwt": {
      if (!finding.file) return null;
      const file = readFile(context, finding.file);
      if (!file) return null;
      const redacted = file.content
        .replace(/nvapi-[A-Za-z0-9_-]{20,}/g, "REDACTED")
        .replace(/sk-[A-Za-z0-9_-]{20,}/g, "REDACTED")
        .replace(
          /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g,
          "REDACTED"
        );
      writeFile(context, finding.file, redacted);
      return `redacted a hardcoded secret in ${finding.file}`;
    }

    default:
      return null;
  }
}

/** One model pass over the files that need a rewrite. */
async function applyLlmFixes(
  context: WorkflowContext,
  findings: CheckFinding[],
  emit: EmitFn
): Promise<number> {
  const byFile = new Map<string, CheckFinding[]>();
  for (const finding of findings) {
    if (finding.fix !== "llm" || !finding.file) continue;
    const list = byFile.get(finding.file) ?? [];
    list.push(finding);
    byFile.set(finding.file, list);
  }
  if (byFile.size === 0 || !canCallModel(context)) return 0;

  // Bounded: at most 4 files per pass, whole file contents included.
  const targets = [...byFile.entries()].slice(0, 4);
  const bundle = targets
    .map(([path, fileFindings]) => {
      const content = readFile(context, path)?.content ?? "";
      return `===FILE: ${path}===\n${content.slice(0, 6000)}\n===END===\nFindings for this file:\n${fileFindings.map((f) => `- ${f.message}`).join("\n")}`;
    })
    .join("\n\n");

  const text = await runAgentCompletion({
    system: SYSTEM,
    prompt: `Product plan:\n${JSON.stringify(context.plan, null, 2)}\n\nOriginal request: ${context.prompt}\n\nFix these files:\n\n${bundle}`,
    role: "codegen",
    maxTokens: 6000,
    timeoutMs: stepBudgetMs(context),
  });

  let applied = 0;
  const allowed = new Set(targets.map(([path]) => path));
  for (const file of parseFileBlocks(text)) {
    if (!allowed.has(file.path) || file.content.trim().length === 0) continue;
    writeFile(context, file.path, file.content);
    emit({ type: "agent_log", agent: "repair", message: `Rewrote ${file.path}` });
    emit({ type: "file", agent: "repair", path: file.path });
    applied++;
  }
  return applied;
}

/**
 * Repair Agent — the autonomous FIX → RETEST half of the repair loop.
 *
 * Consumes the QA Agent's findings: deterministic fixes first (free and
 * reliable), then one bounded model pass for the files that need real
 * rewrites, then re-runs the full check suite. At most
 * TOOL_LIMITS.maxRepairRounds rounds, each bounded by the step budget —
 * recoverable errors get fixed without asking the user; whatever remains
 * is reported precisely instead of failing the build.
 */
export const repairAgent: Agent = {
  name: "repair",
  async run(context, emit) {
    const plan = context.plan!;
    let findings = context.findings ?? runStaticChecks(context, plan);

    if (checksPass(findings)) {
      emit({ type: "agent_start", agent: "repair", message: "Checking for repairs…" });
      emit({
        type: "agent_complete",
        agent: "repair",
        message: "Nothing to repair — all checks green",
      });
      return;
    }

    emit({
      type: "agent_start",
      agent: "repair",
      message: `Repairing ${findings.filter((f) => f.severity === "error").length} issue(s)…`,
    });

    const errorCount = (list: CheckFinding[]) =>
      list.filter((finding) => finding.severity === "error").length;

    let totalFixes = 0;
    for (let round = 1; round <= TOOL_LIMITS.maxRepairRounds; round++) {
      // Checkpoint before touching anything: a repair round must never
      // leave the build worse than it found it. If the round increases
      // the error count (an LLM rewrite that broke a working file, say),
      // every change it made is rolled back and the loop stops.
      const checkpoint = new Map(context.files);
      const before = errorCount(findings);
      // Deterministic fixes.
      for (const finding of findings) {
        if (finding.fix !== "auto") continue;
        try {
          const fixed = applyAutoFix(context, plan, finding);
          if (fixed) {
            totalFixes++;
            emit({ type: "agent_log", agent: "repair", message: `Fixed: ${fixed}` });
          }
        } catch (error) {
          // A tool limit mid-repair means stop fixing, not fail the build.
          emit({
            type: "agent_log",
            agent: "repair",
            message: `Stopped: ${error instanceof Error ? error.message : "tool limit"}`,
          });
          break;
        }
      }

      // Model rewrites for what determinism can't fix.
      try {
        totalFixes += await applyLlmFixes(context, findings, emit);
      } catch {
        // Model unavailable — the deterministic fixes still count.
      }

      // RETEST.
      const retested = runStaticChecks(context, plan);
      if (errorCount(retested) > before) {
        context.files.clear();
        for (const [path, file] of checkpoint) context.files.set(path, file);
        context.findings = findings;
        emit({
          type: "agent_log",
          agent: "repair",
          message: `Round ${round} made things worse (${before} → ${errorCount(retested)} errors) — rolled back to the checkpoint`,
        });
        break;
      }

      findings = retested;
      context.findings = findings;
      if (checksPass(findings)) break;
    }

    const remaining = findings.filter((finding) => finding.severity === "error");
    emit({
      type: "agent_complete",
      agent: "repair",
      message: checksPass(findings)
        ? `Applied ${totalFixes} fix(es) — all checks now pass`
        : `Applied ${totalFixes} fix(es); ${remaining.length} issue(s) remain: ${remaining
            .slice(0, 3)
            .map((f) => f.message)
            .join("; ")}`,
    });
  },
};
