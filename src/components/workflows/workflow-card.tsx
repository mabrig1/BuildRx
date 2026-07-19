"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, MoreHorizontal, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo } from "@/lib/utils";

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_type: "manual" | "webhook";
  created_at: string;
}

export function WorkflowCard({ workflow }: { workflow: WorkflowSummary }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const response = await fetch(`/api/workflows/${workflow.id}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("Failed to delete");
        return;
      }
      toast.success(`Deleted "${workflow.name}"`);
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <>
      <Card className="group relative gap-0 overflow-hidden p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/workflows/${workflow.id}`}
            className="focus-visible:ring-ring/50 flex min-w-0 items-start gap-3 outline-none focus-visible:ring-[3px]"
          >
            <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
              <WorkflowIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <span className="absolute inset-0" aria-hidden />
              <p className="truncate font-medium">{workflow.name}</p>
              <p className="text-muted-foreground line-clamp-2 text-sm">
                {workflow.description ?? "No description"}
              </p>
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-10 -mt-1 -mr-1 shrink-0"
                aria-label={`Actions for ${workflow.name}`}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            <Badge variant="outline">{workflow.trigger_type}</Badge>
            {!workflow.enabled ? <Badge variant="outline">disabled</Badge> : null}
          </div>
          <span className="text-muted-foreground text-xs">{timeAgo(workflow.created_at)}</span>
        </div>
      </Card>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this workflow?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="text-foreground font-medium">{workflow.name}</span>, its steps, and
              its run history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
