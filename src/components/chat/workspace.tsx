"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Code2, Download, Menu, Monitor } from "lucide-react";

import { AgentRunPanel } from "@/components/agents/agent-run-panel";
import { ChatPanel } from "@/components/chat/chat-panel";
import { DeployPanel } from "@/components/deploy/deploy-panel";
import { GitHubPanel } from "@/components/github/github-panel";
import {
  WorkspaceSidebar,
  type SidebarProject,
  type SidebarTemplate,
} from "@/components/chat/workspace-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserNav } from "@/components/layout/user-nav";
import { RightPanel } from "@/components/preview/right-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ChatMessage, ProjectStatus } from "@/types";

export function Workspace({
  project,
  initialMessages,
  projects,
  templates,
}: {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    previewUrl: string | null;
  };
  initialMessages: ChatMessage[];
  projects: SidebarProject[];
  templates: SidebarTemplate[];
}) {
  const router = useRouter();
  const [mobileView, setMobileView] = useState<"chat" | "code" | "preview">("chat");
  const [templatePrompt, setTemplatePrompt] = useState<{
    text: string;
    nonce: number;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(project.previewUrl);
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);

  const lastUserMessage = [...initialMessages]
    .reverse()
    .find((m) => m.role === "user")?.content;

  function handleBuildDeployed(url: string | null) {
    if (url) setPreviewUrl(url);
    setFilesRefreshKey((k) => k + 1);
    setMobileView("preview");
    router.refresh();
  }

  function useTemplate(prompt: string) {
    setTemplatePrompt({ text: prompt, nonce: Date.now() });
    setMobileView("chat");
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-svh">
      {/* Left sidebar — desktop */}
      <WorkspaceSidebar
        projects={projects}
        templates={templates}
        activeProjectId={project.id}
        onUseTemplate={useTemplate}
        className="hidden border-r lg:flex"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          {/* Left sidebar — mobile sheet */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <WorkspaceSidebar
                projects={projects}
                templates={templates}
                activeProjectId={project.id}
                onUseTemplate={useTemplate}
                className="w-full"
              />
            </SheetContent>
          </Sheet>

          <h1 className="min-w-0 truncate text-sm font-semibold">
            {project.name}
          </h1>
          <Badge
            variant="secondary"
            className="hidden capitalize sm:inline-flex"
          >
            {project.status}
          </Badge>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              asChild
            >
              <a
                href={`/api/projects/${project.id}/export`}
                download
                aria-label="Download project as zip"
                title="Download project as zip"
              >
                <Download className="size-4" />
              </a>
            </Button>
            <GitHubPanel projectId={project.id} projectName={project.name} />
            <DeployPanel projectId={project.id} />
            <AgentRunPanel
              projectId={project.id}
              defaultPrompt={lastUserMessage}
              onDeployed={handleBuildDeployed}
            />
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <UserNav />
          </div>
        </header>

        {/* Code and Preview are separate full-width views on small screens. */}
        <nav aria-label="Workspace views" className="shrink-0 border-b bg-muted/20 px-2 py-1 xl:hidden">
          <Tabs
            value={mobileView}
            onValueChange={(value) => setMobileView(value as "chat" | "code" | "preview")}
            className="w-full"
          >
            <TabsList className="grid h-10 w-full grid-cols-3 bg-transparent">
              <TabsTrigger value="chat" className="gap-1.5 text-xs">
                <Bot className="size-4" aria-hidden />
                Chat
              </TabsTrigger>
              <TabsTrigger value="code" className="gap-1.5 text-xs">
                <Code2 className="size-4" aria-hidden />
                Code
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5 text-xs">
                <Monitor className="size-4" aria-hidden />
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </nav>

        {/* Panels */}
        <div className="flex min-h-0 flex-1">
          <ChatPanel
            projectId={project.id}
            projectStatus={project.status}
            initialMessages={initialMessages}
            insertText={templatePrompt}
            onBuildDeployed={handleBuildDeployed}
            className={cn(
              "min-w-0 flex-1 xl:flex-none xl:basis-[30%]",
              mobileView !== "chat" && "hidden xl:flex"
            )}
          />
          <RightPanel
            projectId={project.id}
            previewUrl={previewUrl}
            filesRefreshKey={filesRefreshKey}
            compactView={mobileView === "code" ? "code" : "preview"}
            className={cn(
              "min-w-0 flex-1 xl:basis-[70%] xl:border-l",
              mobileView === "chat" && "hidden xl:flex"
            )}
          />
        </div>
      </div>
    </div>
  );
}
