"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  File as FileIcon,
  FolderClosed,
  FolderOpen,
  FolderTree,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FileTreeNode } from "@/lib/files/manager";

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
          style={{ paddingLeft: depth * 14 + 8 }}
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
      style={{ paddingLeft: depth * 14 + 26 }}
    >
      <FileIcon className="size-3.5 shrink-0 text-sky-500" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FilesPanel({
  projectId,
  refreshKey = 0,
  className,
}: {
  projectId: string;
  /** Bump to reload the tree (e.g. after an agent build). */
  refreshKey?: number;
  className?: string;
}) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/files`);
      const data = await response.json();
      setTree(data.tree ?? []);
    } catch {
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree, refreshKey]);

  async function openFile(path: string) {
    setSelectedPath(path);
    setContentLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`
      );
      const data = await response.json();
      setContent(data.file?.content ?? "// failed to load file");
    } catch {
      setContent("// failed to load file");
    } finally {
      setContentLoading(false);
    }
  }

  function handleCopy() {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={cn("flex min-h-0", className)}>
      {/* Tree */}
      <div className="flex w-56 shrink-0 flex-col border-r">
        <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <FolderTree className="size-3.5" />
            Files
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => void loadTree()}
            aria-label="Refresh files"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-1.5">
            {loading ? (
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
                  selectedPath={selectedPath}
                  onSelect={(path) => void openFile(path)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Viewer */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
          <span className="text-muted-foreground truncate font-mono text-xs">
            {selectedPath ?? "Select a file"}
          </span>
          {selectedPath ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          ) : null}
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {contentLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading file…
            </div>
          ) : content !== null ? (
            <pre className="p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
              {content}
            </pre>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-center text-sm">
              Select a file from the tree to view its contents.
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
