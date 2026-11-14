import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { getClientAdminSession } from "@/lib/clients/admin-session";
import { getSupportInbox, dateLabel, safePage, validTicketStatus, ticketStatuses } from "@/lib/clients/admin-data";
import { TicketStatusControl } from "@/components/admin/ticket-status-control";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Client Support Inbox" };
export const dynamic = "force-dynamic";
export default async function SupportInbox({ searchParams }: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  if (!await getClientAdminSession()) redirect("/login?next=/admin/clients/tickets");
  const query = await searchParams;
  const status = validTicketStatus(query.status) ? query.status : "all";
  const page = safePage(query.page);
  const inbox = await getSupportInbox(status, page);
  const pages = Math.max(1, Math.ceil(inbox.total / inbox.pageSize));
  const href = (n: number) => "/admin/clients/tickets?status=" + status + "&page=" + n;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Button size="sm" variant="outline" className="w-fit" asChild><Link href="/admin/clients"><ArrowLeft className="size-4" /> Client directory</Link></Button>
      <PageHeader title="Client Support Inbox" description="Private customer requests and follow-up workflow — administrators only.">
        <Badge variant="outline">{inbox.total} matching tickets</Badge>
      </PageHeader>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><LifeBuoy className="size-5" /> Submitted support requests</CardTitle>
        <CardDescription>Only authenticated customers can create tickets. Status and priority are controlled by administrators.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <form action="/admin/clients/tickets" className="flex flex-wrap gap-2">
            <select aria-label="Filter ticket status" name="status" defaultValue={status}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm">
              <option value="all">All statuses</option>
              {ticketStatuses.map(value => <option value={value} key={value}>{value.replace(/_/g," ")}</option>)}
            </select>
            <Button type="submit" size="sm">Filter</Button>
          </form>
          {inbox.tickets.length ? inbox.tickets.map(t => <div className="space-y-2 rounded-lg border p-4" key={t.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{t.subject}</p>
                <Link className="text-primary text-sm underline-offset-4 hover:underline" href={"/admin/clients/" + t.user_id}>
                  {t.clientName || t.email} · {t.email}
                </Link>
              </div>
              <p className="text-muted-foreground text-xs">{dateLabel(t.created_at)}</p>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">{t.message}</p>
            {t.reference ? <p className="text-muted-foreground break-all text-xs">Reference: {t.reference}</p> : null}
            <TicketStatusControl id={t.id} status={t.status} priority={t.priority} />
          </div>) : <p className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">No tickets match the selected status.</p>}
          <div className="flex justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Button asChild size="sm" variant="outline"><Link href={href(page-1)}>Previous</Link></Button> : null}
              {page < pages ? <Button asChild size="sm" variant="outline"><Link href={href(page+1)}>Next</Link></Button> : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
