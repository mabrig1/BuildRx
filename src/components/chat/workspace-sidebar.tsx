"use client";

import Link from "next/link";
import {
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface SidebarProject {
  id: string;
  name: string;
}

export interface SidebarTemplate {
  id: string;
  name: string;
  prompt: string;
}

export function WorkspaceSidebar({
  projects,
  templates,
  activeProjectId,
  onUseTemplate,
  className,
}: {
  projects: SidebarProject[];
  templates: SidebarTemplate[];
  activeProjectId: string;
  onUseTemplate?: (prompt: string) => void;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground flex h-full w-60 shrink-0 flex-col",
        className
      )}
    >
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <Logo href="/dashboard" />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          {/* Projects */}
          <section>
            <div className="text-muted-foreground mb-1.5 flex items-center justify-between px-1 text-xs font-medium tracking-wide uppercase">
              <span className="flex items-center gap-1.5">
                <FolderKanban className="size-3.5" />
                Projects
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                asChild
                aria-label="All projects"
              >
                <Link href="/projects">
                  <Plus className="size-3.5" />
                </Link>
              </Button>
            </div>
            <nav className="grid gap-0.5">
              {projects.length === 0 ? (
                <p className="text-muted-foreground px-2 py-1.5 text-xs">
                  No other projects yet.
                </p>
              ) : (
                projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className={cn(
                      "truncate rounded-md px-2 py-1.5 text-sm transition-colors",
                      project.id === activeProjectId
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {project.name}
                  </Link>
                ))
              )}
            </nav>
          </section>

          <Separator />

          {/* Templates */}
          <section>
            <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium tracking-wide uppercase">
              <LayoutTemplate className="size-3.5" />
              Templates
            </div>
            <div className="grid gap-0.5">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onUseTemplate?.(template.prompt)}
                  className="text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                >
                  <Sparkles className="size-3.5 shrink-0 text-violet-500" />
                  <span className="truncate">{template.name}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>

      {/* Footer nav */}
      <div className="grid shrink-0 gap-0.5 border-t p-3">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
        >
          <LayoutDashboard className="size-4" />
          Dashboard
        </Link>
        <Link
          href="/settings"
          className="text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
        >
          <Settings className="size-4" />
          Settings
        </Link>
        <div className="flex items-center justify-between px-2 pt-1.5 text-sm">
          <span className="text-muted-foreground">Plan</span>
          <Badge variant="secondary">Free</Badge>
        </div>
      </div>
    </aside>
  );
}
