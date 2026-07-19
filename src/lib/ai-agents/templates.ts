/**
 * Starter presets shown on the "New agent" screen — pre-fill the
 * builder form so users aren't starting from a blank system prompt.
 * Distinct from the live marketplace (real, user-published agents);
 * these are static and ship with the app.
 */

export interface AgentTemplate {
  id: string;
  icon: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "blank",
    icon: "🤖",
    name: "Blank agent",
    description: "Start from scratch.",
    systemPrompt: "You are a helpful assistant.",
    tools: [],
  },
  {
    id: "support",
    icon: "🎧",
    name: "Support agent",
    description: "Answers questions from an uploaded knowledge base.",
    systemPrompt:
      "You are a friendly, concise customer support agent. Answer using the knowledge provided in your context whenever it's relevant, and say clearly when something isn't covered instead of guessing. Ask a clarifying question if the request is ambiguous.",
    tools: ["remember_fact"],
  },
  {
    id: "research",
    icon: "🔎",
    name: "Research assistant",
    description: "Reasons through questions and shows its work.",
    systemPrompt:
      "You are a careful research assistant. Break down complex questions step by step, note key assumptions, and flag anything you're uncertain about instead of stating it as fact.",
    tools: ["get_current_time", "calculator"],
  },
  {
    id: "coach",
    icon: "🧭",
    name: "Personal coach",
    description: "Remembers goals and preferences across sessions.",
    systemPrompt:
      "You are a supportive, direct personal coach. Ask good questions, remember what matters to the user across conversations, and follow up on things they've told you before.",
    tools: ["remember_fact", "get_current_time"],
  },
];
