import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, CreditCard, FolderKanban, LifeBuoy, StickyNote } from "lucide-react";
import { getClientAdminSession } from "@/lib/clients/admin-session";
import { dateLabel, getClientProfile, validClientId } from "@/lib/clients/admin-data";
import { TicketStatusControl } from "@/components/admin/ticket-status-control";
import { ClientNoteForm } from "@/components/admin/client-note-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Client Profile" };
export const dynamic = "force-dynamic";

export default async function AdminClientProfile({ params }: { params: Promise<{ id: string }> }) {
  if (!await getClientAdminSession()) redirect("/login?next=/admin/clients");
  const { id } = await params;
  if (!validClientId(id)) notFound();
  const profile = await getClientProfile(id);
  if (!profile) notFound();
  const { user, projects, payments, enrollments, subscriptions, notes, tickets } = profile;
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Button variant="outline" size="sm" className="w-fit" asChild>
        <Link href="/admin/clients"><ArrowLeft className="size-4" /> All clients</Link>
      </Button>
      <PageHeader title={user.name || "Client profile"} description={user.email}>
        <Badge variant="secondary">{user.role}</Badge>
        <Badge variant="outline">Joined {dateLabel(user.created_at)}</Badge>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FolderKanban className="size-4" /> Projects</CardTitle>
          <CardTitle className="text-3xl">{projects.length}{projects.length === 50 ? "+" : ""}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="size-4" /> Academy</CardTitle>
          <CardDescription>{enrollments[0]?.status ?? "Not enrolled"}</CardDescription></CardHeader></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="size-4" /> Subscription</CardTitle>
          <CardDescription>{subscriptions[0] ? subscriptions[0].plan + " · " + subscriptions[0].status : "No subscription"}</CardDescription>
        </CardHeader></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FolderKanban className="size-5" /> Client projects</CardTitle>
          <CardDescription>Most recent 50 personal projects, read only.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">{projects.length ? projects.map(p =>
            <div className="flex justify-between gap-3 border-b pb-3 last:border-0" key={p.id}>
              <div><p className="font-medium">{p.name}</p><p className="text-muted-foreground">{dateLabel(p.created_at)}</p></div>
              <Badge variant="outline">{p.status}</Badge>
            </div>) : <p className="text-muted-foreground">No projects recorded.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="size-5" /> Payments</CardTitle>
          <CardDescription>Invoice records, and separately verified one-time Academy enrollments.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {payments.length ? payments.map(p => <div className="border-b pb-3 last:border-0" key={p.id}>
              <div className="flex justify-between gap-2"><strong>{p.currency} {Number(p.amount).toLocaleString()}</strong>
                <Badge variant="outline">{p.status}</Badge></div>
              <p className="text-muted-foreground">Invoice · {p.provider} · {dateLabel(p.paid_at)}</p>
              <p className="break-all text-xs">{p.reference}</p>
            </div>) : <p className="text-muted-foreground">No subscription invoices recorded.</p>}
            {enrollments.map(e => <div className="border-b pb-3 last:border-0" key={e.id}>
              <div className="flex justify-between gap-2"><strong>Academy · {e.course_slug}</strong>
                <Badge variant="outline">{e.status}</Badge></div>
              <p className="text-muted-foreground">{e.currency} {Number(e.amount).toLocaleString()} · {e.provider ?? "—"} · {dateLabel(e.enrolled_at)}</p>
            </div>)}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><LifeBuoy className="size-5" /> Support tickets</CardTitle>
          <CardDescription>Recent client-submitted requests; updates are admin-only.</CardDescription></CardHeader>
          <CardContent className="space-y-4">{tickets.length ? tickets.map(t => <div className="space-y-2 border-b pb-4 last:border-0" key={t.id}>
            <div className="flex justify-between gap-3"><strong className="text-sm">{t.subject}</strong><span className="text-muted-foreground text-xs">{dateLabel(t.created_at)}</span></div>
            <p className="whitespace-pre-wrap break-words text-sm">{t.message}</p>
            {t.reference ? <p className="text-muted-foreground break-all text-xs">Reference: {t.reference}</p> : null}
            <TicketStatusControl id={t.id} status={t.status} priority={t.priority} />
          </div>) : <p className="text-muted-foreground text-sm">No support tickets submitted by this client.</p>}</CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><StickyNote className="size-5" /> Private administrative notes</CardTitle>
          <CardDescription>Never visible to the client or public site.</CardDescription></CardHeader>
          <CardContent className="space-y-4"><ClientNoteForm clientId={id} />
            {notes.map(n => <div className="rounded-md border p-3" key={n.id}>
              <p className="whitespace-pre-wrap break-words text-sm">{n.content}</p>
              <p className="text-muted-foreground mt-2 text-xs">{dateLabel(n.created_at)}</p>
            </div>)}
            {!notes.length ? <p className="text-muted-foreground text-sm">No notes yet.</p> : null}
          </CardContent></Card>
      </div>
    </div>
  );
}
