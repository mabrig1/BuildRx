import { pause } from "@/lib/agents/llm";
import type { Agent } from "@/lib/agents/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Deployment Agent: persists the generated files, records the
 * deployment, publishes the preview URL, and marks the project ready.
 * (Deterministic — no LLM involved.)
 */
export const deploymentAgent: Agent = {
  name: "deployment",
  async run(context, emit) {
    emit({
      type: "agent_start",
      agent: "deployment",
      message: "Deploying project…",
    });

    const previewUrl = `/api/preview/${context.projectId}`;

    if (context.persist && isSupabaseConfigured()) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      emit({
        type: "agent_log",
        agent: "deployment",
        message: `Saving ${context.files.size} files…`,
      });

      const rows = [...context.files.values()].map((file) => ({
        project_id: context.projectId,
        path: file.path,
        content: file.content,
        language: file.path.split(".").pop() ?? null,
      }));
      const { error: filesError } = await supabase
        .from("project_files")
        .upsert(rows, { onConflict: "project_id,path" });
      if (filesError) {
        throw new Error(`Failed to save files: ${filesError.message}`);
      }

      emit({
        type: "agent_log",
        agent: "deployment",
        message: "Publishing preview…",
      });

      const { error: projectError } = await supabase
        .from("projects")
        .update({ status: "ready", preview_url: previewUrl })
        .eq("id", context.projectId);
      if (projectError) {
        throw new Error(`Failed to update project: ${projectError.message}`);
      }

      await supabase.from("deployments").insert({
        project_id: context.projectId,
        triggered_by: context.userId,
        status: "live",
        url: previewUrl,
        completed_at: new Date().toISOString(),
      });

      // Leave a summary in the project chat.
      const plan = context.plan;
      await supabase.from("chat_messages").insert({
        project_id: context.projectId,
        role: "assistant",
        content: `🚀 **Build complete!** The agent team built **${plan?.appName ?? "your app"}** — ${context.files.size} files generated (${plan?.pages.length ?? 0} pages, ${plan?.dataModel.length ?? 0} tables). The live preview has been updated.`,
      });
    } else {
      await pause(600);
      emit({
        type: "agent_log",
        agent: "deployment",
        message: "Demo mode — publishing preview without persistence",
      });
    }

    context.previewUrl = previewUrl;
    emit({
      type: "agent_complete",
      agent: "deployment",
      message: `Deployed — preview live at ${previewUrl}`,
    });
  },
};
