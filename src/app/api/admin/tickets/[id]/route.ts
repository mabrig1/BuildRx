import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientAdminSession } from "@/lib/clients/admin-session";
import { validClientId, ticketStatuses } from "@/lib/clients/admin-data";

const schema = z.object({
  status: z.enum(ticketStatuses),
  priority: z.enum(["normal", "high", "urgent"]),
});
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getClientAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  if (!validClientId(id)) return NextResponse.json({ error: "Invalid ticket id" }, { status: 400 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid ticket status" }, { status: 400 });
  const { data, error } = await session.db.from("support_tickets")
    .update({ status: input.data.status, priority: input.data.priority, last_updated_by: session.user.id })
    .eq("id", id).select("id,status,priority").maybeSingle();
  if (error) return NextResponse.json({ error: "Ticket update failed" }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  return NextResponse.json({ ticket: data });
}
