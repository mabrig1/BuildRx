import { NextResponse } from "next/server";

import { requireContentUser } from "@/lib/content/access";
import { promptLibraryItemSchema } from "@/lib/validations/content";

/**
 * GET /api/prompt-library — the caller's saved prompts, newest first
 * (optionally ?category=blog_post).
 *
 * POST /api/prompt-library — save a new one.
 */
export async function GET(request: Request) {
  const auth = await requireContentUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  let query = auth.supabase
    .from("prompt_library")
    .select("*")
    .eq("owner_id", auth.userId)
    .order("created_at", { ascending: false });
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prompts: data });
}

export async function POST(request: Request) {
  const auth = await requireContentUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = promptLibraryItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("prompt_library")
    .insert({
      owner_id: auth.userId,
      title: parsed.data.title,
      category: parsed.data.category,
      prompt_text: parsed.data.promptText,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to save prompt" },
      { status: 500 }
    );
  }

  return NextResponse.json({ prompt: data }, { status: 201 });
}
