import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AiProvider } from "@/types/database";

/**
 * Records an AI call into ai_generations (when tied to a project) and
 * meters it in usage_logs. Writes use the service-role client (RLS
 * forbids clients from forging usage); no-ops when Supabase or the
 * service key isn't configured.
 */
export async function recordAiUsage(params: {
  userId: string;
  projectId?: string | null;
  messageId?: string | null;
  model: string;
  /** Defaults to 'nvidia' at the database level when omitted. */
  provider?: AiProvider;
  status: "completed" | "failed";
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  error?: string | null;
  action?: "ai_message" | "ai_generation";
}): Promise<void> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    // ai_generations requires a project; usage_logs does not.
    if (params.projectId) {
      await admin.from("ai_generations").insert({
        project_id: params.projectId,
        message_id: params.messageId ?? null,
        user_id: params.userId,
        model: params.model,
        ...(params.provider ? { provider: params.provider } : {}),
        status: params.status,
        prompt_tokens: params.promptTokens,
        completion_tokens: params.completionTokens,
        duration_ms: params.durationMs,
        error: params.error ?? null,
        completed_at: new Date().toISOString(),
      });
    }

    await admin.from("usage_logs").insert({
      user_id: params.userId,
      project_id: params.projectId ?? null,
      action: params.action ?? "ai_generation",
      metadata: {
        model: params.model,
        provider: params.provider ?? null,
        prompt_tokens: params.promptTokens,
        completion_tokens: params.completionTokens,
        status: params.status,
      },
    });
  } catch (error) {
    // Metering must never break the user-facing request.
    console.error("Failed to record AI usage:", error);
  }
}
