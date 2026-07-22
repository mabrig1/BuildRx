import {
  extractJson,
  isLlmConfigured,
  pause,
  remainingBudgetMs,
  runAgentCompletion,
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

Keep the plan small and buildable: at most 4 pages, 6 components, 4 tables.`;

function mockPlan(prompt: string): AppPlan {
  const lower = prompt.toLowerCase();

  if (lower.includes("church")) {
    return {
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
  }

  const appName = lower.includes("coffee")
    ? "Brew & Bean"
    : lower.includes("task")
      ? "TaskFlow"
      : "My App";
  return {
    appName,
    summary: `A web app for: ${prompt.slice(0, 80)}`,
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
}

export const plannerAgent: Agent = {
  name: "planner",
  async run(context, emit) {
    emit({
      type: "agent_start",
      agent: "planner",
      message: "Analyzing requirements…",
    });

    if (!isLlmConfigured()) {
      await pause(600);
      context.plan = mockPlan(context.prompt);
    } else {
      const text = await runAgentCompletion({
        system: SYSTEM,
        prompt: `Build plan for this app request:\n\n${context.prompt}`,
        maxTokens: 4096,
        role: "reasoning",
        timeoutMs: remainingBudgetMs(context.deadlineAt),
      });
      context.plan = extractJson<AppPlan>(text);
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
      message: plan.summary,
    });
  },
};
