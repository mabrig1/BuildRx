import {
  canCallModel,
  extractJson,
  fallbackReason,
  outOfTimeNote,
  pause,
  runAgentCompletion,
  stepBudgetMs,
} from "@/lib/agents/llm";
import type { Agent, AppPlan } from "@/lib/agents/types";

const SYSTEM = `You are the Planner Agent in an automated app-building pipeline. You turn a user's app description into a precise build plan the other agents (UI, Database, Coding) execute.

Respond with ONLY a JSON object, no prose, matching:
{
  "appName": string,
  "summary": string (one sentence),
  "pages": [{ "name": string, "path": string (route like "/" or "/about"), "description": string }],
  "components": [{ "name": string (PascalCase), "description": string }],
  "dataModel": [{ "table": string (snake_case), "description": string, "columns": [{ "name": string, "type": string (postgres type) }] }],
  "features": [string]
}

Keep the plan small and buildable: at most 4 pages, 6 components, 4 tables.

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

  if (pages.length > 0) result.pages = pages.slice(0, 4);
  if (components.length > 0) result.components = components.slice(0, 6);
  if (dataModel.length > 0) result.dataModel = dataModel.slice(0, 4);
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

  if (lower.includes("church")) {
    const church: AppPlan = {
      appName: "Grace Community Church",
      summary:
        "A welcoming church website with service times, sermons, and upcoming events.",
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
    pages: [
      { name: "Home", path: "/", description: "Landing page with hero and features" },
      { name: "About", path: "/about", description: "About page" },
    ],
    components: [
      { name: "Hero", description: "Hero section with headline and CTA" },
      { name: "FeatureGrid", description: "Three-column feature grid" },
    ],
    dataModel: [
      {
        table: "items",
        description: "Core content items",
        columns: [
          { name: "id", type: "uuid" },
          { name: "title", type: "text" },
          { name: "created_at", type: "timestamptz" },
        ],
      },
    ],
    features: ["Responsive layout", "Modern design", "Fast page loads"],
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
      4,
      (page) => typeof page?.path === "string" && page.path.startsWith("/")
    ),
    components: list(
      plan?.components,
      base.components,
      6,
      (component) => typeof component?.name === "string" && /^\w+$/.test(component.name)
    ),
    dataModel: list(
      plan?.dataModel,
      base.dataModel,
      4,
      (table) => typeof table?.table === "string" && Array.isArray(table?.columns)
    ),
    features: list(
      plan?.features,
      base.features,
      8,
      (feature) => typeof feature === "string"
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
      if (reason) note = ` (${reason} — planned from a built-in template instead)`;
      else await pause(600);
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
        note = ` (${fallbackReason(error)} — planned from a built-in template instead)`;
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
