import { NextResponse } from "next/server";

import { requireContentUser } from "@/lib/content/access";
import { promptLibraryItemSchema } from "@/lib/validations/content";

type RouteParams = { params: Promise<{ promptId: string }> };

/** PATCH /api/prompt-library/[promptId] — update. DELETE — remove. Owner only. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireContentUser();
  if (!auth.ok) return auth.response;
  const { promptId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = promptLibraryItemSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("prompt_library")
    .update({
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      ...(parsed.data.promptText !== undefined ? { prompt_text: parsed.data.promptText } : {}),
    })
    .eq("id", promptId)
    .eq("owner_id", auth.userId)
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Prompt not found" }, { status: 404 });
  }

  return NextResponse.json({ prompt: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireContentUser();
  if (!auth.ok) return auth.response;
  const { promptId } = await params;

  const { error } = await auth.supabase
    .from("prompt_library")
    .delete()
    .eq("id", promptId)
    .eq("owner_id", auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
