"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  StepFormDialog,
  STEP_TYPE_LABELS,
  type ExistingStep,
  type WorkflowStepType,
} from "@/components/workflows/step-form-dialog";

export interface WorkflowStepSummary {
  id: string;
  name: string;
  type: WorkflowStepType;
  position: number;
  config: Record<string, unknown>;
}

export function StepList({
  workflowId,
  steps,
}: {
  workflowId: string;
  steps: WorkflowStepSummary[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExistingStep | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const ordered = [...steps].sort((a, b) => a.position - b.position);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(step: WorkflowStepSummary) {
    setEditing({ id: step.id, name: step.name, type: step.type, config: step.config });
    setDialogOpen(true);
  }

  function handleDelete(stepId: string) {
    startTransition(async () => {
      const response = await fetch(`/api/workflows/${workflowId}/steps/${stepId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Failed to delete step");
        return;
      }
      router.refresh();
    });
  }

  async function move(stepId: string, direction: "up" | "down") {
    const index = ordered.findIndex((s) => s.id === stepId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= ordered.length) return;

    const nextOrder = [...ordered];
    [nextOrder[index], nextOrder[swapIndex]] = [nextOrder[swapIndex], nextOrder[index]];

    setReorderingId(stepId);
    try {
      const response = await fetch(`/api/workflows/${workflowId}/steps/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIds: nextOrder.map((s) => s.id) }),
      });
      if (!response.ok) throw new Error("Failed to reorder");
      router.refresh();
    } catch {
      toast.error("Failed to reorder steps");
    } finally {
      setReorderingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {ordered.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
          No steps yet — add one to build this workflow.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ordered.map((step, index) => (
            <Card key={step.id} className="gap-0 p-3">
              <CardContent className="flex items-center gap-3 p-0">
                <span className="text-muted-foreground w-6 shrink-0 text-center text-sm font-medium">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{step.name}</p>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {STEP_TYPE_LABELS[step.type]}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move up"
                    disabled={index === 0 || reorderingId !== null}
                    onClick={() => void move(step.id, "up")}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move down"
                    disabled={index === ordered.length - 1 || reorderingId !== null}
                    onClick={() => void move(step.id, "down")}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Edit step" onClick={() => openEdit(step)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete step"
                    disabled={isPending}
                    onClick={() => handleDelete(step.id)}
                  >
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button variant="outline" onClick={openAdd} className="self-start">
        <Plus />
        Add step
      </Button>

      <StepFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workflowId={workflowId}
        existingStep={editing}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
