"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Menu, Monitor } from "lucide-react";

import { AgentRunPanel } from "@/components/agents/agent-run-panel";
import { ChatPanel } from "@/components/chat/chat-panel";
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
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
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

          <h1 className="truncate text-sm font-semibold">{project.name}</h1>
          <Badge variant="secondary" className="capitalize">
            {project.status}
          </Badge>

          <div className="ml-auto flex items-center gap-1">
            <AgentRunPanel
              projectId={project.id}
              defaultPrompt={lastUserMessage}
              onDeployed={(url) => {
                if (url) setPreviewUrl(url);
                setFilesRefreshKey((k) => k + 1);
                setMobileView("preview");
                router.refresh();
              }}
            />
            {/* Chat/Preview toggle — below xl the preview is a tab */}
            <Tabs
              value={mobileView}
              onValueChange={(v) => setMobileView(v as "chat" | "preview")}
              className="xl:hidden"
            >
              <TabsList className="h-8">
                <TabsTrigger value="chat" className="gap-1.5 px-2.5 text-xs">
                  <Bot className="size-3.5" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1.5 px-2.5 text-xs">
                  <Monitor className="size-3.5" />
                  Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <ThemeToggle />
            <UserNav />
          </div>
        </header>

        {/* Panels */}
        <div className="flex min-h-0 flex-1">
          <ChatPanel
            projectId={project.id}
            initialMessages={initialMessages}
            insertText={templatePrompt}
            className={cn(
              "min-w-0 flex-1",
              mobileView === "preview" && "hidden xl:flex"
            )}
          />
          <RightPanel
            projectId={project.id}
            previewUrl={previewUrl}
            filesRefreshKey={filesRefreshKey}
            className={cn(
              "min-w-0 flex-1 xl:max-w-[46%] xl:border-l",
              mobileView === "chat" && "hidden xl:flex"
            )}
          />
        </div>
      </div>
    </div>
  );
}
