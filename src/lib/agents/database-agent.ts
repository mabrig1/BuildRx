import {
  FILE_FORMAT_INSTRUCTIONS,
  canCallModel,
  degradedEvent,
  diagnoseModelFailure,
  emptyOutputFailure,
  outOfTimeNote,
  parseFileBlocks,
  pause,
  runAgentCompletion,
  stepBudgetMs,
} from "@/lib/agents/llm";
import type { Agent, AppPlan, GeneratedFile } from "@/lib/agents/types";

const SYSTEM = `You are the Database Agent in an automated app-building pipeline. Given a build plan's data model, you produce the database layer for a Supabase (PostgreSQL) project.

Generate exactly two files:
1. "supabase/schema.sql" — production-ready CREATE TABLE statements for every table in the plan. Include UUID primary keys, created_at/updated_at defaults, NOT NULL constraints, sensible foreign keys and indexes. Every user-owned table must include owner_id (or use the planned user_id), enable row level security, and define SELECT, INSERT, UPDATE, and DELETE policies scoped to auth.uid(). Do not merely enable RLS without policies.
2. "src/lib/database.types.ts" — TypeScript interfaces mirroring the tables (camelCase properties).

${FILE_FORMAT_INSTRUCTIONS}`;

function pgToTs(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("int") || t.includes("numeric") || t.includes("float"))
    return "number";
  if (t.includes("bool")) return "boolean";
  if (t.includes("json")) return "Record<string, unknown>";
  return "string";
}

function toCamel(snake: string) {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toPascal(snake: string) {
  const camel = toCamel(snake);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function columnsFor(plan: AppPlan, table: AppPlan["dataModel"][number]) {
  const ownerColumn = table.columns.some((column) => column.name === "owner_id")
    ? "owner_id"
    : table.columns.some((column) => column.name === "user_id")
      ? "user_id"
      : "owner_id";
  const columns = [...table.columns];
  if (!columns.some((column) => column.name === "id")) {
    columns.unshift({ name: "id", type: "uuid" });
  }
  if (!columns.some((column) => column.name === ownerColumn)) {
    columns.splice(1, 0, { name: ownerColumn, type: "uuid" });
  }
  if (!columns.some((column) => column.name === "created_at")) {
    columns.push({ name: "created_at", type: "timestamptz" });
  }
  return { columns, ownerColumn };
}

function foreignTable(plan: AppPlan, columnName: string): string | null {
  if (!columnName.endsWith("_id")) return null;
  const stem = columnName.slice(0, -3);
  return (
    plan.dataModel.find(
      (candidate) =>
        candidate.table === stem ||
        candidate.table === `${stem}s` ||
        candidate.table === `${stem}es`
    )?.table ?? null
  );
}

function mockFiles(plan: AppPlan): GeneratedFile[] {
  const sql = plan.dataModel
    .map((table) => {
      const { columns: plannedColumns, ownerColumn } = columnsFor(plan, table);
      const columns = plannedColumns
        .map((col) => {
          if (col.name === "id") return `  id uuid primary key default gen_random_uuid()`;
          if (col.name === ownerColumn)
            return `  ${ownerColumn} uuid not null references auth.users(id) on delete cascade`;
          if (col.name === "created_at")
            return `  created_at timestamptz not null default now()`;
          const references = foreignTable(plan, col.name);
          if (references) {
            return `  ${col.name} uuid not null references public.${references}(id) on delete cascade`;
          }
          return `  ${col.name} ${col.type} not null`;
        })
        .join(",\n");
      return `-- ${table.description}
create table public.${table.table} (
${columns}
);

create index ${table.table}_${ownerColumn}_idx on public.${table.table} (${ownerColumn});
alter table public.${table.table} enable row level security;

create policy "${table.table}_select_own" on public.${table.table}
  for select using (auth.uid() = ${ownerColumn});
create policy "${table.table}_insert_own" on public.${table.table}
  for insert with check (auth.uid() = ${ownerColumn});
create policy "${table.table}_update_own" on public.${table.table}
  for update using (auth.uid() = ${ownerColumn}) with check (auth.uid() = ${ownerColumn});
create policy "${table.table}_delete_own" on public.${table.table}
  for delete using (auth.uid() = ${ownerColumn});`;
    })
    .join("\n\n");

  const types = plan.dataModel
    .map((table) => {
      const { columns } = columnsFor(plan, table);
      const props = columns
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
      if (reason) {
        note = ` (${reason} — schema generated from the plan)`;
        emit(
          degradedEvent(
            "database",
            "Your database schema comes from the plan, not from a model.",
            diagnoseModelFailure(
              new Error(
                "The build budget ran out before this step could start a model call."
              )
            )
          )
        );
      } else await pause(700);
      files = mockFiles(plan);
    } else {
      try {
        const text = await runAgentCompletion({
          system: SYSTEM,
          prompt: `Data model:\n${JSON.stringify(plan.dataModel, null, 2)}\n\nApp: ${plan.appName} — ${plan.summary}`,
          maxTokens: 6000,
          role: "codegen",
          timeoutMs: stepBudgetMs(context),
        });
        files = parseFileBlocks(text);
        if (files.length === 0) {
          const failure = emptyOutputFailure(
            "The model's response contained no ===FILE:…===/===END=== blocks, so no schema could be read out of it."
          );
          note = ` (${failure.summary} — schema generated from the plan)`;
          emit(
            degradedEvent(
              "database",
              "Your database schema comes from the plan, not from a model.",
              failure
            )
          );
          files = mockFiles(plan);
        }
      } catch (error) {
        const failure = diagnoseModelFailure(error);
        note = ` (${failure.summary} — schema generated from the plan)`;
        emit(
          degradedEvent(
            "database",
            "Your database schema comes from the plan, not from a model.",
            failure
          )
        );
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
