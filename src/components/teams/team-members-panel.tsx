"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamMemberRole } from "@/types/database";

export interface TeamMemberRow {
  id: string;
  user_id: string;
  role: TeamMemberRole;
  users: { name: string | null; email: string; avatar_url: string | null } | null;
}

export function TeamMembersPanel({
  teamId,
  members,
  currentUserId,
  canManage,
}: {
  teamId: string;
  members: TeamMemberRow[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  function changeRole(userId: string, role: "admin" | "member") {
    setBusyUserId(userId);
    startTransition(async () => {
      const response = await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        toast.error("Failed to update role");
      } else {
        router.refresh();
      }
      setBusyUserId(null);
    });
  }

  function removeMember(userId: string, isSelf: boolean) {
    setBusyUserId(userId);
    startTransition(async () => {
      const response = await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error(isSelf ? "Failed to leave the team" : "Failed to remove member");
      } else {
        toast.success(isSelf ? "You left the team" : "Member removed");
        router.refresh();
      }
      setBusyUserId(null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {members.map((member) => {
        const isSelf = member.user_id === currentUserId;
        const isOwner = member.role === "owner";
        const busy = isPending && busyUserId === member.user_id;

        return (
          <div key={member.id} className="flex items-center gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {member.users?.name || member.users?.email || "Unknown"}
                {isSelf ? " (you)" : ""}
              </p>
              <p className="text-muted-foreground truncate text-xs">{member.users?.email}</p>
            </div>

            {canManage && !isOwner ? (
              <Select
                value={member.role}
                onValueChange={(v) => changeRole(member.user_id, v as "admin" | "member")}
              >
                <SelectTrigger className="w-28" disabled={busy}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="capitalize">
                {member.role}
              </Badge>
            )}

            {isOwner ? null : canManage || isSelf ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={isSelf ? "Leave team" : `Remove ${member.users?.email ?? "member"}`}
                disabled={busy}
                onClick={() => removeMember(member.user_id, isSelf)}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isSelf ? (
                  <LogOut className="size-4" />
                ) : (
                  <X className="size-4" />
                )}
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
