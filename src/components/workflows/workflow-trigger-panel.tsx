"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function WorkflowTriggerPanel({
  workflowId,
  enabled: initialEnabled,
  triggerType: initialTriggerType,
  webhookToken,
}: {
  workflowId: string;
  enabled: boolean;
  triggerType: "manual" | "webhook";
  webhookToken: string;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [triggerType, setTriggerType] = useState(initialTriggerType);
  const [copied, setCopied] = useState(false);

  const triggerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/workflows/trigger/${webhookToken}`
      : `/api/workflows/trigger/${webhookToken}`;

  async function update(patch: { enabled?: boolean; triggerType?: "manual" | "webhook" }) {
    const response = await fetch(`/api/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      toast.error("Failed to update trigger settings");
      return;
    }
    router.refresh();
  }

  function handleCopy() {
    void navigator.clipboard.writeText(triggerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="workflow-enabled">Enabled</Label>
            <p className="text-muted-foreground text-xs">Disabled workflows can&apos;t be run or triggered.</p>
          </div>
          <Switch
            id="workflow-enabled"
            checked={enabled}
            onCheckedChange={(checked) => {
              setEnabled(checked);
              void update({ enabled: checked });
            }}
          />
        </div>

        <div className="grid gap-2">
          <Label>Trigger</Label>
          <Select
            value={triggerType}
            onValueChange={(v) => {
              const next = v as "manual" | "webhook";
              setTriggerType(next);
              void update({ triggerType: next });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual only</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {triggerType === "webhook" ? (
          <div className="grid gap-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={triggerUrl} className="font-mono text-xs" />
              <button
                type="button"
                onClick={handleCopy}
                className="hover:bg-muted flex shrink-0 items-center justify-center rounded-md border px-3"
                aria-label="Copy webhook URL"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </div>
            <p className="text-muted-foreground text-xs">
              POST any JSON body here to run this workflow — it becomes{" "}
              <code className="bg-muted rounded px-1">{"{{trigger.text}}"}</code> for the first
              step.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
