"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { editor } from "monaco-editor";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  File as FileIcon,
  FolderClosed,
  FolderOpen,
  FolderTree,
  Loader2,
  RefreshCw,
  Replace,
  Save,
  Search,
  SquareTerminal,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import {
  monacoLanguageFor,
  setupMonaco,
} from "@/components/editor/monaco-setup";
import { TerminalPanel } from "@/components/editor/terminal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { FileTreeNode } from "@/lib/files/manager";

const MonacoEditor = dynamic(
  async () => {
    await setupMonaco();
    return (await import("@monaco-editor/react")).default;
  },
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading editor…
      </div>
    ),
  }
);

const AUTO_SAVE_DELAY_MS = 1200;

interface OpenTab {
  path: string;
  content: string;
  dirty: boolean;
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (node.type === "dir") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm"
          style={{ paddingLeft: depth * 12 + 8 }}
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
          {open ? (
            <FolderOpen className="size-3.5 shrink-0 text-amber-500" />
          ) : (
            <FolderClosed className="size-3.5 shrink-0 text-amber-500" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open
          ? node.children?.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))
          : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm",
        selectedPath === node.path
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
      )}
      style={{ paddingLeft: depth * 12 + 24 }}
    >
      <FileIcon className="size-3.5 shrink-0 text-sky-500" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function CodeEditorIde({
  projectId,
  refreshKey = 0,
  className,
}: {
  projectId: string;
  refreshKey?: number;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [showTerminal, setShowTerminal] = useState(false);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/files`);
      const data = await response.json();
      setTree(data.tree ?? []);
      setFilePaths(
        ((data.files ?? []) as Array<{ path: string }>).map((f) => f.path)
      );
    } catch {
      setTree([]);
      setFilePaths([]);
    } finally {
      setTreeLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree, refreshKey]);

  const activeTab = tabs.find((t) => t.path === activePath) ?? null;

  async function openFile(path: string) {
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      setActivePath(path);
      return;
    }
    try {
      const response = await fetch(
        `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      setTabs((prev) => [
        ...prev,
        { path, content: data.file.content, dirty: false },
      ]);
      setActivePath(path);
    } catch {
      toast.error(`Failed to open ${path}`);
    }
  }

  function closeTab(path: string) {
    const timer = saveTimers.current.get(path);
    if (timer) clearTimeout(timer);
    setTabs((prev) => {
      const next = prev.filter((t) => t.path !== path);
      if (activePath === path) {
        setActivePath(next.length > 0 ? next[next.length - 1].path : null);
      }
      return next;
    });
  }

  const saveFile = useCallback(
    async (path: string, content: string) => {
      setSaveState("saving");
      try {
        const response = await fetch(`/api/projects/${projectId}/files`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, content }),
        });
        if (!response.ok) throw new Error();
        setTabs((prev) =>
          prev.map((t) =>
            t.path === path && t.content === content
              ? { ...t, dirty: false }
              : t
          )
        );
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("idle");
        toast.error(`Failed to save ${path}`);
      }
    },
    [projectId]
  );

  function handleChange(value: string | undefined) {
    if (!activePath || value === undefined) return;
    const path = activePath;
    setTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, content: value, dirty: true } : t))
    );

    // Auto-save (debounced per file).
    const existing = saveTimers.current.get(path);
    if (existing) clearTimeout(existing);
    saveTimers.current.set(
      path,
      setTimeout(() => void saveFile(path, value), AUTO_SAVE_DELAY_MS)
    );
  }

  function saveNow() {
    if (!activeTab) return;
    const timer = saveTimers.current.get(activeTab.path);
    if (timer) clearTimeout(timer);
    void saveFile(activeTab.path, activeTab.content);
  }

  function triggerFind(replace: boolean) {
    editorRef.current?.focus();
    editorRef.current?.trigger(
      "toolbar",
      replace ? "editor.action.startFindReplaceAction" : "actions.find",
      undefined
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex min-h-0 flex-1">
        {/* Explorer */}
        <div className="flex w-52 shrink-0 flex-col border-r">
          <div className="flex h-9 shrink-0 items-center justify-between border-b px-2.5">
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
              <FolderTree className="size-3.5" />
              Explorer
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => void loadTree()}
              aria-label="Refresh files"
            >
              <RefreshCw
                className={cn("size-3.5", treeLoading && "animate-spin")}
              />
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-1.5">
              {treeLoading ? (
                <p className="text-muted-foreground px-2 py-4 text-center text-xs">
                  Loading…
                </p>
              ) : tree.length === 0 ? (
                <p className="text-muted-foreground px-2 py-4 text-center text-xs">
                  No files yet — run a build to generate your project.
                </p>
              ) : (
                tree.map((node) => (
                  <TreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedPath={activePath}
                    onSelect={(path) => void openFile(path)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Editor column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Tabs + toolbar */}
          <div className="flex h-9 shrink-0 items-stretch border-b">
            <ScrollArea className="min-w-0 flex-1">
              <div className="flex h-9 items-stretch">
                {tabs.map((tab) => (
                  <div
                    key={tab.path}
                    className={cn(
                      "group flex shrink-0 cursor-pointer items-center gap-1.5 border-r px-3 text-xs",
                      tab.path === activePath
                        ? "bg-background text-foreground"
                        : "text-muted-foreground bg-muted/40 hover:text-foreground"
                    )}
                    onClick={() => setActivePath(tab.path)}
                    role="tab"
                    aria-selected={tab.path === activePath}
                  >
                    {tab.dirty ? (
                      <CircleDot className="size-3 text-amber-500" />
                    ) : (
                      <FileIcon className="size-3" />
                    )}
                    <span className="max-w-40 truncate">
                      {tab.path.split("/").pop()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.path);
                      }}
                      className="hover:bg-accent rounded p-0.5 opacity-0 group-hover:opacity-100"
                      aria-label={`Close ${tab.path}`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex shrink-0 items-center gap-0.5 border-l px-1.5">
              {saveState !== "idle" ? (
                <span className="text-muted-foreground flex items-center gap-1 px-1 text-xs">
                  {saveState === "saving" ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3 text-emerald-500" />
                  )}
                  {saveState === "saving" ? "Saving" : "Saved"}
                </span>
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => triggerFind(false)}
                    disabled={!activeTab}
                    aria-label="Search"
                  >
                    <Search className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Search (Ctrl+F)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => triggerFind(true)}
                    disabled={!activeTab}
                    aria-label="Replace"
                  >
                    <Replace className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Replace (Ctrl+H)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={saveNow}
                    disabled={!activeTab?.dirty}
                    aria-label="Save"
                  >
                    <Save className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save now</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("size-7", showTerminal && "bg-accent")}
                    onClick={() => setShowTerminal((s) => !s)}
                    aria-label="Toggle terminal"
                  >
                    <SquareTerminal className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Terminal</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Editor */}
          <div className="min-h-0 flex-1">
            {activeTab ? (
              <MonacoEditor
                path={activeTab.path}
                language={monacoLanguageFor(activeTab.path)}
                value={activeTab.content}
                onChange={handleChange}
                onMount={(editorInstance) => {
                  editorRef.current = editorInstance;
                }}
                theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 8 },
                  wordWrap: "on",
                  tabSize: 2,
                }}
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-center text-sm">
                Open a file from the explorer to start editing.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Terminal */}
      {showTerminal ? (
        <TerminalPanel
          projectId={projectId}
          filePaths={filePaths}
          onFilesChanged={() => void loadTree()}
          className="h-48 shrink-0 border-t"
        />
      ) : null}
    </div>
  );
}
