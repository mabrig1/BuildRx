import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { requireTemplateUser } from "@/lib/templates/access";
import { slugify } from "@/lib/templates/slug";
import { publishTemplateSchema } from "@/lib/validations/templates";
import type { Database } from "@/types/database";

const MAX_SLUG_ATTEMPTS = 5;

/**
 * GET /api/templates — browse published templates.
 * Query params: `category`, `q` (matches name/description), `sort`
 * (`trending` = install_count desc, default `newest`), `mine=true`
 * (the caller's own templates, including unpublished/inactive ones).
 *
 * POST /api/templates — publish a new template, live immediately (no
 * moderation queue in this deployment — consistent with how agent
 * visibility works elsewhere in the app).
 */
export async function GET(request: Request) {
  const auth = await requireTemplateUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") === "trending" ? "trending" : "newest";
  const mine = searchParams.get("mine") === "true";

  let query = auth.supabase.from("templates").select("*");
  query = mine ? query.eq("created_by", auth.userId) : query.eq("is_active", true);
  if (category) query = query.eq("category", category);
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  query =
    sort === "trending"
      ? query.order("install_count", { ascending: false })
      : query.order("created_at", { ascending: false });

  const { data, error } = await query.limit(60);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data });
}

async function uniqueSlug(supabase: SupabaseClient<Database>, base: string): Promise<string> {
  const root = base || "template";
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const existing = await supabase.from("templates").select("id").eq("slug", candidate).maybeSingle();
    if (!existing.data) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function POST(request: Request) {
  const auth = await requireTemplateUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = publishTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  let sourceProjectId: string | null = null;
  if (input.sourceProjectId) {
    const project = await auth.supabase
      .from("projects")
      .select("id")
      .eq("id", input.sourceProjectId)
      .eq("owner_id", auth.userId)
      .maybeSingle();
    sourceProjectId = project.data?.id ?? null;
  }

  const slug = await uniqueSlug(auth.supabase, slugify(input.name));

  const { data, error } = await auth.supabase
    .from("templates")
    .insert({
      slug,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      prompt: input.prompt,
      thumbnail_url: input.thumbnailUrl ?? null,
      created_by: auth.userId,
      source_project_id: sourceProjectId,
      is_active: true,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to publish template" },
      { status: 500 }
    );
  }

  return NextResponse.json({ template: data }, { status: 201 });
}
