"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { ModelSelector } from "@/components/ai/model-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ProviderModel {
  id: string;
  label: string;
  contextWindow?: number;
  pricing?: { inputPer1M: number; outputPer1M: number };
}

interface ProviderInfo {
  id: string;
  label: string;
  configured: boolean;
  defaultModel: string;
  models: ProviderModel[];
}

interface ComparisonResult {
  provider: string;
  model: string;
  text?: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number | null;
  durationMs: number;
  error?: string;
}

function formatCost(usd: number | null | undefined) {
  if (usd === null || usd === undefined) return "—";
  if (usd === 0) return "free";
  return usd < 0.01 ? "<$0.01" : `$${usd.toFixed(3)}`;
}

/** Combines the provider status list, default-model picker, and the
 * model comparison tool into one panel for the Settings → AI Models tab. */
export function AiSettingsPanel() {
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);
  const [defaultSelection, setDefaultSelection] = useState<{
    provider: string;
    model: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [comparePrompt, setComparePrompt] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<
    { provider: string; model: string }[]
  >([]);
  const [isComparing, setIsComparing] = useState(false);
  const [results, setResults] = useState<ComparisonResult[] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [providersRes, settingsRes] = await Promise.all([
          fetch("/api/ai/providers"),
          fetch("/api/ai/settings"),
        ]);
        const providersData = await providersRes.json();
        const settingsData = await settingsRes.json();
        if (providersRes.ok) setProviders(providersData.providers);
        if (settingsRes.ok) {
          setDefaultSelection({
            provider: settingsData.defaultProvider,
            model: settingsData.defaultModel,
          });
        }
      } catch {
        toast.error("Couldn't load AI provider status.");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  async function saveDefaults() {
    if (!defaultSelection) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultProvider: defaultSelection.provider,
          defaultModel: defaultSelection.model,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to save");
      toast.success("Default model saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  function toggleTarget(provider: string, model: string) {
    setSelectedTargets((current) => {
      const exists = current.some(
        (t) => t.provider === provider && t.model === model
      );
      if (exists) {
        return current.filter(
          (t) => !(t.provider === provider && t.model === model)
        );
      }
      if (current.length >= 6) {
        toast.error("Compare at most 6 models at once.");
        return current;
      }
      return [...current, { provider, model }];
    });
  }

  async function runComparison() {
    if (comparePrompt.trim().length === 0) {
      toast.error("Enter a prompt to compare.");
      return;
    }
    if (selectedTargets.length < 2) {
      toast.error("Pick at least two models to compare.");
      return;
    }
    setIsComparing(true);
    setResults(null);
    try {
      const response = await fetch("/api/ai/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: comparePrompt.trim(),
          targets: selectedTargets,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Comparison failed");
      setResults(data.results);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Comparison failed");
    } finally {
      setIsComparing(false);
    }
  }

  if (isLoading || !providers) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const configuredCount = providers.filter((p) => p.configured).length;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>AI providers</CardTitle>
          <CardDescription>
            {configuredCount} of {providers.length} providers configured on
            this deployment.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="text-sm font-medium">{provider.label}</span>
              {provider.configured ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1">
                  <XCircle className="size-3" />
                  Not configured
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default model</CardTitle>
          <CardDescription>
            Used when a feature doesn&apos;t ask you to pick a model
            explicitly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModelSelector
            providers={providers}
            value={defaultSelection}
            onChange={setDefaultSelection}
          />
        </CardContent>
        <CardFooter className="border-t">
          <Button onClick={() => void saveDefaults()} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : null}
            Save default
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compare models</CardTitle>
          <CardDescription>
            Run one prompt across multiple models side by side — see
            responses, token usage, estimated cost, and latency together.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Textarea
            value={comparePrompt}
            onChange={(event) => setComparePrompt(event.target.value)}
            placeholder="Explain what a race condition is, in two sentences."
            rows={3}
          />
          <div className="grid gap-2">
            <p className="text-muted-foreground text-xs">
              Pick 2-6 models ({selectedTargets.length} selected)
            </p>
            <div className="flex flex-wrap gap-2">
              {providers
                .filter((p) => p.configured)
                .flatMap((provider) =>
                  provider.models.map((model) => {
                    const isSelected = selectedTargets.some(
                      (t) => t.provider === provider.id && t.model === model.id
                    );
                    return (
                      <button
                        key={`${provider.id}::${model.id}`}
                        type="button"
                        onClick={() => toggleTarget(provider.id, model.id)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-muted"
                        )}
                      >
                        {provider.label}: {model.label}
                      </button>
                    );
                  })
                )}
              {providers.every((p) => !p.configured) ? (
                <p className="text-muted-foreground text-sm">
                  No providers are configured yet — add an API key to compare
                  models.
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t">
          <Button onClick={() => void runComparison()} disabled={isComparing}>
            {isComparing ? <Loader2 className="animate-spin" /> : null}
            Compare
          </Button>
        </CardFooter>
      </Card>

      {results ? (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((result, index) => (
            <Card key={`${result.provider}-${result.model}-${index}`}>
              <CardHeader>
                <CardTitle className="text-sm">
                  {result.provider} · {result.model}
                </CardTitle>
                <CardDescription className="flex flex-wrap gap-3 text-xs">
                  <span>{result.durationMs}ms</span>
                  {result.promptTokens !== undefined ? (
                    <span>
                      {result.promptTokens + (result.completionTokens ?? 0)}{" "}
                      tokens
                    </span>
                  ) : null}
                  <span>{formatCost(result.costUsd)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result.error ? (
                  <p className="text-destructive text-sm">{result.error}</p>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{result.text}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
