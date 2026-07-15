import type { Metadata } from "next";
import Link from "next/link";
import { Bot, ExternalLink, Monitor, SendHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = {
  title: "Project workspace",
};

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-[calc(100svh-6.5rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold tracking-tight">Project workspace</h1>
          <Badge variant="secondary">draft</Badge>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/preview/${projectId}`} target="_blank">
            <ExternalLink />
            Open preview
          </Link>
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(320px,2fr)_3fr]">
        {/* Chat panel */}
        <Card className="flex min-h-0 flex-col gap-0 py-0">
          <ScrollArea className="min-h-0 flex-1 p-4">
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 py-16 text-center text-sm">
              <Bot className="size-8" />
              <p>Chat with AI to build this project.</p>
            </div>
          </ScrollArea>
          <Separator />
          <div className="flex items-end gap-2 p-2">
            <Textarea
              placeholder="Ask AI to make changes…"
              className="min-h-10 resize-none border-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Button size="icon" className="mb-1 shrink-0" aria-label="Send">
              <SendHorizontal />
            </Button>
          </div>
        </Card>

        {/* Preview panel */}
        <Card className="hidden min-h-0 flex-col gap-0 overflow-hidden py-0 lg:flex">
          <div className="bg-muted/50 flex h-10 items-center gap-2 border-b px-3">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-red-400" />
              <span className="size-2.5 rounded-full bg-yellow-400" />
              <span className="size-2.5 rounded-full bg-green-400" />
            </div>
            <div className="bg-background text-muted-foreground mx-auto flex h-6 w-full max-w-xs items-center justify-center rounded-md border text-xs">
              preview.app-creator.dev/{projectId.slice(0, 8)}
            </div>
          </div>
          <CardContent className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center text-sm">
            <Monitor className="size-8" />
            <p>Your live preview will render here.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
