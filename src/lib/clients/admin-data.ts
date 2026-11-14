import type { Database } from "@/types/database";
import { getClientAdminSession } from "@/lib/clients/admin-session";

type TicketRow = Database["public"]["Tables"]["support_tickets"]["Row"];
const LIMIT = 20;

export function safePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page < 100000 ? page : 1;
}
export function safeQuery(value: string | undefined): string {
  return (value ?? "").trim().slice(0, 100).replace(/[%_\\]/g, "");
}
export function validClientId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
export const ticketStatuses = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
export type TicketStatus = (typeof ticketStatuses)[number];
export function validTicketStatus(v: unknown): v is TicketStatus {
  return typeof v === "string" && ticketStatuses.includes(v as TicketStatus);
}
export function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export async function getClientDirectory(query: string, page: number) {
  const session = await getClientAdminSession();
  if (!session) throw new Error("Admin authorization required");
  const { db } = session;
  const start = (page - 1) * LIMIT;
  let builder = db.from("users").select("id,email,name,plan,role,created_at", { count: "exact" })
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .range(start, start + LIMIT - 1);
  if (query) builder = builder.ilike("email", "%" + query + "%");
  const { data, error, count } = await builder;
  if (error) throw new Error("Client directory is temporarily unavailable");
  const users = data ?? [];
  const ids = users.map(user => user.id);
  const projects = new Map<string, number>();
  if (ids.length) {
    await Promise.all(ids.map(async id => {
      const response = await db.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", id);
      projects.set(id, response.count ?? 0);
    }));
  }
  const enrollments = ids.length
    ? await db.from("course_enrollments").select("user_id,status,course_slug").in("user_id", ids)
    : null;
  const subscriptions = ids.length
    ? await db.from("subscriptions").select("user_id,plan,status").in("user_id", ids)
    : null;
  const tickets = ids.length
    ? await db.from("support_tickets").select("user_id,status").in("user_id", ids)
    : null;
  if (enrollments?.error || subscriptions?.error || tickets?.error) {
    throw new Error("Client summary could not be loaded");
  }
  return {
    users: users.map(u => ({
      ...u,
      projects: projects.get(u.id) ?? 0,
      academy: enrollments?.data?.find(e => e.user_id === u.id)?.status ?? "not_enrolled",
      subscription: subscriptions?.data?.find(s => s.user_id === u.id &&
        ["active","trialing"].includes(s.status))?.plan ?? "free",
      openTickets: tickets?.data?.filter(t => t.user_id === u.id &&
        ["open","in_progress","waiting"].includes(t.status)).length ?? 0,
    })),
    query,
    page,
    pageSize: LIMIT,
    total: count ?? 0,
  };
}

export async function getClientProfile(clientId: string) {
  if (!validClientId(clientId)) return null;
  const session = await getClientAdminSession();
  if (!session) throw new Error("Admin authorization required");
  const { db } = session;
  const { data: user, error } = await db.from("users")
    .select("id,email,name,role,plan,created_at,onboarded").eq("id", clientId).maybeSingle();
  if (error) throw new Error("Client could not be loaded");
  if (!user) return null;
  const [projects, payments, enrollments, subscriptions, tickets, notes] = await Promise.all([
    db.from("projects").select("id,name,status,created_at,updated_at,preview_url,github_repo")
      .eq("owner_id", clientId).order("created_at", { ascending: false }).limit(50),
    db.from("invoices").select("id,provider,reference,amount,currency,status,paid_at")
      .eq("user_id", clientId).order("created_at", { ascending: false }).limit(30),
    db.from("course_enrollments").select("id,course_slug,status,provider,provider_ref,amount,currency,enrolled_at")
      .eq("user_id", clientId).order("created_at", { ascending: false }),
    db.from("subscriptions").select("plan,status,provider,current_period_end").eq("user_id", clientId),
    db.from("support_tickets").select("*").eq("user_id", clientId)
      .order("created_at", { ascending: false }).limit(30),
    db.from("client_notes").select("id,content,author_id,created_at").eq("client_id", clientId)
      .order("created_at", { ascending: false }).limit(30),
  ]);
  const errors = [projects.error,payments.error,enrollments.error,subscriptions.error,tickets.error,notes.error];
  if (errors.some(Boolean)) throw new Error("Some client information could not be loaded");
  return {
    user, projects: projects.data ?? [], payments: payments.data ?? [],
    enrollments: enrollments.data ?? [], subscriptions: subscriptions.data ?? [],
    tickets: tickets.data ?? [], notes: notes.data ?? [],
  };
}

export async function getSupportInbox(status: string, page: number) {
  const session = await getClientAdminSession();
  if (!session) throw new Error("Admin authorization required");
  const { db } = session;
  let q = db.from("support_tickets").select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * LIMIT, page * LIMIT - 1);
  if (validTicketStatus(status)) q = q.eq("status", status);
  const { data, count, error } = await q;
  if (error) throw new Error("Support inbox could not be loaded");
  const tickets = (data ?? []) as TicketRow[];
  const ids = [...new Set(tickets.map(t => t.user_id))];
  const people = ids.length
    ? await db.from("users").select("id,email,name").in("id", ids) : null;
  if (people?.error) throw new Error("Client information could not be loaded");
  const names = new Map((people?.data ?? []).map(p => [p.id, p]));
  return {
    tickets: tickets.map(t => ({ ...t, email: names.get(t.user_id)?.email ?? "Unknown account",
      clientName: names.get(t.user_id)?.name ?? null })),
    page, status, total: count ?? 0, pageSize: LIMIT,
  };
}
