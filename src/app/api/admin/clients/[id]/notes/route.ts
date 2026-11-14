import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientAdminSession } from "@/lib/clients/admin-session";
import { validClientId } from "@/lib/clients/admin-data";

const schema = z.object({ content: z.string().trim().min(8).max(2000) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getClientAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  if (!validClientId(id)) return NextResponse.json({ error: "Invalid client" }, { status: 400 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Note must be 8–2000 characters" }, { status: 400 });
  const { db, user } = session;
  const profile = await db.from("users").select("id").eq("id", id).maybeSingle();
  if (profile.error || !profile.data) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const { data, error } = await db.from("client_notes").insert({
    client_id: id, author_id: user.id, content: input.data.content,
  }).select("id").single();
  if (error || !data) return NextResponse.json({ error: "Could not save note" }, { status: 503 });
  return NextResponse.json({ noteId: data.id }, { status: 201 });
}
