"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Columns2, Code2, Monitor } from "lucide-react";

import { CodeEditorIde } from "@/components/editor/code-editor-ide";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { Button } from "@/components/ui/button";
import {
  clampCodePercent,
  codePercentFromPointer,
  DEFAULT_WORKBENCH_LAYOUT,
  MAX_CODE_PERCENT,
  MIN_CODE_PERCENT,
  parseWorkbenchLayout,
  type DesktopWorkbenchMode,
} from "@/lib/workspace-layout";
import { cn } from "@/lib/utils";

/**
 * Persistent workbench: code and preview are distinct live panes, not
 * competing tabs. Wide screens default to a resizable split; small
 * screens use the parent workspace's accessible Code/Preview tabs.
 *
 * Neither pane is unmounted when its sibling gets focus. This preserves
 * Monaco's unsaved editor state and the running preview instance.
 */
export function RightPanel({
  projectId,
  previewUrl,
  filesRefreshKey = 0,
  compactView = "preview",
  className,
}: {
  projectId: string;
  previewUrl: string | null;
  filesRefreshKey?: number;
  compactView?: "code" | "preview";
  className?: string;
}) {
  const [desktopMode, setDesktopMode] = useState<DesktopWorkbenchMode>(
    DEFAULT_WORKBENCH_LAYOUT.mode
  );
  const [codePercent, setCodePercent] = useState(DEFAULT_WORKBENCH_LAYOUT.codePercent);
  const [wide, setWide] = useState(false);
  const [restored, setRestored] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  const storageKey = `buildrx:workbench:${projectId}`;

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    try {
      const value = parseWorkbenchLayout(window.localStorage.getItem(storageKey));
      setDesktopMode(value.mode);
      setCodePercent(value.codePercent);
    } catch {
      setDesktopMode(DEFAULT_WORKBENCH_LAYOUT.mode);
      setCodePercent(DEFAULT_WORKBENCH_LAYOUT.codePercent);
    }
    setRestored(true);
  }, [storageKey]);

  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ mode: desktopMode, codePercent })
      );
    } catch {
      // Private browsing can disable storage; controls still work in memory.
    }
  }, [codePercent, desktopMode, restored, storageKey]);

  const mode: DesktopWorkbenchMode = wide ? desktopMode : compactView;
  const isSplit = mode === "split";

  function updatePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = paneRef.current?.getBoundingClientRect();
    if (bounds) {
      setCodePercent(codePercentFromPointer(event.clientX, bounds.left, bounds.width));
    }
  }

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isSplit) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePointer(event);
  }

  function continueResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      updatePointer(event);
    }
  }

  function stopResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function keyboardResize(event: ReactKeyboardEvent<HTMLDivElement>) {
    const adjustments: Record<string, number> = {
      ArrowLeft: -5,
      ArrowRight: 5,
    };
    if (event.key in adjustments) {
      event.preventDefault();
      setCodePercent((value) => clampCodePercent(value + adjustments[event.key]));
    } else if (event.key === "Home") {
      event.preventDefault();
      setCodePercent(MIN_CODE_PERCENT);
    } else if (event.key === "End") {
      event.preventDefault();
      setCodePercent(MAX_CODE_PERCENT);
    }
  }

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col", className)}>
      <div className="hidden h-10 shrink-0 items-center justify-between gap-2 border-b px-3 xl:flex">
        <div className="flex items-center gap-1" role="group" aria-label="Workbench layout">
          {([
            ["split", Columns2, "Split code and preview"],
            ["code", Code2, "Focus code editor"],
            ["preview", Monitor, "Focus live preview"],
          ] as const).map(([value, Icon, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={desktopMode === value ? "secondary" : "ghost"}
              aria-label={label}
              aria-pressed={desktopMode === value}
              onClick={() => setDesktopMode(value)}
              className="h-8 gap-1.5 px-2.5 text-xs"
            >
              <Icon className="size-3.5" aria-hidden />
              {value === "split" ? "Split" : value === "code" ? "Code" : "Preview"}
            </Button>
          ))}
        </div>
        <span className="text-muted-foreground hidden truncate text-xs 2xl:block">
          Code edits save automatically · Instant preview uses preview/index.html
        </span>
      </div>

      <div
        ref={paneRef}
        data-testid="code-preview-layout"
        data-mode={mode}
        className="grid min-h-0 min-w-0 flex-1 overflow-hidden"
        style={{
          gridTemplateColumns: isSplit
            ? `minmax(0, ${codePercent}fr) 8px minmax(0, ${100 - codePercent}fr)`
            : "minmax(0, 1fr)",
        }}
      >
        <section
          aria-label="Editable source code"
          className={cn("min-h-0 min-w-0 overflow-hidden", mode === "preview" && "hidden")}
        >
          <CodeEditorIde
            projectId={projectId}
            refreshKey={filesRefreshKey}
            className="h-full min-h-0 min-w-0"
          />
        </section>

        {isSplit ? (
          <div
            role="separator"
            tabIndex={0}
            aria-label="Resize source code and preview"
            aria-orientation="vertical"
            aria-valuemin={MIN_CODE_PERCENT}
            aria-valuemax={MAX_CODE_PERCENT}
            aria-valuenow={codePercent}
            title="Drag to resize · Arrow keys to adjust · Home/End for limits"
            onPointerDown={startResize}
            onPointerMove={continueResize}
            onPointerUp={stopResize}
            onPointerCancel={stopResize}
            onKeyDown={keyboardResize}
            onDoubleClick={() => setCodePercent(DEFAULT_WORKBENCH_LAYOUT.codePercent)}
            className="group flex cursor-col-resize touch-none items-center justify-center border-x bg-muted/40 outline-none transition-colors hover:bg-primary/15 focus-visible:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <span aria-hidden="true" className="h-10 w-1 rounded-full bg-border group-hover:bg-primary/50" />
          </div>
        ) : null}

        <section
          aria-label="Interactive app preview"
          className={cn("min-h-0 min-w-0 overflow-hidden", mode === "code" && "hidden")}
        >
          <PreviewPanel
            projectId={projectId}
            previewUrl={previewUrl}
            className="h-full min-h-0 min-w-0"
          />
        </section>
      </div>
    </div>
  );
}
