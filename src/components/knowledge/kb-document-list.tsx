"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  File,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

export interface KnowledgeDocumentSummary {
  id: string;
  name: string;
  file_type: string;
  status: "processing" | "ready" | "failed";
  chunk_count: number;
  warning: string | null;
  error: string | null;
  created_at: string;
}

const ICONS: Record<string, typeof File> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  image: ImageIcon,
};

const statusStyles: Record<KnowledgeDocumentSummary["status"], string> = {
  processing: "bg-secondary text-secondary-foreground",
  ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

function DocumentRow({
  knowledgeBaseId,
  document,
}: {
  knowledgeBaseId: string;
  document: KnowledgeDocumentSummary;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const Icon = ICONS[document.file_type] ?? File;

  function handleDelete() {
    startTransition(async () => {
      const response = await fetch(
        `/api/rag/knowledge-bases/${knowledgeBaseId}/documents/${document.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        toast.error("Failed to delete document");
        return;
      }
      toast.success(`Deleted "${document.name}"`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{document.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {document.error ??
            document.warning ??
            (document.status === "ready"
              ? `${document.chunk_count} chunk${document.chunk_count === 1 ? "" : "s"}`
              : "Processing…")}
        </p>
      </div>
      <Badge variant="outline" className={statusStyles[document.status]}>
        {document.status === "failed" ? <AlertTriangle className="size-3" /> : null}
        {document.status}
      </Badge>
      <span className="text-muted-foreground hidden text-xs sm:inline">
        {timeAgo(document.created_at)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${document.name}`}
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  );
}

export function KnowledgeDocumentList({
  knowledgeBaseId,
  documents,
}: {
  knowledgeBaseId: string;
  documents: KnowledgeDocumentSummary[];
}) {
  if (documents.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
        No documents yet — upload one to start building this knowledge base.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {documents.map((document) => (
        <DocumentRow key={document.id} knowledgeBaseId={knowledgeBaseId} document={document} />
      ))}
    </div>
  );
}
