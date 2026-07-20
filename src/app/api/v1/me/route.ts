import { NextResponse } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/me — verify an API key and return basic account info.
 * The natural first call for anyone integrating against the public
 * API — confirms the key works and who it belongs to.
 */
export async function GET(request: Request) {
  const identity = await authenticateApiKey(request);
  if (!identity) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, email, name, plan")
    .eq("id", identity.userId)
    .maybeSingle();
  if (!data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}
