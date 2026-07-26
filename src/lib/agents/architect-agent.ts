import {
  canCallModel,
  extractJson,
  fallbackReason,
  pause,
  runAgentCompletion,
  stepBudgetMs,
} from "@/lib/agents/llm";
import type { Agent, AppPlan } from "@/lib/agents/types";

const SYSTEM = `You are the Architect Agent in an automated app-building pipeline. Given a build plan, you decide how the app is structured so the generating agents produce code that fits together.

Respond with ONLY a JSON object, no prose:
{
  "conventions": [string]   // 3-6 concrete rules, e.g. naming, state handling, where data access lives
  "fileMap": [{ "path": string, "purpose": string }]  // every file the app needs, Next.js App Router layout
}

Rules: paths are relative (src/app/..., src/components/..., src/lib/..., supabase/...). Keep it minimal — no test scaffolding, no config beyond package.json. Finish the object; a complete small answer beats a detailed one that gets cut off.`;

interface Architecture {
  conventions: string[];
  fileMap: Array<{ path: string; purpose: string }>;
}

/** Deterministic architecture derived from the plan — always valid. */
export function fallbackArchitecture(plan: AppPlan): Architecture {
  const fileMap: Array<{ path: string; purpose: string }> = [
    { path: "preview/index.html", purpose: "Self-contained static preview of the home page" },
    { path: "src/app/layout.tsx", purpose: "Root layout importing globals.css" },
    { path: "src/app/globals.css", purpose: "Tailwind directives and design tokens" },
    { path: "package.json", purpose: "Project manifest with next/react/tailwind" },
    { path: "src/lib/data.ts", purpose: "Data access helpers for every table" },
    { path: "supabase/schema.sql", purpose: "CREATE TABLE statements with RLS" },
    { path: "src/lib/database.types.ts", purpose: "TypeScript interfaces mirroring the tables" },
  ];
  for (const page of plan.pages) {
    fileMap.push({
      path: page.path === "/" ? "src/app/page.tsx" : `src/app${page.path}/page.tsx`,
      purpose: page.description,
    });
  }
  for (const component of plan.components) {
    const kebab = component.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    fileMap.push({ path: `src/components/${kebab}.tsx`, purpose: component.description });
  }
  for (const table of plan.dataModel) {
    fileMap.push({
      path: `src/app/api/${table.table}/route.ts`,
      purpose: `GET list + POST create for ${table.table}`,
    });
  }
  return {
    conventions: [
      "TypeScript throughout; Tailwind classes for styling",
      "Components are kebab-case files exporting a PascalCase function",
      "All data access goes through src/lib/data.ts",
      "API routes validate the request body before writing",
    ],
    fileMap,
  };
}

function formatArchitecture(architecture: Architecture): string {
  return [
    "Conventions:",
    ...architecture.conventions.map((rule) => `- ${rule}`),
    "",
    "File map (generate exactly these paths):",
    ...architecture.fileMap.map((file) => `- ${file.path} — ${file.purpose}`),
  ].join("\n");
}

export const architectAgent: Agent = {
  name: "architect",
  async run(context, emit) {
    emit({
      type: "agent_start",
      agent: "architect",
      message: "Designing the architecture…",
    });
    const plan = context.plan!;

    let architecture = fallbackArchitecture(plan);
    let note = "";
    if (canCallModel(context)) {
      try {
        const text = await runAgentCompletion({
          system: SYSTEM,
          prompt: `Build plan:\n${JSON.stringify(plan, null, 2)}`,
          maxTokens: 3000,
          role: "deep-reasoning",
          timeoutMs: stepBudgetMs(context),
        });
        const parsed = extractJson<Partial<Architecture>>(text);
        // Merge over the deterministic base: the model refines the file
        // map, it can't remove the structure later checks require.
        const base = fallbackArchitecture(plan);
        const paths = new Set(base.fileMap.map((file) => file.path));
        const extra = (parsed.fileMap ?? []).filter(
          (file) => typeof file?.path === "string" && !paths.has(file.path)
        );
        architecture = {
          conventions:
            Array.isArray(parsed.conventions) && parsed.conventions.length > 0
              ? parsed.conventions.slice(0, 6).filter((c) => typeof c === "string")
              : base.conventions,
          fileMap: [...base.fileMap, ...extra.slice(0, 20)],
        };
      } catch (error) {
        note = ` (${fallbackReason(error)} — used the standard architecture)`;
      }
    } else {
      await pause(400);
    }

    context.architecture = formatArchitecture(architecture);
    emit({
      type: "agent_complete",
      agent: "architect",
      message: `Architecture set: ${architecture.fileMap.length} files, ${architecture.conventions.length} conventions${note}`,
    });
  },
};
