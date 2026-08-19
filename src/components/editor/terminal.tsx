"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface TerminalLine {
  kind: "input" | "output" | "error";
  text: string;
}

const BANNER = "App-Creator shell — type `help` for commands";

/**
 * Simulated terminal over the project's virtual filesystem.
 * Supports: help, ls, cat, echo, pwd, whoami, date, npm run build, clear.
 */
export function TerminalPanel({
  projectId,
  filePaths,
  onFilesChanged,
  className,
}: {
  projectId: string;
  filePaths: string[];
  onFilesChanged?: () => void;
  className?: string;
}) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { kind: "output", text: BANNER },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  function print(text: string, kind: TerminalLine["kind"] = "output") {
    setLines((prev) => [...prev, { kind, text }]);
  }

  async function execute(raw: string) {
    const command = raw.trim();
    setLines((prev) => [...prev, { kind: "input", text: `$ ${command}` }]);
    if (!command) return;
    setHistory((prev) => [command, ...prev].slice(0, 50));
    setHistoryIndex(-1);

    const [cmd, ...args] = command.split(/\s+/);

    switch (cmd) {
      case "help":
        print(
          [
            "Available commands:",
            "  ls [dir]         list project files",
            "  cat <path>       print a file",
            "  rm <path>        delete a file",
            "  echo <text>      print text",
            "  pwd, whoami, date",
            "  npm run build    simulate a build",
            "  clear            clear the terminal",
          ].join("\n")
        );
        break;

      case "ls": {
        const prefix = args[0]?.replace(/\/$/, "");
        const scoped = prefix
          ? filePaths.filter((p) => p.startsWith(`${prefix}/`) || p === prefix)
          : filePaths;
        if (scoped.length === 0) {
          print(prefix ? `ls: ${prefix}: no such directory` : "(no files)", "error");
          break;
        }
        const stripped = prefix
          ? scoped.map((p) => p.slice(prefix.length + 1) || p)
          : scoped;
        const top = [...new Set(stripped.map((p) => p.split("/")[0] + (p.includes("/") ? "/" : "")))];
        print(top.sort().join("\n"));
        break;
      }

      case "cat": {
        if (!args[0]) {
          print("cat: missing file path", "error");
          break;
        }
        try {
          const response = await fetch(
            `/api/projects/${projectId}/files?path=${encodeURIComponent(args[0])}`
          );
          if (!response.ok) {
            print(`cat: ${args[0]}: no such file`, "error");
            break;
          }
          const data = await response.json();
          print(data.file.content);
        } catch {
          print(`cat: failed to read ${args[0]}`, "error");
        }
        break;
      }

      case "rm": {
        if (!args[0]) {
          print("rm: missing file path", "error");
          break;
        }
        try {
          const response = await fetch(
            `/api/projects/${projectId}/files?path=${encodeURIComponent(args[0])}`,
            { method: "DELETE" }
          );
          if (!response.ok) {
            print(`rm: ${args[0]}: cannot delete`, "error");
            break;
          }
          print(`removed ${args[0]}`);
          onFilesChanged?.();
        } catch {
          print(`rm: failed to delete ${args[0]}`, "error");
        }
        break;
      }

      case "echo":
        print(args.join(" "));
        break;

      case "pwd":
        print(`/workspace/${projectId}`);
        break;

      case "whoami":
        print("builder");
        break;

      case "date":
        print(new Date().toString());
        break;

      case "npm": {
        if (args.join(" ") === "run build") {
          print("> next build\n");
          await new Promise((r) => setTimeout(r, 400));
          print("   ▲ Next.js 15");
          await new Promise((r) => setTimeout(r, 500));
          print(" ✓ Compiled successfully");
          print(` ✓ ${filePaths.length} files bundled`);
          print("\nBuild complete.");
        } else {
          print(`npm: unknown script "${args.join(" ")}"`, "error");
        }
        break;
      }

      case "clear":
        setLines([]);
        break;

      default:
        print(`${cmd}: command not found (try \`help\`)`, "error");
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      const value = input;
      setInput("");
      void execute(value);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(historyIndex + 1, history.length - 1);
      if (history[next]) {
        setHistoryIndex(next);
        setInput(history[next]);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setInput(next >= 0 ? (history[next] ?? "") : "");
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-zinc-950 font-mono text-[12.5px] text-zinc-200",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
        {lines.map((line, index) => (
          <pre
            key={index}
            className={cn(
              "whitespace-pre-wrap",
              line.kind === "input" && "text-emerald-400",
              line.kind === "error" && "text-red-400"
            )}
          >
            {line.text}
          </pre>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none placeholder:text-zinc-600"
            placeholder="type a command…"
            spellCheck={false}
            aria-label="Terminal input"
          />
        </div>
      </div>
    </div>
  );
}
