import { NextResponse } from "next/server";

import { generateApiKeySecret, hashApiKeySecret, visibleKeyPrefix } from "@/lib/api-keys/generate";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createApiKeySchema } from "@/lib/validations/api-keys";

/**
 * GET /api/keys — the caller's own API keys (never the secret itself
 * — only id/name/prefix/timestamps).
 *
 * POST /api/keys — create one. The raw secret is returned exactly
 * once in this response and never again — the UI must show it to the
 * user immediately with a copy action.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "API keys require Supabase to be configured on this deployment." },
      { status: 503 }
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keys: data });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "API keys require Supabase to be configured on this deployment." },
      { status: 503 }
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const secret = generateApiKeySecret();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      key_prefix: visibleKeyPrefix(secret),
      key_hash: hashApiKeySecret(secret),
    })
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create API key" },
      { status: 500 }
    );
  }

  return NextResponse.json({ key: data, secret }, { status: 201 });
}
