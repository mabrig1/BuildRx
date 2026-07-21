"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Wrench, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, timeAgo } from "@/lib/utils";
import type { FixProposal, FixProposalStatus } from "@/lib/health/types";

const STATUS_LABEL: Record<FixProposalStatus, string> = {
  pending: "Pending approval",
  approved: "Approving…",
  applied: "Applied",
  rejected: "Rejected",
  failed: "Failed",
};

function statusBadgeClass(status: FixProposalStatus) {
  switch (status) {
    case "applied":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "failed":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "rejected":
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
    default:
      return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
}

export function FixProposalsPanel({ proposals }: { proposals: FixProposal[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = proposals.filter((p) => p.status === "pending");
  const history = proposals.filter((p) => p.status !== "pending");

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const response = await fetch(`/api/health/fixes/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message ?? "Failed to update the fix proposal");
      }
      toast[action === "approve" ? "success" : "message"](
        data?.message ?? (action === "approve" ? "Fix applied" : "Fix rejected")
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="size-4" />
          Fix proposals
        </CardTitle>
        <CardDescription>
          Diagnosed automatically by the health checks; nothing is applied to
          production without your approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {pending.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No pending fixes — every check is clean.
          </p>
        ) : (
          <ul className="grid gap-3">
            {pending.map((proposal) => (
              <li key={proposal.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{proposal.title}</p>
                      <Badge variant="outline" className="capitalize">
                        {proposal.subsystem}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">{proposal.description}</p>
                    {proposal.sqlFix ? (
                      <pre className="bg-muted mt-1 max-h-40 overflow-auto rounded-md p-2 font-mono text-xs">
                        {proposal.sqlFix}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground text-xs italic">
                        No one-click SQL fix available — see description for the manual step.
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={busyId === proposal.id || !proposal.sqlFix}
                    onClick={() => act(proposal.id, "approve")}
                  >
                    {busyId === proposal.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Check />
                    )}
                    Approve &amp; apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === proposal.id}
                    onClick={() => act(proposal.id, "reject")}
                  >
                    <X />
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {history.length > 0 ? (
          <div className="grid gap-2 border-t pt-4">
            <p className="text-sm font-medium">History</p>
            <ul className="grid gap-1.5">
              {history.slice(0, 10).map((proposal) => (
                <li
                  key={proposal.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">{proposal.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("capitalize", statusBadgeClass(proposal.status))}
                    >
                      {STATUS_LABEL[proposal.status]}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {timeAgo(proposal.reviewedAt ?? proposal.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
