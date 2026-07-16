"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FileSystemTree, WebContainer } from "@webcontainer/api";
import { ArrowLeft, Boxes, Globe, Loader2 } from "lucide-react";

import {
  ErrorConsole,
  type ConsoleEntry,
} from "@/components/preview/error-console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type RunnerStatus =
  | "loading-files"
  | "booting"
  | "mounting"
  | "installing"
  | "starting"
  | "ready"
  | "failed";

const STATUS_LABELS: Record<RunnerStatus, string> = {
  "loading-files": "Loading project files…",
  booting: "Booting WebContainer…",
  mounting: "Mounting filesystem…",
  installing: "Installing dependencies…",
  starting: "Starting dev server…",
  ready: "Running",
  failed: "Failed",
};

function toFileSystemTree(
  files: Array<{ path: string; content: string }>
): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const file of files) {
    const segments = file.path.split("/");
    let level: FileSystemTree = tree;
    segments.forEach((segment, index) => {
      if (index === segments.length - 1) {
        level[segment] = { file: { contents: file.content } };
      } else {
        const existing = level[segment];
        if (existing && "directory" in existing) {
          level = existing.directory;
        } else {
          const dir: FileSystemTree = {};
          level[segment] = { directory: dir };
          level = dir;
        }
      }
    });
  }
  return tree;
}

/**
 * Boots the generated project in a WebContainer (Node.js in the
 * browser): mounts the virtual filesystem, npm installs, runs the dev
 * server, and renders it in an iframe. Requires the cross-origin
 * isolation headers served on this route.
 */
export function WebContainerRunner({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<RunnerStatus>("loading-files");
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const containerRef = useRef<WebContainer | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const log = (level: ConsoleEntry["level"], text: string) =>
      setEntries((prev) => [...prev, { level, text, at: Date.now() }]);

    async function run() {
      try {
        if (!window.crossOriginIsolated) {
          log(
            "warn",
            "Page is not cross-origin isolated — WebContainers need COOP/COEP headers (served on this route; check for proxies stripping them)."
          );
        }

        const response = await fetch(`/api/projects/${projectId}/files`);
        const data = await response.json();
        const paths: Array<{ path: string }> = data.files ?? [];
        if (paths.length === 0) {
          setStatus("failed");
          log("error", "No project files found — run an agent build first.");
          return;
        }
        const files = await Promise.all(
          paths.map(async ({ path }) => {
            const res = await fetch(
              `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`
            );
            const body = await res.json();
            return { path, content: body.file.content as string };
          })
        );
        log("info", `Loaded ${files.length} files from the project.`);

        setStatus("booting");
        const { WebContainer } = await import("@webcontainer/api");
        // Boot hangs (rather than throwing) when the StackBlitz runtime
        // can't be fetched — bound it so users get a clear failure.
        const container = await Promise.race([
          WebContainer.boot(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "WebContainer boot timed out after 20s. This usually means the StackBlitz runtime CDN is unreachable from your network."
                  )
                ),
              20_000
            )
          ),
        ]);
        containerRef.current = container;

        setStatus("mounting");
        await container.mount(toFileSystemTree(files));
        log("info", "Filesystem mounted.");

        // Instant refresh: propagate saves from the same tab into the
        // running container (dev servers hot-reload on file change).
        const onVfsChanged = async (event: Event) => {
          const detail = (event as CustomEvent<{ path?: string }>).detail;
          if (!detail?.path) return;
          try {
            const res = await fetch(
              `/api/projects/${projectId}/files?path=${encodeURIComponent(detail.path)}`
            );
            if (res.ok) {
              const body = await res.json();
              await container.fs.writeFile(
                `/${detail.path}`,
                body.file.content
              );
              log("info", `Synced ${detail.path} into the container.`);
            }
          } catch {
            // best effort
          }
        };
        window.addEventListener("vfs-changed", onVfsChanged);

        container.on("server-ready", (_port, url) => {
          setServerUrl(url);
          setStatus("ready");
          log("info", `Dev server ready at ${url}`);
        });
        container.on("error", (error) => {
          log("error", `WebContainer error: ${error.message}`);
        });

        const hasPackageJson = files.some((f) => f.path === "package.json");
        if (!hasPackageJson) {
          // Static project — serve it with a tiny http server.
          log("info", "No package.json — serving files statically.");
          setStatus("starting");
          const server = await container.spawn("npx", [
            "-y",
            "serve",
            "-l",
            "3000",
            "preview",
          ]);
          void server.output.pipeTo(
            new WritableStream({
              write: (chunk) => log("info", chunk),
            })
          );
          return;
        }

        setStatus("installing");
        log("info", "$ npm install");
        const install = await container.spawn("npm", ["install"]);
        void install.output.pipeTo(
          new WritableStream({ write: (chunk) => log("info", chunk) })
        );
        const installExit = await install.exit;
        if (installExit !== 0) {
          setStatus("failed");
          log("error", `npm install exited with code ${installExit}`);
          return;
        }

        setStatus("starting");
        log("info", "$ npm run dev");
        const dev = await container.spawn("npm", ["run", "dev"]);
        void dev.output.pipeTo(
          new WritableStream({ write: (chunk) => log("info", chunk) })
        );
      } catch (error) {
        setStatus("failed");
        log(
          "error",
          error instanceof Error
            ? `${error.message} — WebContainers require a Chromium-based browser, cross-origin isolation, and network access to the StackBlitz runtime.`
            : "WebContainer boot failed."
        );
      }
    }

    void run();
    return () => {
      containerRef.current?.teardown();
    };
  }, [projectId]);

  return (
    <div className="flex h-svh flex-col bg-zinc-950 text-zinc-100">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800 px-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          asChild
        >
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft />
            Workspace
          </Link>
        </Button>
        <span className="flex items-center gap-2 text-sm font-medium">
          <Boxes className="size-4 text-violet-400" />
          WebContainer
        </span>
        <Badge
          variant="outline"
          className={
            status === "ready"
              ? "border-emerald-500/40 text-emerald-400"
              : status === "failed"
                ? "border-red-500/40 text-red-400"
                : "border-zinc-700 text-zinc-300"
          }
        >
          {status !== "ready" && status !== "failed" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : null}
          {STATUS_LABELS[status]}
        </Badge>
        {serverUrl ? (
          <span className="flex items-center gap-1.5 truncate font-mono text-xs text-zinc-400">
            <Globe className="size-3.5" />
            {serverUrl}
          </span>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 bg-white">
        {serverUrl ? (
          <iframe
            src={serverUrl}
            title="WebContainer preview"
            className="size-full"
            allow="cross-origin-isolated"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-950">
            <div className="flex items-center gap-3 text-zinc-400">
              {status === "failed" ? (
                <span>Boot failed — see the console below.</span>
              ) : (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span>{STATUS_LABELS[status]}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <ErrorConsole
        entries={entries}
        onClear={() => setEntries([])}
        className="h-56 shrink-0"
      />
    </div>
  );
}
