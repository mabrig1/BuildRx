import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, describe, expect, it } from "vitest";

import { checksPass, runStaticChecks } from "@/lib/agents/checks";
import { runWorkflow } from "@/lib/agents/orchestrator";
import type {
  AgentEvent,
  WorkflowContext,
} from "@/lib/agents/types";

const execFileAsync = promisify(execFile);
const generatedRoots: string[] = [];

const CERTIFICATION_PROMPT = `Build a secure statistical analysis web app for researchers.

Pages:
- Overview: project status, dataset health, and recent analyses
- Projects: searchable research projects
- Data: import CSV data, inspect variables, and resolve validation warnings
- Analysis: configure regression, ANOVA, correlation, and t-tests
- Results: review saved statistical outputs and interpretations
- Reports: compose and export publication-ready reports

Components:
WorkspaceShell, DatasetUploader, VariableInspector, DataGrid, AnalysisBuilder, AssumptionChecklist, ResultsTable, ResultChart, ReportComposer

Tables:
- projects (id, owner_id, name, status, created_at)
- datasets (id, owner_id, project_id, name, row_count, validation_status, created_at)
- analyses (id, owner_id, project_id, method, status, created_at)
- results (id, owner_id, analysis_id, summary, result_json, created_at)
- reports (id, owner_id, project_id, title, format, created_at)

Use authenticated ownership, persistent CRUD, loading/error/empty/success states, and a Vercel-ready production build.
`;

function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function runNpm(
  args: string[],
  cwd: string,
  timeout = 300_000
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(npmExecutable(), args, {
      cwd,
      timeout,
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        CI: "1",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });

    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch (error) {
    const failure = error as Error & {
      stdout?: string;
      stderr?: string;
      code?: string | number;
      signal?: string;
    };
    throw new Error(
      [
        `Command failed: npm ${args.join(" ")}`,
        `cwd: ${cwd}`,
        failure.code !== undefined ? `exit: ${String(failure.code)}` : "",
        failure.signal ? `signal: ${failure.signal}` : "",
        failure.stdout ? `stdout:\n${failure.stdout}` : "",
        failure.stderr ? `stderr:\n${failure.stderr}` : "",
        `error: ${failure.message}`,
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  }
}

async function materializeGeneratedApp(
  context: WorkflowContext
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "buildrx-certified-app-"));
  generatedRoots.push(root);

  for (const file of context.files.values()) {
    const destination = path.join(root, file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.content, "utf8");
  }

  return root;
}

afterAll(async () => {
  await Promise.all(
    generatedRoots.map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe("Generated App Certification", () => {
  it("generates, installs, typechecks, and production-builds a clean app", async () => {
    const events: AgentEvent[] = [];
    const context: WorkflowContext = {
      projectId: "generated-app-certification",
      userId: null,
      prompt: CERTIFICATION_PROMPT,
      persist: false,
      files: new Map(),
    };

    await runWorkflow(context, (event) => events.push(event));

    expect(context.plan, "The pipeline must produce an application plan").toBeDefined();
    expect(context.files.size, "The pipeline must produce application files").toBeGreaterThan(15);

    const pipelineErrors = events.filter((event) => event.type === "error");
    expect(
      pipelineErrors,
      `The fallback pipeline emitted errors:\n${pipelineErrors
        .map((event) => JSON.stringify(event))
        .join("\n")}`
    ).toEqual([]);

    const findings = runStaticChecks(context, context.plan!);
    const blockingFindings = findings.filter(
      (finding) => finding.severity === "error"
    );
    expect(
      checksPass(findings),
      `Generated app failed BuildRx static QA:\n${blockingFindings
        .map((finding) => `[${finding.rule}] ${finding.file ?? ""} ${finding.message}`)
        .join("\n")}`
    ).toBe(true);

    for (const requiredPath of [
      "package.json",
      "tsconfig.json",
      "postcss.config.mjs",
      "src/app/page.tsx",
      "src/app/layout.tsx",
      "src/app/globals.css",
      "src/lib/mongodb.ts",
      "src/lib/supabase/server.ts",
      "supabase/schema.sql",
      "docs/RELEASE-CHECKLIST.md",
    ]) {
      expect(
        context.files.has(requiredPath),
        `Generated app is missing required release artifact: ${requiredPath}`
      ).toBe(true);
    }

    const packageJson = JSON.parse(
      context.files.get("package.json")!.content
    ) as {
      engines?: { node?: string };
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.engines?.node).toBe("22.x");
    expect(packageJson.scripts?.typecheck).toBe("tsc --noEmit");
    expect(packageJson.scripts?.build).toBe("next build");
    expect(packageJson.dependencies?.mongodb).toBeDefined();
    expect(packageJson.devDependencies?.["@tailwindcss/postcss"]).toBeDefined();

    const root = await materializeGeneratedApp(context);

    await runNpm(
      ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
      root
    );
    await runNpm(["run", "typecheck"], root);
    const build = await runNpm(["run", "build"], root);

    expect(
      build.stdout + build.stderr,
      "Next.js production build did not report successful compilation"
    ).toMatch(/(?:Compiled successfully|Creating an optimized production build)/i);
  });
});
