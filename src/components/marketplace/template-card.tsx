"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, MoreHorizontal, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { EditTemplateDialog } from "@/components/marketplace/edit-template-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

export interface MarketplaceTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  prompt: string;
  thumbnail_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  install_count: number;
  created_by: string | null;
}

const gradients = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-rose-500",
  "from-blue-500 to-cyan-500",
  "from-pink-500 to-purple-500",
];

function gradientFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return gradients[hash % gradients.length];
}

export function TemplateCard({
  template,
  currentUserId,
}: {
  template: MarketplaceTemplate;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const isOwner = currentUserId !== null && template.created_by === currentUserId;
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const response = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("Failed to delete template");
        return;
      }
      toast.success(`Deleted "${template.name}"`);
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <>
      <Card className="gap-0 overflow-hidden p-0">
        <div className={cn("h-24 bg-gradient-to-br opacity-80", gradientFor(template.id))} />
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{template.name}</p>
              <p className="text-muted-foreground line-clamp-2 text-sm">
                {template.description ?? "No description"}
              </p>
            </div>
            {isOwner ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="-mt-1 -mr-1 shrink-0" aria-label="Manage template">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="capitalize">
              {template.category}
            </Badge>
            {template.is_featured ? (
              <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                <Star className="size-3" />
                Featured
              </Badge>
            ) : null}
            {!template.is_active ? <Badge variant="outline">Unpublished</Badge> : null}
            <span className="text-muted-foreground ml-auto flex items-center gap-1 text-xs">
              <Download className="size-3" />
              {template.install_count}
            </span>
          </div>

          <CreateProjectDialog
            trigger={<Button size="sm">Use this template</Button>}
            defaultValues={{ name: template.name, prompt: template.prompt, templateId: template.id }}
          />
        </CardContent>
      </Card>

      {isOwner ? (
        <EditTemplateDialog open={editOpen} onOpenChange={setEditOpen} template={template} />
      ) : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this template?</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="text-foreground font-medium">{template.name}</span> from the
              marketplace. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              <Trash2 />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
