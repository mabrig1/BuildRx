"use client";

import { useState } from "react";
import { Code2, Monitor } from "lucide-react";

import { CodeEditorIde } from "@/components/editor/code-editor-ide";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Right side of the workspace: live preview + generated code explorer. */
export function RightPanel({
  projectId,
  previewUrl,
  filesRefreshKey = 0,
  className,
}: {
  projectId: string;
  previewUrl: string | null;
  filesRefreshKey?: number;
  className?: string;
}) {
  const [view, setView] = useState<"preview" | "code">("preview");

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex h-10 shrink-0 items-center border-b px-2">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as "preview" | "code")}
        >
          <TabsList className="h-7">
            <TabsTrigger value="preview" className="gap-1.5 px-2.5 text-xs">
              <Monitor className="size-3.5" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-1.5 px-2.5 text-xs">
              <Code2 className="size-3.5" />
              Code
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <PreviewPanel
        projectId={projectId}
        previewUrl={previewUrl}
        className={cn("min-h-0 flex-1", view !== "preview" && "hidden")}
      />
      <CodeEditorIde
        projectId={projectId}
        refreshKey={filesRefreshKey}
        className={cn("min-h-0 flex-1", view !== "code" && "hidden")}
      />
    </div>
  );
}
