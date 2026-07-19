/**
 * Loads an agent's runtime config — system prompt (with knowledge files
 * and remembered facts folded in), provider, model, and enabled tools.
 * Shared by the agent chat route and the workflow "agent_run" step so
 * a workflow-triggered agent turn behaves identically to a chat turn.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiProviderId } from "@/lib/ai/providers/types";
import type { Database } from "@/types/database";

/** Agents can attach a lot of knowledge; cap what's folded into the system prompt. */
export const KNOWLEDGE_CHAR_BUDGET = 6000;
export const MEMORY_LIMIT = 20;

export interface AgentRuntimeConfig {
  id: string;
  systemPrompt: string;
  provider: AiProviderId;
  model: string;
  tools: string[];
}

/** Returns null when the agent doesn't exist or isn't visible to this caller (RLS-enforced via the passed client). */
export async function loadAgentRuntimeConfig(
  supabase: SupabaseClient<Database>,
  agentId: string,
  userId: string
): Promise<AgentRuntimeConfig | null> {
  const agentResult = await supabase
    .from("agents")
    .select("id, system_prompt, provider, model, tools")
    .eq("id", agentId)
    .maybeSingle();
  if (!agentResult.data) return null;
  const agent = agentResult.data;

  const knowledge = await supabase
    .from("agent_knowledge_files")
    .select("name, content")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  let knowledgeSection = "";
  let remaining = KNOWLEDGE_CHAR_BUDGET;
  for (const file of knowledge.data ?? []) {
    if (remaining <= 0) break;
    const chunk = `## ${file.name}\n${file.content}`.slice(0, remaining);
    knowledgeSection += `\n\n${chunk}`;
    remaining -= chunk.length;
  }

  const memories = await supabase
    .from("agent_memories")
    .select("content")
    .eq("agent_id", agentId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MEMORY_LIMIT);
  const memorySection = (memories.data ?? []).map((m) => `- ${m.content}`).join("\n");

  const systemPrompt = [
    agent.system_prompt,
    knowledgeSection ? `# Knowledge\n${knowledgeSection}` : "",
    memorySection ? `# Things you remember about this user\n${memorySection}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    id: agent.id,
    systemPrompt,
    provider: agent.provider,
    model: agent.model,
    tools: Array.isArray(agent.tools) ? (agent.tools as string[]) : [],
  };
}
