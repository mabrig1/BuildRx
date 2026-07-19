"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/content/prompts";

export type WorkflowStepType = "ai_generate" | "agent_run" | "content_generate" | "kb_chat" | "webhook";

export const STEP_TYPE_LABELS: Record<WorkflowStepType, string> = {
  ai_generate: "AI generate",
  agent_run: "Run agent",
  content_generate: "Generate content",
  kb_chat: "Ask knowledge base",
  webhook: "Webhook",
};

export const STEP_TYPE_HINTS: Record<WorkflowStepType, string> = {
  ai_generate: "A single prompt to any configured provider.",
  agent_run: "One turn with one of your agents.",
  content_generate: "Generates and saves a Content Studio piece.",
  kb_chat: "Asks one of your knowledge bases a question, with citations.",
  webhook: "Sends the previous step's output to a URL.",
};

interface ProviderOption {
  id: string;
  label: string;
  configured: boolean;
  defaultModel: string;
}
interface AgentOption {
  id: string;
  name: string;
}
interface KnowledgeBaseOption {
  id: string;
  name: string;
}

export interface StepFormValues {
  name: string;
  type: WorkflowStepType;
  config: Record<string, unknown>;
}

export interface ExistingStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  config: Record<string, unknown>;
}

const CONTENT_TYPES = Object.keys(CONTENT_TYPE_LABELS) as ContentType[];

