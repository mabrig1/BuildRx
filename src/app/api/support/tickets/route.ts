import { NextResponse } from "next/server";
import { z } from "zod";
import { SUPPORT_TOPICS } from "@/lib/support/support-messages";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const categories = SUPPORT_TOPICS.map(topic => topic.id);
const schema = z.object({
  category: z.string().refine(v => categories.includes(v as typeof categories[number])),
  message: z.string().trim().min(12).max(2000),
  reference: z.string().trim().max(140).optional(),
});

/** A private ticket is tied to the verified account, never a submitted email. */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Support is unavailable" }, { status: 503 });
  const db = await createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to create a private support ticket" }, { status: 401 });
  }
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid support request" }, { status: 400 });
  const since = new Date(Date.now() - 86400000).toISOString();
  const recent = await db.from("support_tickets").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).gte("created_at", since);
  if (recent.error) return NextResponse.json({ error: "Cannot verify ticket limit" }, { status: 503 });
  if ((recent.count ?? 0) >= 5) {
    return NextResponse.json({ error: "Daily ticket limit reached. Use WhatsApp for urgent help." }, { status: 429 });
  }
  const topic = SUPPORT_TOPICS.find(t => t.id === input.data.category);
  const { data, error } = await db.from("support_tickets").insert({
    user_id: user.id,
    category: input.data.category,
    subject: topic?.title ?? "BuildRx support",
    message: input.data.message,
    reference: input.data.reference || null,
  }).select("id,status").single();
  if (error || !data) return NextResponse.json({ error: "Unable to save ticket" }, { status: 503 });
  return NextResponse.json({ ticketId: data.id, status: data.status }, { status: 201 });
}
