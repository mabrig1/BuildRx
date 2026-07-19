import { NextResponse } from "next/server";

import { requireContentUser } from "@/lib/content/access";
import { updateContentSchema } from "@/lib/validations/content";

type RouteParams = { params: Promise<{ contentId: string }> };

/**
 * GET /api/content/[contentId] — full piece, including body content
 * (RLS: owner only). PATCH — manual edits (title/content) after
 * generation. DELETE — remove it.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireContentUser();
  if (!auth.ok) return auth.response;
  const { contentId } = await params;

  const { data, error } = await auth.supabase
    .from("content_pieces")
    .select("*")
    .eq("id", contentId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  return NextResponse.json({ content: data });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireContentUser();
  if (!auth.ok) return auth.response;
  const { contentId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateContentSchema.safeParse(body);
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
    .from("content_pieces")
    .update(parsed.data)
    .eq("id", contentId)
    .eq("owner_id", auth.userId)
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Content not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ content: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireContentUser();
  if (!auth.ok) return auth.response;
  const { contentId } = await params;

  const { error } = await auth.supabase
    .from("content_pieces")
    .delete()
    .eq("id", contentId)
    .eq("owner_id", auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
