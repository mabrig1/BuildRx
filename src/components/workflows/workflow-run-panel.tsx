"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/utils";

interface RunSummary {
  id: string;
  status: "running" | "completed" | "failed";
  trigger: "manual" | "webhook";
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

interface RunStepDetail {
  id: string;
  position: number;
  step_name: string;
  step_type: string;
  status: "completed" | "failed";
  output: { text?: string } | null;
  error: string | null;
}

const statusStyles: Record<RunSummary["status"], string> = {
  running: "bg-secondary text-secondary-foreground",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

function RunRow({ workflowId, run }: { workflowId: string; run: RunSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [steps, setSteps] = useState<RunStepDetail[] | null>(null);

  async function toggle() {
    if (!expanded && steps === null) {
      const response = await fetch(`/api/workflows/${workflowId}/runs/${run.id}`);
      const data = await response.json().catch(() => null);
      setSteps(data?.steps ?? []);
    }
    setExpanded((prev) => !prev);
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <button
        type="button"
        onClick={() => void toggle()}
        className="hover:bg-muted/50 flex w-full items-center gap-3 p-3 text-left"
      >
        {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <Badge variant="outline" className={statusStyles[run.status]}>
          {run.status === "failed" ? <AlertTriangle className="size-3" /> : null}
          {run.status}
        </Badge>
        <Badge variant="outline">{run.trigger}</Badge>
        <span className="text-muted-foreground flex-1 truncate text-xs">{run.error ?? ""}</span>
        <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(run.started_at)}</span>
      </button>
      {expanded ? (
        <CardContent className="border-t p-3 pt-3">
          {steps === null ? (
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          ) : steps.length === 0 ? (
            <p className="text-muted-foreground text-xs">No step data.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {steps.map((step) => (
                <div key={step.id} className="rounded-md border p-2 text-xs">
                  <div className="flex items-center gap-2 font-medium">
                    {step.status === "completed" ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="text-destructive size-3.5" />
                    )}
                    {step.position}. {step.step_name}
                  </div>
                  <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                    {step.error ?? step.output?.text ?? "(no output)"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function WorkflowRunPanel({ workflowId }: { workflowId: string }) {
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runs, setRuns] = useState<RunSummary[] | null>(null);

  function loadRuns() {
    fetch(`/api/workflows/${workflowId}/runs`)
      .then((res) => res.json())
      .then((data) => setRuns(data.runs ?? []))
      .catch(() => setRuns([]));
  }

  useEffect(() => {
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  async function handleRun() {
    setIsRunning(true);
    try {
      const response = await fetch(`/api/workflows/${workflowId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input || undefined }),
      });
      const data = await response.json().catch(() => null);
      if (data?.status === "failed") {
        toast.error(data.error ?? "Workflow run failed");
      } else if (response.ok) {
        toast.success("Workflow completed");
      } else {
        throw new Error(data?.error ?? "Run failed");
      }
      loadRuns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Run failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Optional trigger input — available to the first step as {{trigger.text}}"
          rows={2}
        />
        <Button onClick={() => void handleRun()} disabled={isRunning} className="self-start">
          {isRunning ? <Loader2 className="animate-spin" /> : <Play />}
          Run now
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Run history</h3>
        {runs === null ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        ) : runs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No runs yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {runs.map((run) => (
              <RunRow key={run.id} workflowId={workflowId} run={run} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
