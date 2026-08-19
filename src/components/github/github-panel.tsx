"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  Plug,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { timeAgo } from "@/lib/utils";
import type { GitHubCommit } from "@/lib/github/client";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

interface Status {
  connected: boolean;
  username: string | null;
  repo: string | null;
  simulated: boolean;
}

export function GitHubPanel({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState("");
  const [repoName, setRepoName] = useState(
    projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
      "my-app"
  );
  const [isPrivate, setIsPrivate] = useState(true);
  const [linkName, setLinkName] = useState("");
  const [commitMessage, setCommitMessage] = useState("Update from App-Creator");
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/github/connection?projectId=${encodeURIComponent(projectId)}`
      );
      if (response.ok) setStatus(await response.json());
    } catch {
      // leave as-is
    }
  }, [projectId]);

  const loadCommits = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/github/commits?projectId=${encodeURIComponent(projectId)}`
      );
      if (response.ok) {
        const data = await response.json();
        setCommits(data.commits ?? []);
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      void loadStatus();
      void loadCommits();
    }
  }, [open, loadStatus, loadCommits]);

  async function call(
    label: string,
    input: RequestInfo,
    init: RequestInit,
    onSuccess?: (data: Record<string, unknown>) => void
  ) {
    setBusy(label);
    try {
      const response = await fetch(input, {
        ...init,
        headers: { "Content-Type": "application/json", ...init.headers },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? `${label} failed`);
      }
      onSuccess?.(data);
      await loadStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${label} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <GithubMark className="size-4" />
          <span className="hidden sm:inline">GitHub</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <GithubMark className="size-4" />
            GitHub
            {status?.simulated ? (
              <Badge variant="outline" className="text-xs">
                demo
              </Badge>
            ) : null}
          </SheetTitle>
          <SheetDescription>
            Export your project to GitHub — create a repository, push and
            pull code, and browse commits.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-4">
            {/* Connection */}
            {!status ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            ) : !status.connected ? (
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="gh-token">Personal access token</Label>
                  <Input
                    id="gh-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_… or github_pat_…"
                  />
                  <p className="text-muted-foreground text-xs">
                    Needs the <code className="font-mono">repo</code> scope.
                    Create one at github.com → Settings → Developer settings.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    void call(
                      "Connect",
                      "/api/github/connection",
                      { method: "POST", body: JSON.stringify({ token }) },
                      () => {
                        setToken("");
                        toast.success("GitHub connected");
                      }
                    )
                  }
                  disabled={busy !== null || token.length < 8}
                >
                  {busy === "Connect" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Plug />
                  )}
                  Connect GitHub
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-500" />
                  <span className="text-sm">
                    Connected as{" "}
                    <span className="font-medium">{status.username}</span>
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void call("Disconnect", "/api/github/connection", {
                      method: "DELETE",
                    })
                  }
                  disabled={busy !== null}
                >
                  <Unplug />
                  Disconnect
                </Button>
              </div>
            )}

            {status?.connected ? (
              <>
                <Separator />

                {/* Repository */}
                {!status.repo ? (
                  <div className="grid gap-4">
                    <div className="grid gap-3">
                      <p className="text-sm font-medium">Create a repository</p>
                      <div className="grid gap-1.5">
                        <Label htmlFor="gh-repo-name">Repository name</Label>
                        <Input
                          id="gh-repo-name"
                          value={repoName}
                          onChange={(e) => setRepoName(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="gh-private">Private repository</Label>
                        <Switch
                          id="gh-private"
                          checked={isPrivate}
                          onCheckedChange={setIsPrivate}
                        />
                      </div>
                      <Button
                        onClick={() =>
                          void call(
                            "Create repository",
                            "/api/github/repos",
                            {
                              method: "POST",
                              body: JSON.stringify({
                                projectId,
                                name: repoName,
                                isPrivate,
                              }),
                            },
                            () => toast.success("Repository created")
                          )
                        }
                        disabled={busy !== null || repoName.length === 0}
                      >
                        {busy === "Create repository" ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <GitBranch />
                        )}
                        Create repository
                      </Button>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="gh-link">…or link an existing one</Label>
                      <div className="flex gap-2">
                        <Input
                          id="gh-link"
                          value={linkName}
                          onChange={(e) => setLinkName(e.target.value)}
                          placeholder="owner/name"
                        />
                        <Button
                          variant="outline"
                          onClick={() =>
                            void call(
                              "Link repository",
                              "/api/github/repos",
                              {
                                method: "PUT",
                                body: JSON.stringify({
                                  projectId,
                                  fullName: linkName,
                                }),
                              },
                              () => toast.success("Repository linked")
                            )
                          }
                          disabled={busy !== null || !linkName.includes("/")}
                        >
                          Link
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm">
                        <GitBranch className="size-4" />
                        <span className="font-mono">{status.repo}</span>
                      </span>
                      <Button variant="ghost" size="icon" className="size-7" asChild>
                        <a
                          href={`https://github.com/${status.repo}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open repository on GitHub"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    </div>

                    {/* Push / pull */}
                    <div className="grid gap-2">
                      <Label htmlFor="gh-message">Commit message</Label>
                      <Input
                        id="gh-message"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() =>
                            void call(
                              "Push",
                              "/api/github/push",
                              {
                                method: "POST",
                                body: JSON.stringify({
                                  projectId,
                                  message: commitMessage,
                                }),
                              },
                              (data) => {
                                toast.success(
                                  `Pushed ${data.fileCount} files`
                                );
                                void loadCommits();
                              }
                            )
                          }
                          disabled={busy !== null}
                        >
                          {busy === "Push" ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <ArrowUpFromLine />
                          )}
                          Push
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            void call(
                              "Pull",
                              "/api/github/pull",
                              {
                                method: "POST",
                                body: JSON.stringify({ projectId }),
                              },
                              (data) => {
                                toast.success(
                                  `Pulled ${data.fileCount} files`
                                );
                                window.dispatchEvent(
                                  new CustomEvent("vfs-changed", {
                                    detail: {},
                                  })
                                );
                              }
                            )
                          }
                          disabled={busy !== null}
                        >
                          {busy === "Pull" ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <ArrowDownToLine />
                          )}
                          Pull
                        </Button>
                      </div>
                    </div>

                    {/* Commit history */}
                    <div className="grid gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <GitCommitHorizontal className="size-4" />
                        Commit history
                      </p>
                      {commits.length === 0 ? (
                        <p className="text-muted-foreground text-xs">
                          No commits yet — push to create the first one.
                        </p>
                      ) : (
                        <ul className="grid gap-1.5">
                          {commits.map((commit) => (
                            <li
                              key={commit.sha}
                              className="rounded-md border px-2.5 py-2"
                            >
                              <p className="truncate text-sm">
                                {commit.message}
                              </p>
                              <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                                <code className="font-mono">
                                  {commit.sha.slice(0, 7)}
                                </code>
                                <span>{commit.author}</span>
                                {commit.date ? (
                                  <span>{timeAgo(commit.date)}</span>
                                ) : null}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
