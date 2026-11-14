import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LifeBuoy, Search, Users } from "lucide-react";
import { getClientAdminSession } from "@/lib/clients/admin-session";
import { dateLabel, getClientDirectory, safePage, safeQuery } from "@/lib/clients/admin-data";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Client Management" };
export const dynamic = "force-dynamic";

export default async function AdminClientsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  if (!await getClientAdminSession()) redirect("/login?next=/admin/clients");
  const params = await searchParams;
  const query = safeQuery(params.q);
  const page = safePage(params.page);
  const result = await getClientDirectory(query, page);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (n: number) => "/admin/clients?q=" + encodeURIComponent(query) + "&page=" + n;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title="Client Management Center"
        description="Live registered customers, projects, subscriptions and Academy access — administrator only.">
        <Button asChild><Link href="/admin/clients/tickets"><LifeBuoy className="size-4" /> Support inbox</Link></Button>
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-3"><CardDescription>Matching clients</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{result.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-3"><CardDescription>Records on this page</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{result.users.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-3"><CardDescription>Client management</CardDescription>
          <CardTitle className="text-sm">Profiles · Payments · Training · Tickets</CardTitle></CardHeader></Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="size-5" /> Client directory</CardTitle>
          <CardDescription>Only registered client accounts are shown; administrators are excluded. Search by email and open a profile for its records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action="/admin/clients" className="flex flex-col gap-2 sm:flex-row">
            <Input type="search" name="q" aria-label="Search client email" maxLength={100}
              defaultValue={query} placeholder="Search by client email..." className="sm:max-w-md" />
            <Button type="submit"><Search className="size-4" /> Search</Button>
            {query ? <Button variant="outline" asChild><Link href="/admin/clients">Clear</Link></Button> : null}
          </form>
          {result.users.length ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Client</TableHead><TableHead>Joined</TableHead><TableHead>Plan</TableHead>
                  <TableHead>Academy</TableHead><TableHead className="text-right">Projects</TableHead>
                  <TableHead className="text-right">Open tickets</TableHead><TableHead>Profile</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {result.users.map(client => <TableRow key={client.id}>
                    <TableCell><div className="font-medium">{client.name || "Unnamed client"}</div>
                      <div className="text-muted-foreground text-xs">{client.email}</div></TableCell>
                    <TableCell>{dateLabel(client.created_at)}</TableCell>
                    <TableCell><Badge variant="secondary">{client.subscription}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{client.academy.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{client.projects}</TableCell>
                    <TableCell className="text-right tabular-nums">{client.openTickets}</TableCell>
                    <TableCell><Button size="sm" variant="outline" asChild>
                      <Link href={"/admin/clients/" + client.id}>View <ArrowRight className="size-3.5" /></Link>
                    </Button></TableCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No registered client matches this search.
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Page {page} of {pages} · {result.total} matching accounts</span>
            <div className="flex gap-2">
              {page > 1 ? <Button size="sm" variant="outline" asChild><Link href={href(page - 1)}>Previous</Link></Button> : null}
              {page < pages ? <Button size="sm" variant="outline" asChild><Link href={href(page + 1)}>Next</Link></Button> : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
