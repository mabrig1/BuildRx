"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Copy,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { deleteProject, duplicateProject } from "@/app/(dashboard)/projects/actions";
import { PublishTemplateDialog } from "@/components/marketplace/publish-template-dialog";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareProjectDialog } from "@/components/projects/share-project-dialog";
import { cn, timeAgo } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  previewUrl: string | null;
  updatedAt: string;
  teamId?: string | null;
}

const statusStyles: Record<ProjectStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  generating:
    "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  ready:
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  archived: "text-muted-foreground",
};

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

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateProject(project.id);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Duplicated "${project.name}"`);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Deleted "${project.name}"`);
      }
      setConfirmDelete(false);
    });
  }

  return (
    <>
      <Card className="group relative gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
        <Link
          href={`/projects/${project.id}`}
          className="focus-visible:ring-ring/50 block outline-none focus-visible:ring-[3px]"
        >
          <div
            className={cn(
              "h-24 bg-gradient-to-br opacity-80 transition-opacity group-hover:opacity-100",
              gradientFor(project.id)
            )}
          />
        </Link>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/projects/${project.id}`}
                className="font-medium hover:underline"
              >
                <span className="absolute inset-0" aria-hidden />
                <span className="block truncate">{project.name}</span>
              </Link>
              <p className="text-muted-foreground truncate text-sm">
                {project.description ?? "No description"}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative z-10 -mt-1 -mr-2 shrink-0"
                  aria-label={`Actions for ${project.name}`}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="size-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${project.id}`}>
                    <Pencil />
                    Open
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/preview/${project.id}`} target="_blank">
                    <ExternalLink />
                    Preview
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleDuplicate}>
                  <Copy />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShareOpen(true)}>
                  <Users />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPublishOpen(true)}>
                  <Upload />
                  Publish as template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setConfirmDelete(true)}
                >
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className={cn("capitalize", statusStyles[project.status])}
            >
              {project.status}
            </Badge>
            <span className="text-muted-foreground text-xs">
              Updated {timeAgo(project.updatedAt)}
            </span>
          </div>
        </div>
      </Card>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="text-foreground font-medium">
                {project.name}
              </span>{" "}
              along with its files, chat history, and deployments. This cannot
              be undone.
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
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareProjectDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={project.id}
        projectName={project.name}
        currentTeamId={project.teamId ?? null}
      />

      <PublishTemplateDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        sourceProjectId={project.id}
        defaultName={project.name}
        defaultDescription={project.description ?? ""}
      />
    </>
  );
}
