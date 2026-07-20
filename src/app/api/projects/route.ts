import { NextResponse } from "next/server";
import { z } from "zod";

import { demoProjectIds } from "@/lib/files/manager";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { reportDbError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/projects — list the signed-in user's projects (RLS-scoped).
 * In demo mode, lists the projects present in the in-memory store.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      projects: demoProjectIds().map((id) => ({
        id,
        name: id,
        status: "draft",
      })),
      demo: true,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, status, preview_url, updated_at")
    .order("updated_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: reportDbError("GET /api/projects", error) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    projects: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      previewUrl: row.preview_url,
      updatedAt: row.updated_at,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
});

/**
 * POST /api/projects — create a project. Enforces the plan's project
 * limit. (The dashboard uses a server action for this; the API exists
 * for programmatic access and testing.)
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { id: `demo-${Date.now()}`, name: parsed.data.name, simulated: true },
      { status: 201 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { checkProjectLimit } = await import("@/lib/billing/limits");
  const limitError = await checkProjectLimit(user.id);
  if (limitError) {
    return NextResponse.json({ error: limitError }, { status: 402 });
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .select("id, name, status")
    .single();
  if (error || !project) {
    return NextResponse.json(
      {
        error: error
          ? reportDbError("POST /api/projects", error)
          : "Failed to create project",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ project }, { status: 201 });
}
