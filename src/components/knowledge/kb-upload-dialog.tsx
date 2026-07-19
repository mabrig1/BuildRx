"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ACCEPT =
  ".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*";

export function KnowledgeBaseUploadDialog({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/rag/knowledge-bases/${knowledgeBaseId}/documents`, {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Upload failed");
      if (data.document.status === "failed") {
        toast.error(data.document.error ?? `Couldn't process "${file.name}"`);
      } else {
        toast.success(`"${file.name}" indexed — ${data.document.chunk_count} chunks`);
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload />
          Upload document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>
            PDF, DOCX, XLSX, or an image — max 10MB. It&apos;s extracted, chunked, and embedded
            for search right away; this can take a moment for longer documents.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          disabled={isUploading}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "hover:bg-muted/50"
          )}
        >
          {isUploading ? (
            <Loader2 className="text-muted-foreground size-8 animate-spin" />
          ) : (
            <Upload className="text-muted-foreground size-8" />
          )}
          <p className="text-sm font-medium">
            {isUploading ? "Uploading, extracting, and embedding…" : "Click or drag a file here"}
          </p>
        </button>
      </DialogContent>
    </Dialog>
  );
}
