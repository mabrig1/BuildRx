import { checksPass, runStaticChecks } from "@/lib/agents/checks";
import { pause } from "@/lib/agents/llm";
import { verifyPreviewResponds } from "@/lib/agents/tools";
import type { Agent, VerificationItem, WorkflowContext } from "@/lib/agents/types";
import { isNvidiaConfigured } from "@/lib/ai/nvidia";
import { getFileSystem } from "@/lib/files/manager";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * The completion checklist: every claim we can honestly verify from the
 * server before calling an app "done". Static claims come from the final
 * check-suite state; the preview claim is a real HTTP fetch of the
 * published preview. (A real `npm run build` of the generated app runs
 * client-side in the WebContainer preview — a serverless function can't
 * execute it, so the static suite is the server-side stand-in.)
 */
async function buildVerification(
  context: WorkflowContext
): Promise<VerificationItem[]> {
  const plan = context.plan!;
  const findings = context.findings ?? runStaticChecks(context, plan);
  const rules = (prefixes: string[]) =>
    findings.filter(
      (f) => f.severity === "error" && prefixes.some((p) => f.rule.startsWith(p))
    );

  const items: VerificationItem[] = [];

  const frontend = rules(["missing-preview", "missing-home-page", "missing-layout", "broken-file", "missing-import", "undeclared-dependency", "invalid-package-json", "missing-package-json", "missing-page"]);
  items.push({
    label: "Frontend builds (static checks)",
    status: frontend.length === 0 ? "pass" : "fail",
    detail: frontend.length > 0 ? frontend[0].message : undefined,
  });

  const api = rules(["missing-api-route"]);
  items.push({
    label: "API routes implemented",
    status: api.length === 0 ? "pass" : "fail",
    detail: api.length > 0 ? api[0].message : undefined,
  });

  const schemaOk = context.files.has("supabase/schema.sql");
  items.push({
    label: "Database schema present",
    status: schemaOk ? "pass" : plan.dataModel.length === 0 ? "pass" : "fail",
    detail: schemaOk ? undefined : "supabase/schema.sql missing",
  });

  items.push({
    label: "Authentication",
    status: isSupabaseConfigured() ? "pass" : "warn",
    detail: isSupabaseConfigured()
      ? "platform auth connected (Supabase)"
      : "demo mode — no auth provider connected",
  });

  items.push({
    label: "Environment variables",
    status: isNvidiaConfigured() ? "pass" : "fail",
    detail: isNvidiaConfigured()
      ? "AI provider key present server-side"
      : "NVIDIA_API_KEY missing",
  });

  const pages = plan.pages.filter((page) => {
    const path = page.path === "/" ? "src/app/page.tsx" : `src/app${page.path}/page.tsx`;
    return context.files.has(path);
  });
  items.push({
    label: "Planned routes implemented",
    status: pages.length === plan.pages.length ? "pass" : "fail",
    detail: `${pages.length}/${plan.pages.length} pages`,
  });

  // Real fetch of the published preview, from the outside.
  const preview = await verifyPreviewResponds(context.projectId);
  items.push({
    label: "Preview renders",
    status: preview === null ? "warn" : preview.ok ? "pass" : context.persist ? "fail" : "warn",
    detail:
      preview === null
        ? "no public URL configured to verify against"
        : !preview.ok && !context.persist
          ? `${preview.detail} (demo mode stores files in memory — expected across instances)`
          : preview.detail,
  });

  items.push({
    label: "All checks",
    status: checksPass(findings) ? "pass" : "warn",
    detail: checksPass(findings)
      ? `${context.files.size} files verified`
      : `${findings.filter((f) => f.severity === "error").length} unresolved issue(s) — see the Repair Agent's report`,
  });

  return items;
}

/**
 * Deployment Agent: saves the generated files through the file system
 * manager, records the deployment, publishes the preview URL, and
 * marks the project ready. (Deterministic — no LLM involved.)
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

    emit({
      type: "agent_log",
      agent: "deployment",
      message: `Saving ${context.files.size} files…`,
    });
    await getFileSystem(context.projectId).writeMany([
      ...context.files.values(),
    ]);

    if (context.persist && isSupabaseConfigured()) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

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
        message: "Demo mode — files saved to the in-memory workspace",
      });
    }

    context.previewUrl = previewUrl;

    // Final verification — run after the files are saved so the preview
    // fetch exercises the real published state.
    const items = await buildVerification(context);
    emit({ type: "verification", agent: "deployment", items });
    const failed = items.filter((item) => item.status === "fail").length;

    emit({
      type: "agent_complete",
      agent: "deployment",
      message:
        failed === 0
          ? `Deployed and verified — preview live at ${previewUrl}`
          : `Deployed with ${failed} verification failure(s) — preview at ${previewUrl}`,
    });
  },
};
