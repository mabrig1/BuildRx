"use client";

import { useMemo, useState } from "react";
import { FolderKanban, Search } from "lucide-react";

import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import {
  ProjectCard,
  type ProjectSummary,
} from "@/components/projects/project-card";
import { Input } from "@/components/ui/input";

export function ProjectsGrid({
  projects,
  searchable = true,
}: {
  projects: ProjectSummary[];
  searchable?: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    );
  }, [projects, query]);

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <FolderKanban className="text-muted-foreground size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">No projects yet</p>
          <p className="text-muted-foreground text-sm">
            Create your first project and start building with AI.
          </p>
        </div>
        <CreateProjectDialog />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {searchable ? (
        <div className="relative max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects…"
            className="pl-9"
            aria-label="Search projects"
          />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed py-12 text-center text-sm">
          No projects match{" "}
          <span className="text-foreground font-medium">
            &ldquo;{query}&rdquo;
          </span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
