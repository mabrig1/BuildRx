import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type SupabaseClientType = Awaited<ReturnType<typeof createClient>>;
type KnowledgeBaseRow = Database["public"]["Tables"]["knowledge_bases"]["Row"];

/** Knowledge bases require Supabase — owner-scoped, no demo-mode equivalent. */
export async function requireRagUser() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "The Knowledge Base requires Supabase to be configured on this deployment." },
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

/** Fetches a knowledge base by id, scoped to its owner (RLS enforces this too — the explicit filter gives a clean 404 instead of a silent empty result). */
export async function loadOwnedKnowledgeBase(
  supabase: SupabaseClientType,
  userId: string,
  knowledgeBaseId: string
): Promise<KnowledgeBaseRow | null> {
  const { data } = await supabase
    .from("knowledge_bases")
    .select("*")
    .eq("id", knowledgeBaseId)
    .eq("owner_id", userId)
    .maybeSingle();
  return data;
}