export function StepFormDialog({
  open,
  onOpenChange,
  workflowId,
  existingStep,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  existingStep: ExistingStep | null;
  onSaved: () => void;
}) {
  const isEditing = Boolean(existingStep);
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkflowStepType>("ai_generate");
  const [providers, setProviders] = useState<ProviderOption[] | null>(null);
  const [agents, setAgents] = useState<AgentOption[] | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseOption[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Field state, superset across all step types.
  const [system, setSystem] = useState("");
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [agentId, setAgentId] = useState("");
  const [message, setMessage] = useState("");
  const [contentType, setContentType] = useState<ContentType>("blog_post");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");
  const [question, setQuestion] = useState("");
  const [url, setUrl] = useState("");
  const [payload, setPayload] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/ai/providers")
      .then((res) => res.json())
      .then((data) => setProviders(data.providers))
      .catch(() => toast.error("Couldn't load AI providers."));
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => setAgents(data.agents ?? []))
      .catch(() => setAgents([]));
    fetch("/api/rag/knowledge-bases")
      .then((res) => res.json())
      .then((data) => setKnowledgeBases(data.knowledgeBases ?? []))
      .catch(() => setKnowledgeBases([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (existingStep) {
      const cfg = existingStep.config as Record<string, unknown>;
      setName(existingStep.name);
      setType(existingStep.type);
      setSystem(typeof cfg.system === "string" ? cfg.system : "");
      setPrompt(typeof cfg.prompt === "string" ? cfg.prompt : "");
      setProvider(typeof cfg.provider === "string" ? cfg.provider : "");
      setModel(typeof cfg.model === "string" ? cfg.model : "");
      setAgentId(typeof cfg.agentId === "string" ? cfg.agentId : "");
      setMessage(typeof cfg.message === "string" ? cfg.message : "");
      setContentType(
        typeof cfg.contentType === "string" ? (cfg.contentType as ContentType) : "blog_post"
      );
      const inputs = (cfg.inputs as Record<string, unknown>) ?? {};
      setTopic(typeof inputs.topic === "string" ? inputs.topic : "");
      setTone(typeof inputs.tone === "string" ? inputs.tone : "");
      setKnowledgeBaseId(typeof cfg.knowledgeBaseId === "string" ? cfg.knowledgeBaseId : "");
      setQuestion(typeof cfg.question === "string" ? cfg.question : "");
      setUrl(typeof cfg.url === "string" ? cfg.url : "");
      setPayload(typeof cfg.payload === "string" ? cfg.payload : "");
    } else {
      setName("");
      setType("ai_generate");
      setSystem("");
      setPrompt("");
      setProvider("");
      setModel("");
      setAgentId("");
      setMessage("");
      setContentType("blog_post");
      setTopic("");
      setTone("");
      setKnowledgeBaseId("");
      setQuestion("");
      setUrl("");
      setPayload("");
    }
  }, [open, existingStep]);

  function buildConfig(): Record<string, unknown> {
    switch (type) {
      case "ai_generate":
        return { system: system || undefined, prompt, provider, model: model || undefined };
      case "agent_run":
        return { agentId, message };
      case "content_generate":
        return {
          contentType,
          inputs: { topic, tone: tone || undefined },
          provider,
          model: model || undefined,
        };
      case "kb_chat":
        return { knowledgeBaseId, question, provider, model: model || undefined };
      case "webhook":
        return { url, payload: payload || undefined };
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Give this step a name.");
      return;
    }
    setIsSaving(true);
    try {
      const config = buildConfig();
      const response = await fetch(
        isEditing
          ? `/api/workflows/${workflowId}/steps/${existingStep!.id}`
          : `/api/workflows/${workflowId}/steps`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEditing ? { name, config } : { name, type, config }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to save step");
      toast.success(isEditing ? "Step updated" : "Step added");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save step");
    } finally {
      setIsSaving(false);
    }
  }

  const providerOptions = providers ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit step" : "Add step"}</DialogTitle>
            <DialogDescription>
              Reference an earlier step&apos;s output with{" "}
              <code className="bg-muted rounded px-1">{"{{step1.text}}"}</code> or the trigger
              input with <code className="bg-muted rounded px-1">{"{{trigger.text}}"}</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="step-name">Step name</Label>
              <Input id="step-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {!isEditing ? (
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as WorkflowStepType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STEP_TYPE_LABELS) as WorkflowStepType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {STEP_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">{STEP_TYPE_HINTS[type]}</p>
              </div>
            ) : null}

            {type === "ai_generate" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="step-system">System prompt (optional)</Label>
                  <Textarea id="step-system" value={system} onChange={(e) => setSystem(e.target.value)} rows={2} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="step-prompt">Prompt</Label>
                  <Textarea id="step-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} />
                </div>
              </>
            ) : null}

            {type === "agent_run" ? (
              <>
                <div className="grid gap-2">
                  <Label>Agent</Label>
                  <Select value={agentId} onValueChange={setAgentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {(agents ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="step-message">Message</Label>
                  <Textarea id="step-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
                </div>
              </>
            ) : null}

            {type === "content_generate" ? (
              <>
                <div className="grid gap-2">
                  <Label>Content type</Label>
                  <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {CONTENT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="step-topic">Topic</Label>
                  <Textarea id="step-topic" value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="step-tone">Tone (optional)</Label>
                  <Input id="step-tone" value={tone} onChange={(e) => setTone(e.target.value)} />
                </div>
              </>
            ) : null}

            {type === "kb_chat" ? (
              <>
                <div className="grid gap-2">
                  <Label>Knowledge base</Label>
                  <Select value={knowledgeBaseId} onValueChange={setKnowledgeBaseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a knowledge base" />
                    </SelectTrigger>
                    <SelectContent>
                      {(knowledgeBases ?? []).map((kb) => (
                        <SelectItem key={kb.id} value={kb.id}>
                          {kb.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="step-question">Question</Label>
                  <Textarea id="step-question" value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} />
                </div>
              </>
            ) : null}

            {type === "webhook" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="step-url">URL</Label>
                  <Input id="step-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="step-payload">Payload (optional, defaults to the previous step&apos;s output)</Label>
                  <Textarea id="step-payload" value={payload} onChange={(e) => setPayload(e.target.value)} rows={3} />
                </div>
              </>
            ) : null}

            {type !== "agent_run" && type !== "webhook" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Provider</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providerOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id} disabled={!p.configured}>
                          {p.label}
                          {!p.configured ? " (not configured)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="step-model">Model (optional)</Label>
                  <Input id="step-model" value={model} onChange={(e) => setModel(e.target.value)} />
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
