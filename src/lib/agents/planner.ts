import {
  canCallModel,
  degradedEvent,
  diagnoseModelFailure,
  extractJson,
  outOfTimeNote,
  pause,
  runAgentCompletion,
  stepBudgetMs,
} from "@/lib/agents/llm";
import type { Agent, AppPlan } from "@/lib/agents/types";

const SYSTEM = `You are the Planner Agent in an automated app-building pipeline. You turn a user's app description into a precise build plan the other agents (UI, Database, Coding) execute.

Your job is to plan a credible production MVP, never a landing-page mock-up. Infer the user's domain, primary users, permissions, records, and complete workflows. Every core workflow must have a place to start, enter or import data, review results, recover from errors, and reach a useful outcome. Prefer a smaller end-to-end vertical product over many decorative pages.

Respond with ONLY a JSON object, no prose, matching:
{
  "appName": string,
  "summary": string (one sentence),
  "userRoles": [{ "name": string, "permissions": [string] }],
  "workflows": [{ "name": string, "actor": string, "steps": [string], "outcome": string }],
  "pages": [{ "name": string, "path": string (route like "/" or "/about"), "description": string }],
  "components": [{ "name": string (PascalCase), "description": string }],
  "dataModel": [{ "table": string (snake_case), "description": string, "columns": [{ "name": string, "type": string (postgres type) }] }],
  "features": [string],
  "acceptanceCriteria": [string],
  "qualityRequirements": [string]
}

Plan 4-7 purposeful pages, at most 12 components, 7 tables, 4 user roles, and 5 core workflows. Include authentication when records belong to users. Include search/filter, validation, loading, empty, error and success states where relevant. Acceptance criteria must be testable and describe behavior, not appearance.

Output the JSON object and nothing else — no code fence, no commentary, and no reasoning before or after it. Finish the object: a complete small plan beats a detailed one that gets cut off.`;

function toKebabPath(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug === "home" || slug === "" ? "/" : `/${slug}`;
}

