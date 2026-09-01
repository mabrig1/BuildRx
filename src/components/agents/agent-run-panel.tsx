"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Brain,
  Bug,
  Check,
  ClipboardCheck,
  Code2,
  Compass,
  Database,
  FileCode,
  Hammer,
  Loader2,
  Palette,
  Rocket,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AgentEvent, AgentName } from "@/lib/agents/types";
import { AGENT_LABELS, AGENT_ORDER } from "@/lib/agents/types";

const AGENT_ICONS: Record<AgentName, typeof Brain> = {
  planner: Brain,
  founder_ops: Hammer,
  architect: Compass,
  ui: Palette,
  database: Database,
  coding: Code2,
  debug: Bug,
  security: ShieldCheck,
  qa: ClipboardCheck,
  repair: Wrench,
  deployment: Rocket,
};

const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  planner: "Understands requirements",
  founder_ops: "Defines production gates",
  architect: "Designs the structure",
  ui: "Generates pages & components",
  database: "Creates database schema",
  coding: "Writes application code",
  debug: "Reviews & diagnoses",
  security: "Scans for security issues",
  qa: "Runs build & test checks",
  repair: "Fixes what checks found",
  deployment: "Deploys & verifies",
};

/**
 * "degraded" sits between done and error on purpose: the step wrote its
 * files, but from a scaffold rather than a model, and showing that as a
 * green tick is what made a template look like a generated app.
 */
type StepStatus = "pending" | "running" | "done" | "degraded" | "error";

interface StepState {
  status: StepStatus;
  message: string;
}

function initialSteps(): Record<AgentName, StepState> {
  return Object.fromEntries(
    AGENT_ORDER.map((name) => [name, { status: "pending", message: "" }])
  ) as Record<AgentName, StepState>;
}

