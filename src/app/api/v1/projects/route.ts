import { NextResponse } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys/auth";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET /api/v1/projects — the key owner's projects. */
export async function GET(request: Request) {
  const identity = await authenticateApiKey(request);
  if (!identity) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const limit = rateLimit(`v1:${identity.keyId}`, { limit: 60, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests — please slow down." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("id, name, description, status, preview_url, created_at, updated_at")
    .eq("owner_id", identity.userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      projects: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        previewUrl: row.preview_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    },
    { headers: rateLimitHeaders(limit) }
  );
}
