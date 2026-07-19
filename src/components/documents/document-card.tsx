"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  File,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
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

export interface DocumentSummary {
  id: string;
  name: string;
  file_type: "pdf" | "docx" | "xlsx" | "image";
  status: "processing" | "ready" | "failed";
  summary: string | null;
  warning: string | null;
  error: string | null;
  size_bytes: number;
  created_at: string;
}

const ICONS = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  image: ImageIcon,
} as const;

const statusStyles: Record<DocumentSummary["status"], string> = {
  processing: "bg-secondary text-secondary-foreground",
  ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

export function DocumentCard({ document }: { document: DocumentSummary }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const Icon = ICONS[document.file_type] ?? File;

  function handleDelete() {
    startTransition(async () => {
      const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("Failed to delete document");
        return;
      }
      toast.success(`Deleted "${document.name}"`);
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <>
      <Card className="group relative gap-0 overflow-hidden p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/documents/${document.id}`}
            className="focus-visible:ring-ring/50 flex min-w-0 items-start gap-3 outline-none focus-visible:ring-[3px]"
          >
            <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <span className="absolute inset-0" aria-hidden />
              <p className="truncate font-medium">{document.name}</p>
              <p className="text-muted-foreground line-clamp-2 text-sm">
                {document.error ?? document.warning ?? document.summary ?? "No summary yet"}
              </p>
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-10 -mt-1 -mr-1 shrink-0"
                aria-label={`Actions for ${document.name}`}
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
          <Badge variant="outline" className={statusStyles[document.status]}>
            {document.status === "failed" ? <AlertTriangle className="size-3" /> : null}
            {document.status}
          </Badge>
          <span className="text-muted-foreground text-xs">{timeAgo(document.created_at)}</span>
        </div>
      </Card>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="text-foreground font-medium">{document.name}</span> and its
              extracted content. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
