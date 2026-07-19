import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type SupabaseClientType = Awaited<ReturnType<typeof createClient>>;
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

/**
 * Documents require Supabase — there's no in-memory demo-mode
 * equivalent for owner-scoped uploads.
 */
export async function requireDocumentUser() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Document AI requires Supabase to be configured on this deployment." },
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

/** Fetches a document by id, scoped to its owner (RLS enforces this too — the explicit filter gives a clean 404 instead of a silent empty result). */
export async function loadOwnedDocument(
  supabase: SupabaseClientType,
  userId: string,
  documentId: string
): Promise<DocumentRow | null> {
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("owner_id", userId)
    .maybeSingle();
  return data;
}
