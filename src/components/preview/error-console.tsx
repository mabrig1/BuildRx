"use client";

import { useEffect, useRef } from "react";
import { Ban, TriangleAlert, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConsoleEntry {
  level: "error" | "warn" | "info";
  text: string;
  at: number;
}

export function ErrorConsole({
  entries,
  onClear,
  className,
}: {
  entries: ConsoleEntry[];
  onClear: () => void;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries]);

  return (
    <div className={cn("flex flex-col border-t bg-zinc-950", className)}>
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
        <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
          Console
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          onClick={onClear}
        >
          <Ban className="size-3" />
          Clear
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-2 font-mono text-[12px] leading-relaxed"
      >
        {entries.length === 0 ? (
          <p className="px-1 text-zinc-600">No errors or warnings.</p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start gap-1.5 border-b border-zinc-900 px-1 py-1 whitespace-pre-wrap",
                entry.level === "error" && "text-red-400",
                entry.level === "warn" && "text-amber-400",
                entry.level === "info" && "text-zinc-300"
              )}
            >
              {entry.level === "error" ? (
                <Ban className="mt-0.5 size-3 shrink-0" />
              ) : entry.level === "warn" ? (
                <TriangleAlert className="mt-0.5 size-3 shrink-0" />
              ) : (
                <Info className="mt-0.5 size-3 shrink-0" />
              )}
              <span className="min-w-0 flex-1">{entry.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
