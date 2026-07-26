import {
  FILE_FORMAT_INSTRUCTIONS,
  canCallModel,
  fallbackReason,
  outOfTimeNote,
  parseFileBlocks,
  pause,
  runAgentCompletion,
  stepBudgetMs,
} from "@/lib/agents/llm";
import type { Agent, AppPlan, GeneratedFile } from "@/lib/agents/types";

const SYSTEM = `You are the Database Agent in an automated app-building pipeline. Given a build plan's data model, you produce the database layer for a Supabase (PostgreSQL) project.

Generate exactly two files:
1. "supabase/schema.sql" — CREATE TABLE statements for every table in the plan (uuid primary keys with gen_random_uuid(), created_at timestamptz defaults, sensible foreign keys), plus row level security enabled on each table with owner-scoped policies where a user_id column exists.
2. "src/lib/database.types.ts" — TypeScript interfaces mirroring the tables (camelCase properties).

${FILE_FORMAT_INSTRUCTIONS}`;

function pgToTs(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("int") || t.includes("numeric") || t.includes("float"))
    return "number";
  if (t.includes("bool")) return "boolean";
  return "string";
}

function toCamel(snake: string) {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toPascal(snake: string) {
  const camel = toCamel(snake);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function mockFiles(plan: AppPlan): GeneratedFile[] {
  const sql = plan.dataModel
    .map((table) => {
      const columns = table.columns
        .map((col) => {
          if (col.name === "id") return `  id uuid primary key default gen_random_uuid()`;
          if (col.name === "created_at")
            return `  created_at timestamptz not null default now()`;
          return `  ${col.name} ${col.type}`;
        })
        .join(",\n");
      return `-- ${table.description}\ncreate table public.${table.table} (\n${columns}\n);\n\nalter table public.${table.table} enable row level security;`;
    })
    .join("\n\n");

  const types = plan.dataModel
    .map((table) => {
      const props = table.columns
        .map((col) => `  ${toCamel(col.name)}: ${pgToTs(col.type)};`)
        .join("\n");
      return `export interface ${toPascal(table.table)} {\n${props}\n}`;
    })
    .join("\n\n");

  return [
    { path: "supabase/schema.sql", content: `${sql}\n` },
    { path: "src/lib/database.types.ts", content: `${types}\n` },
  ];
}

export const databaseAgent: Agent = {
  name: "database",
  async run(context, emit) {
    emit({
      type: "agent_start",
      agent: "database",
      message: "Designing database schema…",
    });
    const plan = context.plan!;

    let files: GeneratedFile[];
    let note = "";
    if (!canCallModel(context)) {
      const reason = outOfTimeNote(context);
      if (reason) note = ` (${reason} — schema generated from the plan)`;
      else await pause(700);
      files = mockFiles(plan);
    } else {
      try {
        const text = await runAgentCompletion({
          system: SYSTEM,
          prompt: `Data model:\n${JSON.stringify(plan.dataModel, null, 2)}\n\nApp: ${plan.appName} — ${plan.summary}`,
          maxTokens: 6000,
          role: "code",
          timeoutMs: stepBudgetMs(context),
        });
        files = parseFileBlocks(text);
        if (files.length === 0) {
          note = " (model returned no usable files — schema generated from the plan)";
          files = mockFiles(plan);
        }
      } catch (error) {
        note = ` (${fallbackReason(error)} — schema generated from the plan)`;
        files = mockFiles(plan);
      }
    }

    for (const file of files) {
      context.files.set(file.path, file);
      emit({ type: "file", agent: "database", path: file.path });
    }
    emit({
      type: "agent_complete",
      agent: "database",
      message: `Schema ready: ${plan.dataModel.map((t) => t.table).join(", ") || "no tables needed"}${note}`,
    });
  },
};
