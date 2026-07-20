import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ keyId: string }> };

async function requireUser() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "API keys require Supabase to be configured on this deployment." },
        { status: 503 }
      ),
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true as const, supabase, userId: user.id };
}

/** PATCH /api/keys/[keyId] — revoke a key (stops working immediately, kept in the list for history). DELETE — remove it permanently. */
export async function PATCH(_request: Request, { params }: RouteParams) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { keyId } = await params;

  const { data, error } = await auth.supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("owner_id", auth.userId)
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Key not found" }, { status: 404 });
  }

  return NextResponse.json({ key: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { keyId } = await params;

  const { data, error } = await auth.supabase
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .eq("owner_id", auth.userId)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
