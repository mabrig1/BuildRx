import Link from "next/link";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

export interface TeamSummary {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export function TeamCard({ team, currentUserId }: { team: TeamSummary; currentUserId: string }) {
  const isOwner = team.owner_id === currentUserId;

  return (
    <Link href={`/teams/${team.id}`}>
      <Card className="h-full gap-0 overflow-hidden p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start gap-3">
          <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Users className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{team.name}</p>
            <p className="text-muted-foreground text-sm">{isOwner ? "Owner" : "Member"}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          {isOwner ? <Badge variant="outline">owner</Badge> : <span />}
          <span className="text-muted-foreground text-xs">{timeAgo(team.created_at)}</span>
        </div>
      </Card>
    </Link>
  );
}
