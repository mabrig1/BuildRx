import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, CreditCard, Receipt } from "lucide-react";

import {
  CancelSubscriptionButton,
  UpgradeDialog,
} from "@/components/billing/upgrade-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBillingSummary } from "@/lib/billing/service";
import { plans } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Billing",
};

// Billing state changes between requests (demo upgrades, webhooks) —
// never serve a build-time snapshot.
export const dynamic = "force-dynamic";

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const unlimited = !Number.isFinite(limit);
  const percent = unlimited ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {used.toLocaleString()} / {unlimited ? "∞" : limit.toLocaleString()}
        </span>
      </div>
      <Progress value={unlimited ? 4 : percent} />
      {!unlimited && percent >= 90 ? (
        <p className="text-destructive text-xs">
          You&apos;re near your limit — upgrade for more headroom.
        </p>
      ) : null}
    </div>
  );
}

export default async function BillingPage() {
  let userId: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/billing");
    userId = user.id;
  }

  const summary = await getBillingSummary(userId);
  const isPro = summary.plan === "pro";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Billing"
        description="Manage your subscription, usage, and invoices."
      >
        {summary.demo ? <Badge variant="outline">demo</Badge> : null}
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Current plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-4" />
                Current plan
              </CardTitle>
              <Badge variant={isPro ? "default" : "secondary"}>
                {isPro ? "Pro" : "Free"}
              </Badge>
            </div>
            <CardDescription>
              {isPro ? (
                <>
                  {summary.cancelAtPeriodEnd
                    ? "Cancels at the end of the current period"
                    : "Renews automatically"}
                  {summary.currentPeriodEnd
                    ? ` · ${summary.cancelAtPeriodEnd ? "ends" : "renews"} ${formatDate(summary.currentPeriodEnd)}`
                    : ""}
                  {summary.provider ? (
                    <>
                      {" "}
                      · paid via{" "}
                      <span className="capitalize">{summary.provider}</span>
                    </>
                  ) : null}
                </>
              ) : (
                "Free forever — upgrade when you need more."
              )}
            </CardDescription>
          </CardHeader>
          <CardFooter className="gap-2">
            {isPro && !summary.cancelAtPeriodEnd ? (
              <CancelSubscriptionButton />
            ) : null}
            {!isPro ? <UpgradeDialog /> : null}
          </CardFooter>
        </Card>

        {/* Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>
              Your usage against the {isPro ? "Pro" : "Free"} plan limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <UsageBar
              label="Projects"
              used={summary.usage.projects}
              limit={summary.usage.projectLimit}
            />
            <UsageBar
              label="AI requests this month"
              used={summary.usage.aiRequestsThisMonth}
              limit={summary.usage.aiRequestLimit}
            />
          </CardContent>
        </Card>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = plan.id === summary.plan;
          return (
            <Card
              key={plan.id}
              className={plan.id === "pro" ? "border-primary shadow-md" : undefined}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent ? (
                    <Badge variant="secondary">Current</Badge>
                  ) : plan.id === "pro" ? (
                    <Badge>Popular</Badge>
                  ) : null}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <p className="pt-2">
                  <span className="text-3xl font-semibold tabular-nums">
                    ${plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm"> /month</span>
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="grid gap-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="text-primary size-4 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.id === "pro" && !isCurrent ? (
                  <UpgradeDialog />
                ) : (
                  <Button className="w-full" variant="outline" disabled>
                    {isCurrent ? "Current plan" : "Included"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-4" />
            Invoices
          </CardTitle>
          <CardDescription>Your payment history.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No invoices yet — they&apos;ll appear here after your first
              payment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {invoice.paidAt ? formatDate(invoice.paidAt) : "—"}
                    </TableCell>
                    <TableCell className="max-w-36 truncate font-mono text-xs">
                      {invoice.reference}
                    </TableCell>
                    <TableCell className="capitalize">
                      {invoice.provider}
                    </TableCell>
                    <TableCell className="capitalize">{invoice.plan}</TableCell>
                    <TableCell className="tabular-nums">
                      {invoice.currency} {invoice.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "paid" ? "secondary" : "outline"
                        }
                        className="capitalize"
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
