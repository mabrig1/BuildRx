"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

export interface TeamInviteRow {
  id: string;
  email: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "revoked";
  created_at: string;
}

export function TeamInvitesPanel({
  teamId,
  invites,
}: {
  teamId: string;
  invites: TeamInviteRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const pending = invites.filter((invite) => invite.status === "pending");

  function revoke(inviteId: string) {
    startTransition(async () => {
      const response = await fetch(`/api/teams/${teamId}/invites/${inviteId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Failed to revoke invite");
        return;
      }
      router.refresh();
    });
  }

  if (pending.length === 0) {
    return <p className="text-muted-foreground text-sm">No pending invites.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {pending.map((invite) => (
        <div key={invite.id} className="flex items-center gap-3 rounded-lg border p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{invite.email}</p>
            <p className="text-muted-foreground text-xs">Sent {timeAgo(invite.created_at)}</p>
          </div>
          <Badge variant="outline" className="capitalize">
            {invite.role}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Revoke invite to ${invite.email}`}
            disabled={isPending}
            onClick={() => revoke(invite.id)}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          </Button>
        </div>
      ))}
    </div>
  );
}
