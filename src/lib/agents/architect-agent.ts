import { pause } from "@/lib/agents/llm";
import type { Agent, AppPlan, FounderOpsSpec } from "@/lib/agents/types";

interface Architecture {
  conventions: string[];
  fileMap: Array<{ path: string; purpose: string }>;
}

/** Deterministic architecture derived from the plan — always valid. */
export function fallbackArchitecture(
  plan: AppPlan,
  founderOps?: FounderOpsSpec
): Architecture {
  const fileMap: Array<{ path: string; purpose: string }> = [
    { path: "preview/index.html", purpose: "Self-contained static preview of the home page" },
    { path: "src/app/layout.tsx", purpose: "Root layout importing globals.css" },
    { path: "src/app/globals.css", purpose: "Tailwind directives and design tokens" },
    { path: "package.json", purpose: "Project manifest with Next.js, Tailwind, Supabase, and MongoDB dependencies" },
    { path: "postcss.config.mjs", purpose: "Tailwind v4 PostCSS build configuration" },
    { path: "tsconfig.json", purpose: "Strict Next.js TypeScript configuration with @/* path alias" },
    { path: ".env.example", purpose: "Documented Supabase and optional MongoDB environment variables" },
    { path: "src/lib/supabase/server.ts", purpose: "Authenticated server-side Supabase client" },
    { path: "src/lib/supabase/client.ts", purpose: "Browser Supabase client" },
    { path: "src/lib/mongodb.ts", purpose: "Optional server-only MongoDB Atlas client for document and job-state workloads" },
    { path: "src/lib/data.ts", purpose: "Authorized persistent CRUD helpers for every table" },
    { path: "supabase/schema.sql", purpose: "Tables, indexes, constraints, and owner-scoped RLS policies" },
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
      purpose: `Authenticated GET, POST, PATCH, and DELETE for ${table.table}`,
    });
  }
  const providerBoundaries = (founderOps?.infrastructure ?? [])
    .filter((item) => item.required)
    .map(
      (item) =>
        `${item.provider}: ${item.responsibility}; do not expand beyond this bounded role`
    );
  return {
    conventions: [
      "TypeScript throughout; Tailwind classes for styling",
      "Components are kebab-case files exporting a PascalCase function",
      "All records persist through Supabase; in-memory arrays and fake CRUD are forbidden",
      "All data access goes through src/lib/data.ts and verifies the authenticated user",
      "Every table owned by a user has indexes plus SELECT, INSERT, UPDATE, and DELETE RLS policies",
      "API routes validate input and return useful 400, 401, 404, and 500 responses",
      "Operational screens include loading, empty, validation, error, success, and retry states",
      "The first two product workflows must be complete from entry point to saved outcome",
      "Secrets stay server-side and are referenced by environment-variable name only",
      "MongoDB is optional and server-only; use it for document or job state while Supabase remains the authority for auth and relational ownership unless the plan explicitly requires otherwise",
      "Generated source must build cleanly with npm install, npm run typecheck, and npm run build before deployment",
      "External deployment, migration, billing, and destructive actions require explicit human approval",
      ...providerBoundaries,
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

    // Deterministic by design. The architecture is fully derived from
    // the plan — pages, components and tables each imply their file —
    // so a model call here would only add files the checks don't need,
    // at the cost of a slice of budget the UI and Coding steps do need.
    // On a free inference tier that trade is decisive: those two steps
    // are the ones that actually write the app.
    const architecture = fallbackArchitecture(plan, context.founderOps);
    context.architecture = formatArchitecture(architecture);

    await pause(200);
    emit({
      type: "agent_complete",
      agent: "architect",
      message: `Architecture set: ${architecture.fileMap.length} files, ${architecture.conventions.length} conventions`,
    });
  },
};