function toPascalName(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Strips markdown emphasis from a fragment. Underscores are deliberately
 * kept: column and table names are snake_case, and stripping them turned
 * "user_id" into "userid" — a silently wrong schema.
 */
function clean(value: string): string {
  return value.replace(/[*`#]+/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Reads the structure the user actually wrote.
 *
 * The guide tells people to name their pages, components, and tables —
 * so when the model is unavailable, that structure is still right there
 * in the prompt and parsing it beats ignoring it. A prompt written to
 * the documented shape produces a real plan with no model at all.
 */
export function parsePromptStructure(prompt: string): Partial<AppPlan> {
  const lines = prompt.split(/\r?\n/);
  const result: Partial<AppPlan> = {};
  let section: "pages" | "components" | "tables" | null = null;

  const pages: AppPlan["pages"] = [];
  const components: AppPlan["components"] = [];
  const dataModel: AppPlan["dataModel"] = [];

  const inlineList = (value: string) =>
    value
      .split(/[,;]/)
      .map(clean)
      .filter(Boolean);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^\**\s*(pages?|components?|tables?|data\s*model)\s*\**\s*:?\s*(.*)$/i);
    if (heading && !line.startsWith("-")) {
      const kind = heading[1].toLowerCase();
      section = kind.startsWith("page")
        ? "pages"
        : kind.startsWith("component")
          ? "components"
          : "tables";
      // "Components: UploadZone, ToolCard" — inline form.
      const rest = heading[2]?.trim();
      if (rest) {
        for (const item of inlineList(rest)) {
          if (section === "components") {
            components.push({ name: toPascalName(item), description: item });
          } else if (section === "tables") {
            const name = item.split(/[\s(]/)[0];
            if (name) {
              dataModel.push({
                table: name.toLowerCase(),
                description: item,
                columns: [{ name: "id", type: "uuid" }],
              });
            }
          }
        }
      }
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (!bullet || !section) continue;
    const body = bullet[1];

    if (section === "pages") {
      const [namePart, ...descParts] = body.split(":");
      const name = clean(namePart);
      if (!name) continue;
      pages.push({
        name,
        path: toKebabPath(name),
        description: clean(descParts.join(":")) || name,
      });
    } else if (section === "components") {
      for (const item of inlineList(body)) {
        components.push({ name: toPascalName(item), description: item });
      }
    } else {
      // "- documents (id, user_id, filename, created_at)"
      const match = body.match(/^([a-zA-Z_][\w]*)\s*\(([^)]*)\)/);
      if (!match) continue;
      const columns = match[2]
        .split(",")
        .map((column) => clean(column))
        .filter(Boolean)
        .map((column) => {
          const name = column.split(/\s+/)[0];
          const type = /_at$/.test(name)
            ? "timestamptz"
            : name === "id"
              ? "uuid"
              : /_id$/.test(name)
                ? "uuid"
                : /count|size|price|quantity|_cents$/.test(name)
                  ? "integer"
                  : /^is_|^has_|done|active|enabled/.test(name)
                    ? "boolean"
                    : "text";
          return { name, type };
        });
      dataModel.push({
        table: match[1].toLowerCase(),
        description: `Records for ${match[1]}`,
        columns: columns.length > 0 ? columns : [{ name: "id", type: "uuid" }],
      });
    }
  }

  if (pages.length > 0) result.pages = pages.slice(0, 7);
  if (components.length > 0) result.components = components.slice(0, 12);
  if (dataModel.length > 0) result.dataModel = dataModel.slice(0, 7);
  return result;
}

/** First sentence of the request, cleaned up for use as a summary. */
function summaryFromPrompt(prompt: string): string {
  const firstLine = clean(prompt.split(/\r?\n/)[0] ?? "");
  const sentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine;
  const trimmed = sentence.length > 140 ? `${sentence.slice(0, 137)}…` : sentence;
  return trimmed || "A web app built from your description.";
}

/**
 * Deterministic plan derived from the prompt. Used in mock mode, and as
 * the planner's fallback — every later step reads `context.plan`, so the
 * pipeline can survive anything except having no plan at all.
 *
 * Structure the user wrote explicitly (Pages / Components / Tables) is
 * parsed out and used; only what's missing is filled from a template.
 */
export function fallbackPlan(prompt: string): AppPlan {
  const lower = prompt.toLowerCase();
  const parsed = parsePromptStructure(prompt);

  if (/statistic|analysis|dataset|survey|regression|anova|spss/.test(lower)) {
    const statistics: AppPlan = {
      appName: "InsightLab",
      summary:
        "A secure statistical-analysis workspace for importing datasets, running guided analyses, and exporting publication-ready results.",
      userRoles: [
        {
          name: "Researcher",
          permissions: [
            "manage own projects and datasets",
            "run analyses",
            "export reports",
          ],
        },
        {
          name: "Administrator",
          permissions: ["manage users", "view system health and usage"],
        },
      ],
      workflows: [
        {
          name: "Import and validate a dataset",
          actor: "Researcher",
          steps: [
            "create a project",
            "upload CSV or paste tabular data",
            "review inferred variable types",
            "resolve missing-value warnings",
            "save the validated dataset",
          ],
          outcome: "A reusable, validated dataset is ready for analysis",
        },
        {
          name: "Run an analysis",
          actor: "Researcher",
          steps: [
            "choose an analysis method",
            "select dependent and independent variables",
            "review assumptions",
            "run the analysis",
            "inspect tables, charts, and interpretation",
          ],
          outcome: "Reproducible statistical results are saved to the project",
        },
        {
          name: "Export findings",
          actor: "Researcher",
          steps: [
            "select result sections",
            "choose APA or report format",
            "preview the report",
            "download the export",
          ],
          outcome: "A publication-ready report is downloaded",
        },
      ],
      pages: [
        {
          name: "Overview",
          path: "/",
          description:
            "Workspace dashboard with recent projects, dataset health, analysis activity, and primary actions",
        },
        {
          name: "Projects",
          path: "/projects",
          description:
            "Searchable project library with create, duplicate, archive, and ownership controls",
        },
        {
          name: "Data Workspace",
          path: "/data",
          description:
            "CSV upload and paste flow, variable inspector, data grid, validation warnings, and missing-value tools",
        },
        {
          name: "Analysis Studio",
          path: "/analysis",
          description:
            "Guided selection for descriptive statistics, correlation, regression, t-test and ANOVA with assumptions",
        },
        {
          name: "Results",
          path: "/results",
          description:
            "Saved outputs with statistical tables, charts, interpretations, confidence intervals, and effect sizes",
        },
        {
          name: "Reports",
          path: "/reports",
          description:
            "Report composer with APA-ready narrative, selected outputs, preview, and Word/PDF export actions",
        },
      ],
      components: [
        { name: "WorkspaceShell", description: "Responsive product navigation and project context" },
        { name: "DatasetUploader", description: "Drag-and-drop CSV and pasted-data importer with progress" },
        { name: "VariableInspector", description: "Variable type, label, missing-value and measurement-level editor" },
        { name: "DataGrid", description: "Virtualized searchable dataset table" },
        { name: "AnalysisBuilder", description: "Method and variable configuration panel with validation" },
        { name: "AssumptionChecklist", description: "Analysis assumptions with pass, warning and remediation states" },
        { name: "ResultsTable", description: "Accessible statistical output table" },
        { name: "ResultChart", description: "Responsive visualization for the selected analysis" },
        { name: "ReportComposer", description: "Reorderable report sections and export settings" },
      ],
      dataModel: [
        {
          table: "projects",
          description: "Research workspaces owned by a user",
          columns: [
            { name: "id", type: "uuid" },
            { name: "owner_id", type: "uuid" },
            { name: "name", type: "text" },
            { name: "status", type: "text" },
            { name: "created_at", type: "timestamptz" },
          ],
        },
        {
          table: "datasets",
          description: "Uploaded dataset metadata and validation state",
          columns: [
            { name: "id", type: "uuid" },
            { name: "owner_id", type: "uuid" },
            { name: "project_id", type: "uuid" },
            { name: "name", type: "text" },
            { name: "row_count", type: "integer" },
            { name: "validation_status", type: "text" },
            { name: "created_at", type: "timestamptz" },
          ],
        },
        {
          table: "analyses",
          description: "Saved analysis configurations and execution status",
          columns: [
            { name: "id", type: "uuid" },
            { name: "owner_id", type: "uuid" },
            { name: "project_id", type: "uuid" },
            { name: "method", type: "text" },
            { name: "status", type: "text" },
            { name: "created_at", type: "timestamptz" },
          ],
        },
        {
          table: "results",
          description: "Structured statistical outputs and interpretations",
          columns: [
            { name: "id", type: "uuid" },
            { name: "owner_id", type: "uuid" },
            { name: "analysis_id", type: "uuid" },
            { name: "summary", type: "text" },
            { name: "result_json", type: "jsonb" },
            { name: "created_at", type: "timestamptz" },
          ],
        },
        {
          table: "reports",
          description: "Saved report configurations and export records",
          columns: [
            { name: "id", type: "uuid" },
            { name: "owner_id", type: "uuid" },
            { name: "project_id", type: "uuid" },
            { name: "title", type: "text" },
            { name: "format", type: "text" },
            { name: "created_at", type: "timestamptz" },
          ],
        },
      ],
      features: [
        "CSV upload and pasted-data import",
        "data validation and variable typing",
        "guided statistical methods",
        "saved reproducible analysis configurations",
        "interactive tables and charts",
        "APA narrative and Word/PDF report export",
        "project ownership and row-level security",
      ],
      acceptanceCriteria: [
        "A researcher can import a dataset and see validation feedback before saving",
        "An analysis cannot run until required variables and assumptions are satisfied",
        "Results include statistics, uncertainty, effect size where applicable, and a plain-language interpretation",
        "Saved projects, datasets, analyses, results, and reports persist per authenticated user",
        "Every data screen has loading, empty, error, and success states",
      ],
      qualityRequirements: [
        "responsive and keyboard accessible",
        "no fabricated statistical results",
        "server-side authorization for every mutation",
        "clear validation and recovery guidance",
      ],
    };
    return { ...statistics, ...parsed };
  }

  if (lower.includes("church")) {
    const church: AppPlan = {
      appName: "Grace Community Church",
      summary:
        "A welcoming church website with service times, sermons, and upcoming events.",
      userRoles: [{ name: "Visitor", permissions: ["view sermons and events"] }],
      workflows: [
        {
          name: "Find and watch a sermon",
          actor: "Visitor",
          steps: ["browse sermons", "filter by speaker or topic", "open a sermon"],
          outcome: "The visitor can watch or listen to the selected sermon",
        },
      ],
      pages: [
        { name: "Home", path: "/", description: "Hero with service times and welcome message" },
        { name: "About", path: "/about", description: "Our story, beliefs, and leadership" },
        { name: "Sermons", path: "/sermons", description: "Sermon archive with speaker and date" },
        { name: "Events", path: "/events", description: "Upcoming events calendar" },
      ],
      components: [
        { name: "Hero", description: "Hero with church name and service times" },
        { name: "EventList", description: "List of upcoming events" },
        { name: "SermonCard", description: "Sermon with title, speaker, and date" },
      ],
      dataModel: [
        {
          table: "events",
          description: "Upcoming church events",
          columns: [
            { name: "id", type: "uuid" },
            { name: "title", type: "text" },
            { name: "starts_at", type: "timestamptz" },
            { name: "location", type: "text" },
            { name: "created_at", type: "timestamptz" },
          ],
        },
        {
          table: "sermons",
          description: "Sermon archive",
          columns: [
            { name: "id", type: "uuid" },
            { name: "title", type: "text" },
            { name: "speaker", type: "text" },
            { name: "preached_on", type: "date" },
            { name: "created_at", type: "timestamptz" },
          ],
        },
      ],
      features: ["Service times", "Sermon archive", "Events calendar"],
      acceptanceCriteria: [
        "Visitors can find service information and open a sermon or event",
      ],
      qualityRequirements: ["responsive", "accessible", "fast loading"],
    };
    return { ...church, ...parsed };
  }

  const appName = lower.includes("coffee")
    ? "Brew & Bean"
    : lower.includes("task")
      ? "TaskFlow"
      : "My App";

  const base: AppPlan = {
    appName,
    summary: summaryFromPrompt(prompt),
    userRoles: [
      {
        name: "Member",
        permissions: ["manage own records", "search and filter records"],
      },
    ],
    workflows: [
      {
        name: "Manage the primary record",
        actor: "Member",
        steps: ["open the workspace", "create a record", "review it", "edit or archive it"],
        outcome: "The record is validated and persists for the signed-in member",
      },
    ],
    pages: [
      { name: "Workspace", path: "/", description: "Operational dashboard with records, status, search, filters, and primary actions" },
      { name: "Records", path: "/records", description: "Searchable record list with create, detail, edit, archive, loading, empty and error states" },
      { name: "Settings", path: "/settings", description: "Account and product preferences with validation and saved feedback" },
    ],
    components: [
      { name: "AppShell", description: "Responsive authenticated navigation and page context" },
      { name: "RecordTable", description: "Searchable and filterable record table with row actions" },
      { name: "RecordForm", description: "Validated create and edit form with loading, error and success states" },
      { name: "EmptyState", description: "Actionable empty state for first-time users" },
    ],
    dataModel: [
      {
        table: "items",
        description: "Core content items",
        columns: [
          { name: "id", type: "uuid" },
          { name: "owner_id", type: "uuid" },
          { name: "title", type: "text" },
          { name: "status", type: "text" },
          { name: "created_at", type: "timestamptz" },
        ],
      },
    ],
    features: ["Authentication", "Persistent CRUD", "Search and filters", "Validation", "Responsive product workspace"],
    acceptanceCriteria: [
      "A signed-in member can create, find, update, and archive their own records",
      "Records persist across refreshes and are isolated by owner",
      "Loading, empty, validation, error, and success states are visible and actionable",
    ],
    qualityRequirements: ["responsive", "keyboard accessible", "secure by default", "clear error recovery"],
  };

  // Anything the user spelled out wins over the template.
  return { ...base, ...parsed };
}

/**
 * The model's JSON is only as well-shaped as the model felt like making
 * it — a missing `pages` array or a 30-component plan both break the
 * steps downstream (one throws, the other can't finish in its time
 * slice). Fill what's missing from the deterministic plan and enforce
 * the size limits the prompt asks for.
 */
function normalizePlan(plan: Partial<AppPlan> | null, prompt: string): AppPlan {
  const base = fallbackPlan(prompt);
  const list = <T>(
    value: unknown,
    fallback: T[],
    limit: number,
    isValid: (item: T) => boolean = () => true
  ): T[] => {
    if (!Array.isArray(value)) return fallback;
    const kept = (value as T[]).filter(isValid).slice(0, limit);
    return kept.length > 0 ? kept : fallback;
  };

  return {
    appName:
      typeof plan?.appName === "string" && plan.appName.trim()
        ? plan.appName.trim()
        : base.appName,
    summary:
      typeof plan?.summary === "string" && plan.summary.trim()
        ? plan.summary.trim()
        : base.summary,
    pages: list(
      plan?.pages,
      base.pages,
      7,
      (page) => typeof page?.path === "string" && page.path.startsWith("/")
    ),
    components: list(
      plan?.components,
      base.components,
      12,
      (component) => typeof component?.name === "string" && /^\w+$/.test(component.name)
    ),
    dataModel: list(
      plan?.dataModel,
      base.dataModel,
      7,
      (table) => typeof table?.table === "string" && Array.isArray(table?.columns)
    ),
    features: list(
      plan?.features,
      base.features,
      12,
      (feature) => typeof feature === "string"
    ),
    userRoles: list(
      plan?.userRoles,
      base.userRoles ?? [],
      4,
      (role) => typeof role?.name === "string" && Array.isArray(role?.permissions)
    ),
    workflows: list(
      plan?.workflows,
      base.workflows ?? [],
      5,
      (workflow) =>
        typeof workflow?.name === "string" &&
        Array.isArray(workflow?.steps) &&
        workflow.steps.length > 0
    ),
    acceptanceCriteria: list(
      plan?.acceptanceCriteria,
      base.acceptanceCriteria ?? [],
      10,
      (criterion) => typeof criterion === "string"
    ),
    qualityRequirements: list(
      plan?.qualityRequirements,
      base.qualityRequirements ?? [],
      8,
      (requirement) => typeof requirement === "string"
    ),
  };
}

export const plannerAgent: Agent = {
  name: "planner",
  async run(context, emit) {
    emit({
      type: "agent_start",
      agent: "planner",
      message: "Analyzing requirements…",
    });

    let note = "";
    if (!canCallModel(context)) {
      const reason = outOfTimeNote(context);
      if (reason) {
        note = ` (${reason} — planned from a built-in template instead)`;
        emit(
          degradedEvent(
            "planner",
            "Your build plan is a built-in template, not one derived from your description.",
            diagnoseModelFailure(
              new Error(
                "The build budget ran out before this step could start a model call."
              )
            )
          )
        );
      } else await pause(600);
      context.plan = fallbackPlan(context.prompt);
    } else {
      try {
        const text = await runAgentCompletion({
          system: SYSTEM,
          prompt: `Build plan for this app request:\n\n${context.prompt}`,
          maxTokens: 6000,
          role: "deep-reasoning",
          timeoutMs: stepBudgetMs(context),
        });
        context.plan = normalizePlan(extractJson<AppPlan>(text), context.prompt);
      } catch (error) {
        const failure = diagnoseModelFailure(error);
        note = ` (${failure.summary} — planned from a built-in template instead)`;
        emit(
          degradedEvent(
            "planner",
            "Your build plan is a built-in template, not one derived from your description.",
            failure
          )
        );
        context.plan = fallbackPlan(context.prompt);
      }
    }

    const plan = context.plan;
    emit({
      type: "agent_log",
      agent: "planner",
      message: `Planned "${plan.appName}": ${plan.pages.length} pages, ${plan.components.length} components, ${plan.dataModel.length} tables`,
    });
    emit({
      type: "agent_complete",
      agent: "planner",
      message: `${plan.summary}${note}`,
    });
  },
};
