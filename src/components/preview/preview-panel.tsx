"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePreviewStore } from "@/stores/preview-store";

const viewportWidths = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
} as const;

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
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* Browser chrome */}
      <div className="bg-muted/50 flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-yellow-400" />
          <span className="size-2.5 rounded-full bg-green-400" />
        </div>
        <div className="bg-background text-muted-foreground mx-2 flex h-7 min-w-0 flex-1 items-center justify-center truncate rounded-md border px-3 text-xs">
          {previewUrl ?? `preview.app-creator.dev/${projectId.slice(0, 8)}`}
        </div>
        <div className="flex items-center">
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
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Refresh preview"
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link
              href={`/preview/${projectId}`}
              target="_blank"
              aria-label="Open full preview"
            >
              <ExternalLink className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Viewport */}
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
                <p>Chat with AI to generate your app — it will render here.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