export function AgentRunPanel({
  projectId,
  defaultPrompt,
  onDeployed,
}: {
  projectId: string;
  defaultPrompt?: string;
  onDeployed?: (previewUrl: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt ?? "");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState(initialSteps);
  const [files, setFiles] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  // A ref, not state: workflow_complete can arrive in the same batch as
  // the degraded events it needs to count, and a queued setState would
  // still read as empty when the summary toast fires.
  const degradedRef = useRef<string[]>([]);

  function applyEvent(event: AgentEvent) {
    switch (event.type) {
      case "agent_start":
        setSteps((prev) => ({
          ...prev,
          [event.agent]: { status: "running", message: event.message },
        }));
        break;
      case "heartbeat":
        setSteps((prev) => ({
          ...prev,
          [event.agent]: {
            ...prev[event.agent],
            message: `${prev[event.agent].message.replace(/ \(\d+s\)$/, "")} (${Math.round(event.elapsedMs / 1000)}s)`,
          },
        }));
        break;
      case "agent_log":
        setSteps((prev) => ({
          ...prev,
          [event.agent]: { ...prev[event.agent], message: event.message },
        }));
        break;
      case "agent_complete":
        setSteps((prev) => ({
          ...prev,
          [event.agent]: { status: "done", message: event.message },
        }));
        break;
      case "file":
        setFiles((prev) =>
          prev.includes(event.path) ? prev : [...prev, event.path]
        );
        break;
      case "workflow_complete": {
        setFinished(true);
        const degradedCount = degradedRef.current.length;
        if (degradedCount === 0) {
          toast.success(`Build complete — ${event.fileCount} files generated`);
        } else {
          toast.warning(
            `Build finished with ${degradedCount} step(s) degraded`,
            {
              description:
                "Parts of this app are built-in scaffolding, not generated from your description. See each step for why.",
            }
          );
        }
        window.dispatchEvent(new CustomEvent("vfs-changed", { detail: {} }));
        onDeployed?.(event.previewUrl);
        break;
      }
      case "agent_degraded":
        degradedRef.current = [...degradedRef.current, event.message];
        // Not an error — the step produced files — but not a success
        // either. It gets its own status so the row can't read as "done".
        if (event.agent) {
          setSteps((prev) => ({
            ...prev,
            [event.agent as AgentName]: {
              status: "degraded",
              message: `${event.message} ${event.suggestedFix}`,
            },
          }));
        }
        toast.warning(event.message, { description: event.suggestedFix });
        break;
      case "error":
        if (event.agent) {
          setSteps((prev) => ({
            ...prev,
            [event.agent as AgentName]: {
              status: "error",
              message: event.suggestedFix
                ? `${event.message} — ${event.suggestedFix}`
                : event.message,
            },
          }));
        }
        toast.error(event.message, {
          description: event.suggestedFix ?? event.cause,
        });
        break;
    }
  }

  async function run() {
    if (prompt.trim().length < 10) {
      toast.error("Describe your app in at least 10 characters.");
      return;
    }
    setRunning(true);
    setFinished(false);
    setSteps(initialSteps());
    setFiles([]);
    degradedRef.current = [];

    try {
      const response = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt: prompt.trim() }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to start the build");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            applyEvent(JSON.parse(line) as AgentEvent);
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start the build"
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Hammer className="size-4" />
          <span className="hidden sm:inline">Build app</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Hammer className="size-4" />
            Agent build
          </SheetTitle>
          <SheetDescription>
            Six specialized agents collaborate to plan, build, debug, and
            deploy your app.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-4">
            {/* Prompt */}
            <div className="grid gap-2">
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the app the agents should build…"
                className="min-h-20 resize-none"
                disabled={running}
              />
              <Button onClick={run} disabled={running} className="w-full">
                {running ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Agents working…
                  </>
                ) : finished ? (
                  <>
                    <Hammer />
                    Rebuild
                  </>
                ) : (
                  <>
                    <Hammer />
                    Start build
                  </>
                )}
              </Button>
            </div>

            {/* Pipeline */}
            <ol className="grid gap-1.5">
              {AGENT_ORDER.map((name, index) => {
                const step = steps[name];
                const Icon = AGENT_ICONS[name];
                return (
                  <li
                    key={name}
                    className={cn(
                      "rounded-lg border p-3 transition-colors",
                      step.status === "running" &&
                        "border-violet-500/50 bg-violet-500/5",
                      step.status === "done" &&
                        "border-emerald-500/40 bg-emerald-500/5",
                      step.status === "degraded" &&
                        "border-amber-500/50 bg-amber-500/5",
                      step.status === "error" &&
                        "border-destructive/50 bg-destructive/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md",
                          step.status === "pending" &&
                            "bg-muted text-muted-foreground",
                          step.status === "running" &&
                            "bg-violet-500/15 text-violet-600 dark:text-violet-400",
                          step.status === "done" &&
                            "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                          step.status === "degraded" &&
                            "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                          step.status === "error" &&
                            "bg-destructive/15 text-destructive"
                        )}
                      >
                        {step.status === "running" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : step.status === "done" ? (
                          <Check className="size-4" />
                        ) : step.status === "degraded" ? (
                          <AlertTriangle className="size-4" />
                        ) : step.status === "error" ? (
                          <X className="size-4" />
                        ) : (
                          <Icon className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {AGENT_LABELS[name]}
                          </p>
                          <span className="text-muted-foreground text-xs">
                            {index + 1}/{AGENT_ORDER.length}
                          </span>
                        </div>
                        <p className="text-muted-foreground truncate text-xs">
                          {step.message || AGENT_DESCRIPTIONS[name]}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Generated files */}
            {files.length > 0 ? (
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Generated files</p>
                  <Badge variant="secondary">{files.length}</Badge>
                </div>
                <ul className="grid gap-1">
                  {files.map((path) => (
                    <li
                      key={path}
                      className="text-muted-foreground flex items-center gap-2 truncate font-mono text-xs"
                    >
                      <FileCode className="size-3.5 shrink-0" />
                      {path}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
