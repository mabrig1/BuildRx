"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ModelSelector } from "@/components/ai/model-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AVAILABLE_TOOL_IDS, TOOL_DESCRIPTIONS, type ToolId } from "@/lib/ai-agents/tools";
import { AGENT_TEMPLATES } from "@/lib/ai-agents/templates";
import { cn } from "@/lib/utils";

interface ProviderOption {
  id: string;
  label: string;
  configured: boolean;
  defaultModel: string;
  models: { id: string; label: string }[];
}

export function AgentForm() {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderOption[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🤖");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
  const [tools, setTools] = useState<ToolId[]>([]);
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">(
    "private"
  );
  const [model, setModel] = useState<{ provider: string; model: string } | null>(null);

  useEffect(() => {
    fetch("/api/ai/providers")
      .then((res) => res.json())
      .then((data) => {
        setProviders(data.providers);
        const configured = (data.providers as ProviderOption[]).find((p) => p.configured);
        if (configured) {
          setModel({ provider: configured.id, model: configured.defaultModel ?? configured.models[0]?.id });
        }
      })
      .catch(() => toast.error("Couldn't load AI providers."));
  }, []);

  function applyTemplate(templateId: string) {
    const template = AGENT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setIcon(template.icon);
    setName((current) => current || template.name);
    setDescription((current) => current || template.description);
    setSystemPrompt(template.systemPrompt);
    setTools(template.tools as ToolId[]);
  }

  function toggleTool(id: ToolId) {
    setTools((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Give your agent a name.");
      return;
    }
    if (!model) {
      toast.error("Choose a model.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          icon,
          systemPrompt,
          provider: model.provider,
          model: model.model,
          tools,
          visibility,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to create agent");
      toast.success(`"${name}" created`);
      router.push(`/agents/${data.agent.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create agent");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Start from a template</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {AGENT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template.id)}
                className="hover:bg-muted flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors"
              >
                <span className="text-lg">{template.icon}</span>
                <span>
                  <span className="block font-medium">{template.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {template.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex gap-3">
            <div className="grid w-20 gap-2">
              <Label htmlFor="icon">Icon</Label>
              <Input
                id="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={8}
                className="text-center text-lg"
              />
            </div>
            <div className="grid flex-1 gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Support Bot"
                maxLength={80}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              maxLength={300}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="system-prompt">System prompt</Label>
            <Textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              maxLength={8000}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model</CardTitle>
        </CardHeader>
        <CardContent>
          {providers ? (
            <ModelSelector providers={providers} value={model} onChange={setModel} />
          ) : (
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            {AVAILABLE_TOOL_IDS.map((id) => {
              const isSelected = tools.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleTool(id)}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <span className="block font-medium">{id}</span>
                  <span className="text-muted-foreground block text-xs">
                    {TOOL_DESCRIPTIONS[id]}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Only used when the chosen model supports tool calling (OpenAI,
            Anthropic, DeepSeek, Grok).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private — only you</SelectItem>
              <SelectItem value="unlisted">Unlisted — shareable link</SelectItem>
              <SelectItem value="public">Public — listed in the marketplace</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Create agent
        </Button>
      </div>
    </form>
  );
}
