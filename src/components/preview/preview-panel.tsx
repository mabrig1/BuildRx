"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  ExternalLink,
  Maximize,
  Monitor,
  RefreshCw,
  Smartphone,
  SquareTerminal,
  Tablet,
  Zap,
} from "lucide-react";

import dynamic from "next/dynamic";

import {
  ErrorConsole,
  type ConsoleEntry,
} from "@/components/preview/error-console";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePreviewStore } from "@/stores/preview-store";

// Sandpack is a large dependency — load it only when the user switches
// the preview engine to it, keeping it out of the workspace bundle.
const SandpackEngine = dynamic(
  () =>
    import("@/components/preview/sandpack-preview").then(
      (mod) => mod.SandpackEngine
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        Loading Sandpack…
      </div>
    ),
  }
);

const viewportWidths = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
} as const;

type Engine = "static" | "sandpack";

export function PreviewPanel({
  projectId,
  previewUrl,
  className,
}: {
  projectId: string;
  previewUrl: string | null;
  className?: string;
}) {
  const { viewport, setViewport } = usePreviewStore();
  const [engine, setEngine] = useState<Engine>("static");
  const [reloadKey, setReloadKey] = useState(0);
  const [showConsole, setShowConsole] = useState(false);
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const shellRef = useRef<HTMLDivElement>(null);

  // Error console feed: the served preview forwards runtime errors via
  // postMessage (injected by /api/preview).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const payload = event.data?.__previewEvent as
        | { level: "error" | "warn"; text: string }
        | undefined;
      if (payload) {
        setEntries((prev) => [
          ...prev.slice(-199),
          { level: payload.level, text: payload.text, at: Date.now() },
        ]);
        if (payload.level === "error") setShowConsole(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Instant refresh: reload the static iframe whenever files change
  // (IDE auto-save or agent build).
  useEffect(() => {
    const onChange = () => setReloadKey((k) => k + 1);
    window.addEventListener("vfs-changed", onChange);
    return () => window.removeEventListener("vfs-changed", onChange);
  }, []);

  const enterFullscreen = useCallback(() => {
    void shellRef.current?.requestFullscreen?.();
  }, []);

  return (
    <div ref={shellRef} className={cn("bg-background flex min-h-0 flex-col", className)}>
      {/* Browser chrome */}
      <div className="bg-muted/50 flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <div className="hidden gap-1.5 sm:flex">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-yellow-400" />
          <span className="size-2.5 rounded-full bg-green-400" />
        </div>

        <Select value={engine} onValueChange={(v) => setEngine(v as Engine)}>
          <SelectTrigger size="sm" className="h-7 w-[7.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="static">
              <Zap className="size-3.5" />
              Instant
            </SelectItem>
            <SelectItem value="sandpack">
              <Boxes className="size-3.5" />
              Sandpack
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="bg-background text-muted-foreground mx-1 hidden h-7 min-w-0 flex-1 items-center justify-center truncate rounded-md border px-3 text-xs md:flex">
          {previewUrl ?? `preview.app-creator.dev/${projectId.slice(0, 8)}`}
        </div>

        <div className="ml-auto flex items-center">
          {(
            [
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const
          ).map(([mode, Icon]) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-8",
                    viewport === mode && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => setViewport(mode)}
                  aria-label={`${mode} viewport`}
                >
                  <Icon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="capitalize">{mode}</TooltipContent>
            </Tooltip>
          ))}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setReloadKey((k) => k + 1)}
                aria-label="Refresh preview"
              >
                <RefreshCw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8", showConsole && "bg-accent")}
                onClick={() => setShowConsole((s) => !s)}
                aria-label="Toggle console"
              >
                <SquareTerminal className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Console{" "}
              {entries.filter((e) => e.level === "error").length > 0
                ? `(${entries.filter((e) => e.level === "error").length} errors)`
                : ""}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={enterFullscreen}
                aria-label="Fullscreen preview"
              >
                <Maximize className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fullscreen</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" asChild>
                <Link
                  href={`/preview/${projectId}/container`}
                  target="_blank"
                  aria-label="Run in WebContainer"
                >
                  <Boxes className="size-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Run in WebContainer (new tab)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" asChild>
                <Link
                  href={`/preview/${projectId}`}
                  target="_blank"
                  aria-label="Open full preview"
                >
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in new tab</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Engine viewport */}
      {engine === "sandpack" ? (
        <SandpackEngine
          projectId={projectId}
          showConsole={showConsole}
          className="min-h-0 flex-1"
        />
      ) : (
        <>
          <div className="bg-muted/40 flex min-h-0 flex-1 items-stretch justify-center overflow-auto p-4">
            <div
              className="bg-background flex flex-col overflow-hidden rounded-lg border shadow-sm transition-[width] duration-200"
              style={{ width: viewportWidths[viewport], maxWidth: "100%" }}
            >
              {previewUrl ? (
                <iframe
                  key={reloadKey}
                  src={previewUrl}
                  title="Live preview"
                  className="size-full flex-1"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              ) : (
                <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm">
                  <Monitor className="size-8" />
                  <div className="space-y-1">
                    <p className="text-foreground font-medium">
                      Preview not available yet
                    </p>
                    <p>
                      Chat with AI or run a build — your app will render here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          {showConsole ? (
            <ErrorConsole
              entries={entries}
              onClear={() => setEntries([])}
              className="h-40 shrink-0"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
