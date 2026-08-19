"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SandpackConsole,
  SandpackPreview as SandpackPreviewFrame,
  SandpackProvider,
} from "@codesandbox/sandpack-react";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * Sandpack engine: runs the generated static preview through the
 * Sandpack bundler with hot updates — file saves re-fetch the HTML and
 * Sandpack applies the change without a full reload (instant refresh).
 */
export function SandpackEngine({
  projectId,
  showConsole,
  className,
}: {
  projectId: string;
  showConsole: boolean;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/files?path=${encodeURIComponent("preview/index.html")}`
      );
      if (response.ok) {
        const data = await response.json();
        setHtml(data.file.content);
      } else {
        setHtml(null);
      }
    } catch {
      setHtml(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadFiles();
    // Instant refresh: reload when the IDE saves or a build finishes.
    const onChange = () => void loadFiles();
    window.addEventListener("vfs-changed", onChange);
    return () => window.removeEventListener("vfs-changed", onChange);
  }, [loadFiles]);

  if (loading) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center gap-2 text-sm",
          className
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        Loading files…
      </div>
    );
  }

  if (!html) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center p-8 text-center text-sm",
          className
        )}
      >
        No preview file yet — run an agent build first.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <SandpackProvider
        template="static"
        files={{ "/index.html": html }}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        options={{ autorun: true, recompileMode: "immediate" }}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <div className="min-h-0 flex-1 [&_.sp-preview]:h-full [&_.sp-preview-container]:h-full">
          <SandpackPreviewFrame
            showOpenInCodeSandbox={false}
            showRefreshButton
            style={{ height: "100%" }}
          />
        </div>
        {showConsole ? (
          <div className="h-40 shrink-0 border-t">
            <SandpackConsole
              showHeader
              resetOnPreviewRestart
              style={{ height: "100%" }}
            />
          </div>
        ) : null}
      </SandpackProvider>
    </div>
  );
}
