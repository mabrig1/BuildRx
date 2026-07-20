import { NextResponse } from "next/server";

import { requireTemplateUser } from "@/lib/templates/access";
import { updateTemplateSchema } from "@/lib/validations/templates";

type RouteParams = { params: Promise<{ templateId: string }> };

/**
 * GET /api/templates/[templateId] — one template (must be active, or
 * owned by the caller if inactive/unpublished).
 *
 * PATCH — edit or unpublish (`isActive: false`) your own template.
 * DELETE — remove it permanently.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireTemplateUser();
  if (!auth.ok) return auth.response;
  const { templateId } = await params;

  const { data, error } = await auth.supabase
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template: data });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireTemplateUser();
  if (!auth.ok) return auth.response;
  const { templateId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateTemplateSchema.safeParse(body);
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
    .from("templates")
    .update({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      ...(parsed.data.prompt !== undefined ? { prompt: parsed.data.prompt } : {}),
      ...(parsed.data.thumbnailUrl !== undefined ? { thumbnail_url: parsed.data.thumbnailUrl } : {}),
      ...(parsed.data.isActive !== undefined ? { is_active: parsed.data.isActive } : {}),
    })
    .eq("id", templateId)
    .eq("created_by", auth.userId)
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Template not found, or you don't own it" },
      { status: 404 }
    );
  }

  return NextResponse.json({ template: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireTemplateUser();
  if (!auth.ok) return auth.response;
  const { templateId } = await params;

  const { data, error } = await auth.supabase
    .from("templates")
    .delete()
    .eq("id", templateId)
    .eq("created_by", auth.userId)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Template not found, or you don't own it" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
