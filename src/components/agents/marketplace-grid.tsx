"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export interface MarketplaceAgent {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  provider: string;
  model: string;
  tools: string[];
}

export function MarketplaceGrid({ agents }: { agents: MarketplaceAgent[] }) {
  const router = useRouter();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <MarketplaceCard key={agent.id} agent={agent} onCloned={() => router.refresh()} />
      ))}
    </div>
  );
}

function MarketplaceCard({
  agent,
  onCloned,
}: {
  agent: MarketplaceAgent;
  onCloned: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClone() {
    startTransition(async () => {
      const response = await fetch(`/api/agents/${agent.id}/clone`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Failed to clone agent");
        return;
      }
      toast.success(`Added "${agent.name}" to your agents`);
      onCloned();
      router.push(`/agents/${data.agent.id}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-lg">{agent.icon}</span>
          {agent.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-muted-foreground line-clamp-3 text-sm">
          {agent.description || "No description"}
        </p>
        <div className="flex flex-wrap gap-1">
          {agent.tools.map((tool) => (
            <Badge key={tool} variant="secondary" className="text-xs">
              {tool}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="border-t">
        <Button size="sm" onClick={handleClone} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          Use this agent
        </Button>
      </CardFooter>
    </Card>
  );
}
