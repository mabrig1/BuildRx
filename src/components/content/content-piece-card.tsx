"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/content/prompts";
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

export interface ContentPieceSummary {
  id: string;
  type: ContentType;
  title: string;
  status: "ready" | "failed";
  error: string | null;
  created_at: string;
}

export function ContentPieceCard({ piece }: { piece: ContentPieceSummary }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const response = await fetch(`/api/content/${piece.id}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("Failed to delete");
        return;
      }
      toast.success(`Deleted "${piece.title}"`);
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <>
      <Card className="group relative gap-0 overflow-hidden p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/content/${piece.id}`}
            className="focus-visible:ring-ring/50 min-w-0 flex-1 outline-none focus-visible:ring-[3px]"
          >
            <span className="absolute inset-0" aria-hidden />
            <p className="truncate font-medium">{piece.title}</p>
            <p className="text-muted-foreground truncate text-sm">
              {piece.error ?? CONTENT_TYPE_LABELS[piece.type]}
            </p>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-10 -mt-1 -mr-1 shrink-0"
                aria-label={`Actions for ${piece.title}`}
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
          <Badge variant="outline" className={piece.status === "failed" ? "border-destructive/30 text-destructive" : undefined}>
            {piece.status === "failed" ? <AlertTriangle className="size-3" /> : null}
            {CONTENT_TYPE_LABELS[piece.type]}
          </Badge>
          <span className="text-muted-foreground text-xs">{timeAgo(piece.created_at)}</span>
        </div>
      </Card>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this piece?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="text-foreground font-medium">{piece.title}</span>. This cannot
              be undone.
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
