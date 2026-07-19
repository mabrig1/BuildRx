import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type SupabaseClientType = Awaited<ReturnType<typeof createClient>>;
type WorkflowRow = Database["public"]["Tables"]["workflows"]["Row"];

/** Workflows require Supabase — owner-scoped, no demo-mode equivalent. */
export async function requireWorkflowUser() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Workflows require Supabase to be configured on this deployment." },
        { status: 503 }
      ),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true as const, supabase, userId: user.id };
}

export async function loadOwnedWorkflow(
  supabase: SupabaseClientType,
  userId: string,
  workflowId: string
): Promise<WorkflowRow | null> {
  const { data } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .eq("owner_id", userId)
    .maybeSingle();
  return data;
}
